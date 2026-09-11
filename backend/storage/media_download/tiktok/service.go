package tiktok

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	pythonapi "backend/api/python"
	"backend/utils"
)

var activeJobs = struct {
	sync.RWMutex
	items map[string]*Job
}{items: make(map[string]*Job)}

func setJobStage(job *Job, stage string) {
	job.mu.Lock()
	job.State = stage
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistJob(job)
	utils.LogEvent("INFO", "storage tiktok stage changed", map[string]any{"jobId": job.ID, "stage": stage})
}

func setJobError(job *Job, code, message string) {
	job.mu.Lock()
	job.State = "error"
	job.ErrorCode = code
	job.Error = message
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistJob(job)
	utils.LogEvent("ERROR", "storage tiktok job error", map[string]any{"jobId": job.ID, "errorCode": code, "error": message})
}

// StartJob initializes and starts an isolated TikTok download job.
func StartJob(id, sourceURL, filename, destination, audioURL string, items []DownloadItem, headers map[string]string) error {
	if id == "" || (sourceURL == "" && len(items) == 0) {
		return fmt.Errorf("thiếu task_id hoặc URL tải")
	}
	if _, err := pythonapi.SafeArchivePath(destination); err != nil {
		return err
	}
	if _, err := WorkspaceDir(id); err != nil {
		return err
	}

	ctx, cancel := context.WithCancel(context.Background())
	now := time.Now().UTC()
	job := &Job{
		ID:          id,
		CanonicalID: id,
		URL:         sourceURL,
		Filename:    safeFilename(filename),
		Destination: destination,
		State:       "downloading",
		CreatedAt:   now,
		UpdatedAt:   now,
		audioURL:    audioURL,
		items:       items,
		headers:     headers,
		ctx:         ctx,
		cancel:      cancel,
	}

	activeJobs.Lock()
	if old := activeJobs.items[id]; old != nil {
		old.cancel()
	}
	activeJobs.items[id] = job
	activeJobs.Unlock()

	persistJob(job)
	utils.LogEvent("INFO", "storage tiktok job created", map[string]any{"jobId": id, "filename": job.Filename, "destination": destination})
	go runJob(job)
	return nil
}

func runJob(job *Job) {
	workspace, err := WorkspaceDir(job.ID)
	if err != nil {
		setJobError(job, "WORKSPACE_ERROR", err.Error())
		return
	}
	if err := os.MkdirAll(workspace, 0755); err != nil {
		setJobError(job, "WORKSPACE_ERROR", err.Error())
		return
	}

	// 1. Download
	setJobStage(job, "downloading")
	if err := downloadAllItems(job.ctx, job, workspace); err != nil {
		if job.ctx.Err() != nil {
			setJobStage(job, "cancelled")
			return
		}
		setJobError(job, "DOWNLOAD_FAILED", err.Error())
		return
	}

	job.mu.RLock()
	isPhotoJob := len(job.items) > 0
	job.mu.RUnlock()

	// 2a. Luồng ảnh (Photo/Slideshow): commit thẳng vào thư mục đích mà không qua video scan/convert
	if isPhotoJob {
		setJobStage(job, "committing")
		if err := commitTikTokMedia(job.ctx, job, workspace); err != nil {
			if job.ctx.Err() != nil {
				setJobStage(job, "cancelled")
				return
			}
			setJobError(job, "COMMIT_FAILED", err.Error())
			return
		}
		_ = os.RemoveAll(workspace)
		setJobStage(job, "completed")
		return
	}

	// 2b. Luồng video: Bắt đầu từ bước scan như kiểu video của YouTube
	setJobStage(job, "scanning")
	select {
	case <-time.After(900 * time.Millisecond):
	case <-job.ctx.Done():
		return
	}

	videos := pythonapi.ScanVideoOptimizations(job.ctx, workspace)
	if job.ctx.Err() != nil {
		return
	}

	invalidTotal := 0
	for _, v := range videos {
		if v.OptimizationNeeded {
			invalidTotal++
		}
	}

	job.mu.Lock()
	job.Videos = videos
	job.ConvertTotal = invalidTotal
	job.TotalVideoCount = len(videos)
	job.VideoScanState = "completed"
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistJob(job)

	// Video tương thích: commit trực tiếp đến thư mục đích
	if invalidTotal == 0 {
		setJobStage(job, "committing")
		sourceFile := filepath.Join(workspace, job.Filename)
		if _, err := commitVideoFile(job.ctx, sourceFile, job.Destination, job.Filename, job.ID); err != nil {
			if job.ctx.Err() == nil {
				setJobError(job, "COMMIT_FAILED", err.Error())
			}
			return
		}
		_ = os.RemoveAll(workspace)
		setJobStage(job, "completed")
		return
	}

	// Video không tương thích (ví dụ ByteVC1 / H.265 bitrate cao): tạo .convert-video/ trong workspace
	convertDir := filepath.Join(workspace, ".convert-video")
	if err := os.MkdirAll(convertDir, 0755); err != nil {
		setJobError(job, "CONVERT_PREPARE_FAILED", err.Error())
		return
	}

	needsDecision := false
	for _, v := range videos {
		if v.OptimizationNeeded && v.SelectedQuality == "" {
			needsDecision = true
			break
		}
	}

	if needsDecision {
		setJobStage(job, "video_decision_required")
		return
	}

	startConversion(job, convertDir)
}

func startConversion(job *Job, convertDir string) {
	workspace, err := WorkspaceDir(job.ID)
	if err != nil {
		setJobError(job, "WORKSPACE_ERROR", err.Error())
		return
	}

	sourcePath := filepath.Join(workspace, job.Filename)
	if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
		alt := filepath.Join(convertDir, job.Filename)
		if _, altErr := os.Stat(alt); altErr == nil {
			sourcePath = alt
		} else {
			setJobError(job, "CONVERT_PREPARE_FAILED", fmt.Sprintf("không tìm thấy file nguồn trong workspace: %s", job.Filename))
			return
		}
	}

	if err := os.MkdirAll(convertDir, 0755); err != nil {
		setJobError(job, "CONVERT_PREPARE_FAILED", err.Error())
		return
	}

	convertedFilename := strings.TrimSuffix(job.Filename, filepath.Ext(job.Filename)) + ".mp4"
	targetPath := filepath.Join(convertDir, convertedFilename)

	job.mu.Lock()
	quality := ""
	for _, v := range job.Videos {
		if v.OptimizationNeeded {
			quality = v.SelectedQuality
			break
		}
	}
	job.State = "converting"
	job.ConvertTotal = 1
	job.ConvertCurrent = 0
	job.ConvertFailed = 0
	for i := range job.Videos {
		if job.Videos[i].OptimizationNeeded {
			job.Videos[i].State = "converting"
		}
	}
	job.UpdatedAt = time.Now().UTC()
	ctx := job.ctx
	destination := job.Destination
	id := job.ID
	job.mu.Unlock()
	persistJob(job)

	// Chuyển mã sang chuẩn MP4/H.264
	if err := pythonapi.ConvertSingleVideoFile(ctx, id, sourcePath, targetPath, quality); err != nil {
		job.mu.Lock()
		stage := job.State
		job.mu.Unlock()
		if stage == "cancelling" || ctx.Err() != nil {
			setJobStage(job, "cancelled")
			return
		}
		job.mu.Lock()
		job.ConvertFailed = 1
		job.UpdatedAt = time.Now().UTC()
		job.mu.Unlock()
		persistJob(job)
		setJobError(job, "VIDEO_CONVERT_FAILED", fmt.Sprintf("Không tối ưu được video: %v", err))
		return
	}

	if ctx.Err() != nil {
		setJobStage(job, "cancelled")
		return
	}

	job.mu.Lock()
	job.ConvertTotal = 1
	job.ConvertCurrent = 1
	for i := range job.Videos {
		if job.Videos[i].OptimizationNeeded {
			job.Videos[i].State = "completed"
		}
	}
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistJob(job)

	// Copy file trong thư mục .convert-video đến thư mục đích
	if _, statErr := os.Stat(targetPath); statErr != nil {
		setJobError(job, "FINALIZE_FAILED", fmt.Sprintf("file phương tiện trong workspace không tồn tại: %v", statErr))
		return
	}

	setJobStage(job, "committing")
	if _, err := commitVideoFile(ctx, targetPath, destination, convertedFilename, id); err != nil {
		setJobError(job, "FINALIZE_FAILED", err.Error())
		return
	}

	_ = os.RemoveAll(workspace)
	setJobStage(job, "completed")
}

func CancelJob(id string) bool {
	activeJobs.Lock()
	job := activeJobs.items[id]
	activeJobs.Unlock()

	if job == nil {
		return false
	}
	job.mu.Lock()
	stage := job.State
	if stage == "cancelled" || stage == "completed" {
		job.mu.Unlock()
		return true
	}
	if stage == "cancelling" {
		job.mu.Unlock()
		return true
	}
	if stage == "converting" {
		job.State = "cancelling"
		job.OptimizationCancelled = true
		job.CancelledFromStage = "converting"
		job.UpdatedAt = time.Now().UTC()
		cancel := job.cancel
		job.mu.Unlock()
		if cancel != nil {
			cancel()
		}
		persistJob(job)
		pythonapi.CancelConvertJob(id)
		return true
	}
	job.State = "cancelled"
	job.OptimizationCancelled = true
	job.CancelledFromStage = stage
	job.UpdatedAt = time.Now().UTC()
	cancel := job.cancel
	job.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	pythonapi.CancelConvertJob(id)
	persistJob(job)
	return true
}

// SetVideoDecision records a quality choice for an incompatible video.
func SetVideoDecision(id, videoID, quality string) error {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()
	if job == nil {
		return fmt.Errorf("không tìm thấy tiktok job")
	}
	job.mu.Lock()
	defer job.mu.Unlock()
	quality = strings.ToLower(strings.TrimSpace(quality))
	for i := range job.Videos {
		if job.Videos[i].ID == videoID {
			job.Videos[i].SelectedQuality = quality
			job.Videos[i].State = "ready"
			job.UpdatedAt = time.Now().UTC()
			persistJob(job)
			return nil
		}
	}
	return fmt.Errorf("không tìm thấy video %s", videoID)
}

// ApplyVideoDecisions records all quality choices and starts conversion if all needed decisions are made.
func ApplyVideoDecisions(id string, decisions map[string]string) error {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()
	if job == nil {
		return fmt.Errorf("không tìm thấy tiktok job")
	}

	job.mu.Lock()
	for i := range job.Videos {
		if job.Videos[i].OptimizationNeeded {
			if q, ok := decisions[job.Videos[i].ID]; ok && q != "" {
				job.Videos[i].SelectedQuality = strings.ToLower(strings.TrimSpace(q))
				job.Videos[i].State = "ready"
			}
		}
	}
	allDecided := true
	for _, v := range job.Videos {
		if v.OptimizationNeeded && v.SelectedQuality == "" {
			allDecided = false
			break
		}
	}
	stage := job.State
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistJob(job)

	if allDecided && stage == "video_decision_required" {
		workspace, err := WorkspaceDir(job.ID)
		if err != nil {
			return err
		}
		convertDir := filepath.Join(workspace, ".convert-video")
		go startConversion(job, convertDir)
	}
	return nil
}

func GetJobSnapshot(id string) (Snapshot, bool) {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()

	if job != nil {
		job.mu.RLock()
		defer job.mu.RUnlock()
		return jobSnapshot(job), true
	}

	path, err := StatePath(id)
	if err != nil {
		return Snapshot{}, false
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Snapshot{}, false
	}
	var pj persistedJob
	if err := json.Unmarshal(data, &pj); err != nil {
		return Snapshot{}, false
	}
	return pj.Job, true
}

func GetJobSnapshots() []Snapshot {
	var results []Snapshot
	seen := make(map[string]bool)

	activeJobs.RLock()
	for _, job := range activeJobs.items {
		job.mu.RLock()
		results = append(results, jobSnapshot(job))
		seen[job.ID] = true
		job.mu.RUnlock()
	}
	activeJobs.RUnlock()

	dir, err := StateDir()
	if err != nil {
		return results
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return results
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		id := strings.TrimSuffix(entry.Name(), ".json")
		if seen[id] {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		var pj persistedJob
		if err := json.Unmarshal(data, &pj); err != nil {
			continue
		}
		results = append(results, pj.Job)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].CreatedAt.After(results[j].CreatedAt)
	})
	return results
}

func SetCanonicalID(id, canonicalID string) bool {
	activeJobs.Lock()
	job := activeJobs.items[id]
	activeJobs.Unlock()

	if job == nil {
		return false
	}
	job.mu.Lock()
	job.CanonicalID = canonicalID
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistJob(job)
	return true
}

// LoadPersistentJobs loads existing TikTok job states on Storage startup.
func LoadPersistentJobs() {
	dir, err := StateDir()
	if err != nil {
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		var persisted persistedJob
		if json.Unmarshal(data, &persisted) != nil || persisted.Version != 1 || persisted.Job.ID == "" {
			continue
		}
		s := persisted.Job
		ctx, cancel := context.WithCancel(context.Background())
		job := &Job{
			ID:                    s.ID,
			CanonicalID:           s.CanonicalID,
			URL:                   s.URL,
			Filename:              s.Filename,
			Destination:           s.Destination,
			State:                 s.State,
			DownloadedBytes:       s.DownloadedBytes,
			TotalBytes:            s.TotalBytes,
			SpeedBytes:            s.SpeedBytes,
			ConvertTotal:          s.Conversion.Total,
			ConvertCurrent:        s.Conversion.Current,
			ConvertFailed:         s.Conversion.Failed,
			ErrorCode:             s.ErrorCode,
			Error:                 s.Error,
			VideoScanState:        s.VideoScanState,
			TotalVideoCount:       s.TotalVideoCount,
			InvalidVideoCount:     s.InvalidVideoCount,
			OptimizationCancelled: s.OptimizationCancelled,
			CancelledFromStage:    s.CancelledFromStage,
			Videos:                append([]pythonapi.VideoOptimization(nil), s.Videos...),
			CreatedAt:             s.CreatedAt,
			UpdatedAt:             s.UpdatedAt,
			ctx:                   ctx,
			cancel:                cancel,
		}
		if job.CanonicalID == "" {
			job.CanonicalID = job.ID
		}
		if job.State == "downloading" || job.State == "scanning" || job.State == "converting" {
			job.State = "error"
			job.ErrorCode = "STORAGE_RESTARTED"
			job.Error = "Máy chủ lưu trữ đã khởi động lại khi đang xử lý video."
		}
		activeJobs.Lock()
		activeJobs.items[job.ID] = job
		activeJobs.Unlock()
	}
}
