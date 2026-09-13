package instagram

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
	utils.LogEvent("INFO", "storage instagram stage changed", map[string]any{"jobId": job.ID, "stage": stage})
}

func setJobError(job *Job, code, message string) {
	job.mu.Lock()
	job.State = "error"
	job.ErrorCode = code
	job.Error = message
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistJob(job)
	utils.LogEvent("ERROR", "storage instagram job error", map[string]any{"jobId": job.ID, "errorCode": code, "error": message})
}

// StartJob initializes and starts an isolated Instagram download job.
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
	utils.LogEvent("INFO", "storage instagram job created", map[string]any{"jobId": id, "filename": job.Filename, "destination": destination})
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

	// 1. Multi-threaded Download
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
	hasMultipleItems := len(job.items) > 0
	job.mu.RUnlock()

	// 2a. Nhiều item (Album / Carousel / Mixed): commit thẳng vào thư mục đích
	if hasMultipleItems {
		setJobStage(job, "committing")
		if err := commitInstagramMedia(job.ctx, job, workspace); err != nil {
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

	// 2b. Đơn mục: kiểm tra xem có phải video hay ảnh
	if !strings.HasSuffix(strings.ToLower(job.Filename), ".mp4") &&
		!strings.HasSuffix(strings.ToLower(job.Filename), ".mov") &&
		!strings.HasSuffix(strings.ToLower(job.Filename), ".mkv") {
		// Single photo commit
		setJobStage(job, "committing")
		sourceFile := filepath.Join(workspace, job.Filename)
		if _, err := commitMediaFile(job.ctx, sourceFile, job.Destination, job.Filename, job.ID); err != nil {
			if job.ctx.Err() == nil {
				setJobError(job, "COMMIT_FAILED", err.Error())
			}
			return
		}
		_ = os.RemoveAll(workspace)
		setJobStage(job, "completed")
		return
	}

	// 2c. Luồng video đơn: Quét tương thích và tối ưu hoá
	setJobStage(job, "scanning")
	select {
	case <-time.After(500 * time.Millisecond):
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
		if _, err := commitMediaFile(job.ctx, sourceFile, job.Destination, job.Filename, job.ID); err != nil {
			if job.ctx.Err() == nil {
				setJobError(job, "COMMIT_FAILED", err.Error())
			}
			return
		}
		_ = os.RemoveAll(workspace)
		setJobStage(job, "completed")
		return
	}

	// Video không tương thích: tạo .convert-video/ trong workspace
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
			return
		}
		job.mu.Lock()
		job.ConvertFailed = 1
		job.mu.Unlock()
		setJobError(job, "CONVERT_FAILED", err.Error())
		return
	}

	job.mu.Lock()
	job.ConvertCurrent = 1
	job.mu.Unlock()

	setJobStage(job, "committing")
	if _, err := commitMediaFile(ctx, targetPath, destination, convertedFilename, id); err != nil {
		if ctx.Err() == nil {
			setJobError(job, "COMMIT_FAILED", err.Error())
		}
		return
	}

	_ = os.RemoveAll(workspace)
	setJobStage(job, "completed")
}

// CancelJob cancels an active Instagram download job.
func CancelJob(id string) bool {
	activeJobs.Lock()
	job := activeJobs.items[id]
	activeJobs.Unlock()

	if job == nil {
		return false
	}

	job.mu.Lock()
	if job.State == "completed" || job.State == "cancelled" || job.State == "error" {
		job.mu.Unlock()
		return false
	}
	prevStage := job.State
	job.State = "cancelled"
	job.CancelledFromStage = prevStage
	job.OptimizationCancelled = true
	job.UpdatedAt = time.Now().UTC()
	cancel := job.cancel
	job.mu.Unlock()

	if cancel != nil {
		cancel()
	}

	persistJob(job)
	utils.LogEvent("INFO", "storage instagram job cancelled", map[string]any{"jobId": id, "cancelledFromStage": prevStage})

	if ws, err := WorkspaceDir(id); err == nil {
		_ = os.RemoveAll(ws)
	}
	return true
}

// DeleteJob permanently deletes a job and its metadata file.
func DeleteJob(id string) bool {
	activeJobs.Lock()
	job := activeJobs.items[id]
	delete(activeJobs.items, id)
	activeJobs.Unlock()

	if job != nil && job.cancel != nil {
		job.cancel()
	}

	removePersistedJob(id)

	if ws, err := WorkspaceDir(id); err == nil {
		_ = os.RemoveAll(ws)
	}

	utils.LogEvent("INFO", "storage instagram job deleted", map[string]any{"jobId": id})
	return true
}

// GetJobSnapshot returns current snapshot of a job.
func GetJobSnapshot(id string) (Snapshot, bool) {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()

	if job != nil {
		return job.Snapshot(), true
	}
	if persisted, err := loadJob(id); err == nil {
		return *persisted, true
	}
	return Snapshot{}, false
}

// GetJobSnapshots returns snapshots of all known Instagram jobs.
func GetJobSnapshots() []Snapshot {
	activeJobs.RLock()
	activeList := make([]*Job, 0, len(activeJobs.items))
	activeMap := make(map[string]bool)
	for _, j := range activeJobs.items {
		activeList = append(activeList, j)
		activeMap[j.ID] = true
	}
	activeJobs.RUnlock()

	var list []Snapshot
	for _, j := range activeList {
		list = append(list, j.Snapshot())
	}

	dir, err := StateDir()
	if err == nil {
		if entries, err := os.ReadDir(dir); err == nil {
			for _, entry := range entries {
				if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
					continue
				}
				id := strings.TrimSuffix(entry.Name(), ".json")
				if !activeMap[id] {
					if snap, err := loadJob(id); err == nil {
						list = append(list, *snap)
					}
				}
			}
		}
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.After(list[j].CreatedAt)
	})
	return list
}

// SetCanonicalID links the Instagram job to a Coordinator parent job ID.
func SetCanonicalID(id, canonicalID string) bool {
	activeJobs.Lock()
	job := activeJobs.items[id]
	activeJobs.Unlock()

	if job != nil {
		job.mu.Lock()
		job.CanonicalID = canonicalID
		job.mu.Unlock()
		persistJob(job)
		return true
	}
	return false
}

// SetVideoDecision updates quality decision for a specific video in the job.
func SetVideoDecision(id, videoID, quality string) error {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()

	if job == nil {
		return fmt.Errorf("không tìm thấy tác vụ instagram: %s", id)
	}

	job.mu.Lock()
	found := false
	for i := range job.Videos {
		if job.Videos[i].ID == videoID {
			job.Videos[i].SelectedQuality = quality
			found = true
			break
		}
	}
	job.mu.Unlock()

	if !found {
		return fmt.Errorf("không tìm thấy video: %s", videoID)
	}
	persistJob(job)
	return nil
}

// ApplyVideoDecisions applies quality decisions for multiple videos and starts conversion if ready.
func ApplyVideoDecisions(id string, decisions map[string]string) error {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()

	if job == nil {
		return fmt.Errorf("không tìm thấy tác vụ instagram: %s", id)
	}

	job.mu.Lock()
	for i := range job.Videos {
		vid := job.Videos[i].ID
		if q, ok := decisions[vid]; ok {
			job.Videos[i].SelectedQuality = q
		}
	}
	allDecided := true
	for _, v := range job.Videos {
		if v.OptimizationNeeded && v.SelectedQuality == "" {
			allDecided = false
			break
		}
	}
	job.mu.Unlock()

	persistJob(job)

	if allDecided && job.State == "video_decision_required" {
		workspace, _ := WorkspaceDir(job.ID)
		convertDir := filepath.Join(workspace, ".convert-video")
		go startConversion(job, convertDir)
	}
	return nil
}

// LoadPersistentJobs loads existing Instagram job states on Storage startup.
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
		dl := s.DownloadedBytes
		tot := s.TotalBytes
		if tot > 0 && dl > tot {
			tot = dl
		}
		job := &Job{
			ID:                    s.ID,
			CanonicalID:           s.CanonicalID,
			URL:                   s.URL,
			Filename:              s.Filename,
			Destination:           s.Destination,
			State:                 s.State,
			DownloadedBytes:       dl,
			TotalBytes:            tot,
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
			job.Error = "Máy chủ lưu trữ đã khởi động lại khi đang xử lý media."
		}
		activeJobs.Lock()
		activeJobs.items[job.ID] = job
		activeJobs.Unlock()
		if tot != s.TotalBytes || job.State != s.State {
			persistJob(job)
		}
	}
}
