package facebook

import (
	"context"
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
	utils.LogEvent("INFO", "storage facebook stage changed", map[string]any{"jobId": job.ID, "stage": stage})
}

func setJobError(job *Job, code, message string) {
	job.mu.Lock()
	job.State = "error"
	job.ErrorCode = code
	job.Error = message
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistJob(job)
	utils.LogEvent("ERROR", "storage facebook job error", map[string]any{"jobId": job.ID, "errorCode": code, "error": message})
}

// StartJob initializes and starts an isolated Facebook download job.
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
	utils.LogEvent("INFO", "storage facebook job created", map[string]any{"jobId": id, "filename": job.Filename, "destination": destination})
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

	// 2a. Luồng ảnh (Photo/Album): commit thẳng vào thư mục đích mà không qua video scan/convert
	if isPhotoJob {
		setJobStage(job, "committing")
		if err := commitFacebookMedia(job.ctx, job, workspace); err != nil {
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

	// 2b. Luồng video: Bắt đầu từ bước scan như video YouTube/TikTok
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

// CancelJob cancels the in-progress Facebook job cooperatively.
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
		return true
	}
	cancel := job.cancel
	job.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	setJobStage(job, "cancelled")
	return true
}

// GetJobSnapshot returns the current snapshot of a Facebook job.
func GetJobSnapshot(id string) (Snapshot, bool) {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()

	if job != nil {
		return job.Snapshot(), true
	}

	snap, err := loadJob(id)
	if err == nil && snap != nil {
		return *snap, true
	}
	return Snapshot{}, false
}

// GetJobSnapshots returns all in-memory and persisted Facebook job snapshots.
func GetJobSnapshots() []Snapshot {
	seen := make(map[string]bool)
	var list []Snapshot

	activeJobs.RLock()
	for _, j := range activeJobs.items {
		snap := j.Snapshot()
		seen[snap.ID] = true
		list = append(list, snap)
	}
	activeJobs.RUnlock()

	stateDir, err := StateDir()
	if err == nil {
		entries, _ := os.ReadDir(stateDir)
		for _, e := range entries {
			if strings.HasSuffix(e.Name(), ".json") {
				id := strings.TrimSuffix(e.Name(), ".json")
				if !seen[id] {
					if snap, err := loadJob(id); err == nil && snap != nil {
						seen[id] = true
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

// SetCanonicalID links the Facebook job to a Coordinator parent job ID.
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
		return fmt.Errorf("không tìm thấy tác vụ facebook: %s", id)
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
		return fmt.Errorf("không tìm thấy tác vụ facebook: %s", id)
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
