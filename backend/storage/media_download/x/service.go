package x

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
	utils.LogEvent("INFO", "storage x stage changed", map[string]any{"jobId": job.ID, "stage": stage})
}

func setJobError(job *Job, code, message string) {
	job.mu.Lock()
	job.State = "error"
	job.ErrorCode = code
	job.Error = message
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistJob(job)
	utils.LogEvent("ERROR", "storage x job error", map[string]any{"jobId": job.ID, "errorCode": code, "error": message})
}

// StartJob initializes and starts an isolated X download job.
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
	utils.LogEvent("INFO", "storage x job created", map[string]any{"jobId": id, "filename": job.Filename, "destination": destination})
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

	// 1. Download all items
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
	hasItems := len(job.items) > 0
	hasVideos := false
	for _, it := range job.items {
		if it.Type == "video" {
			hasVideos = true
			break
		}
	}
	isSingleVideo := len(job.items) == 0 && (strings.HasSuffix(strings.ToLower(job.Filename), ".mp4") || strings.HasSuffix(strings.ToLower(job.Filename), ".mov"))
	job.mu.RUnlock()

	// 2a. Photo / Post text only jobs: commit directly without scanning/converting video
	if hasItems && !hasVideos {
		setJobStage(job, "committing")
		if err := commitXMedia(job.ctx, job, workspace); err != nil {
			if job.ctx.Err() != nil {
				setJobStage(job, "cancelled")
				return
			}
			setJobError(job, "COMMIT_FAILED", err.Error())
			return
		}
		_ = os.RemoveAll(workspace)
		setJobStage(job, "completed")
		utils.LogInfo("[X] ✓ Tải xuống hoàn tất: %s", job.Filename)
		return
	}

	// 2b. Video flow (single video or carousel containing video)
	if isSingleVideo || hasVideos {
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

		// Compatible videos: commit directly
		if invalidTotal == 0 {
			setJobStage(job, "committing")
			if hasItems {
				if err := commitXMedia(job.ctx, job, workspace); err != nil {
					if job.ctx.Err() == nil {
						setJobError(job, "COMMIT_FAILED", err.Error())
					}
					return
				}
			} else {
				sourceFile := filepath.Join(workspace, job.Filename)
				if _, err := commitMediaFile(job.ctx, sourceFile, job.Destination, job.Filename, job.ID); err != nil {
					if job.ctx.Err() == nil {
						setJobError(job, "COMMIT_FAILED", err.Error())
					}
					return
				}
			}
			_ = os.RemoveAll(workspace)
			setJobStage(job, "completed")
			utils.LogInfo("[X] ✓ Tải xuống hoàn tất: %s", job.Filename)
			return
		}

		// Video needs optimization: create .convert-video/
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
		return
	}

	// Default fallback: commit all downloaded files directly
	setJobStage(job, "committing")
	if err := commitXMedia(job.ctx, job, workspace); err != nil {
		if job.ctx.Err() != nil {
			setJobStage(job, "cancelled")
			return
		}
		setJobError(job, "COMMIT_FAILED", err.Error())
		return
	}
	_ = os.RemoveAll(workspace)
	setJobStage(job, "completed")
	utils.LogInfo("[X] ✓ Tải xuống hoàn tất: %s", job.Filename)
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
	id := job.ID
	destination := job.Destination
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

	// Commit converted video and companion items
	setJobStage(job, "committing")
	if len(job.items) > 0 {
		_ = os.Rename(targetPath, filepath.Join(workspace, convertedFilename))
		if err := commitXMedia(ctx, job, workspace); err != nil {
			if ctx.Err() == nil {
				setJobError(job, "COMMIT_FAILED", err.Error())
			}
			return
		}
	} else {
		if _, err := commitMediaFile(ctx, targetPath, destination, convertedFilename, id); err != nil {
			if ctx.Err() == nil {
				setJobError(job, "COMMIT_FAILED", err.Error())
			}
			return
		}
	}

	_ = os.RemoveAll(workspace)
	setJobStage(job, "completed")
	utils.LogInfo("[X] ✓ Tải xuống hoàn tất: %s", job.Filename)
}

// CancelJob cancels an active X download job.
func CancelJob(id string) bool {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()

	if job == nil {
		snap, err := loadJob(id)
		if err != nil || snap == nil {
			return false
		}
		if snap.State == "completed" || snap.State == "cancelled" || snap.State == "error" {
			return false
		}
		snap.CancelledFromStage = snap.State
		snap.State = "cancelled"
		snap.UpdatedAt = time.Now().UTC()
		stateDir, err := StateDir()
		if err == nil {
			data, _ := json.MarshalIndent(persistedJob{Version: 1, Job: *snap}, "", "  ")
			_ = os.WriteFile(filepath.Join(stateDir, fmt.Sprintf("%s.json", id)), data, 0644)
		}
		return true
	}

	job.mu.Lock()
	if job.State == "completed" || job.State == "cancelled" || job.State == "error" {
		job.mu.Unlock()
		return false
	}
	job.CancelledFromStage = job.State
	job.State = "cancelled"
	job.UpdatedAt = time.Now().UTC()
	job.cancel()
	job.mu.Unlock()

	persistJob(job)
	utils.LogEvent("INFO", "storage x job cancelled", map[string]any{"jobId": id})
	return true
}

// DeleteJob removes runtime memory state and persisted snapshot of an X job.
func DeleteJob(id string) bool {
	activeJobs.Lock()
	if job := activeJobs.items[id]; job != nil {
		job.cancel()
		delete(activeJobs.items, id)
	}
	activeJobs.Unlock()

	removePersistedJob(id)
	return true
}

// SetVideoDecision sets the selected quality for an unoptimized video.
func SetVideoDecision(id, videoID, quality string) error {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()

	if job == nil {
		return fmt.Errorf("không tìm thấy tác vụ X: %s", id)
	}

	job.mu.Lock()
	defer job.mu.Unlock()

	found := false
	for i := range job.Videos {
		if job.Videos[i].ID == videoID || videoID == "" {
			job.Videos[i].SelectedQuality = quality
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("không tìm thấy video %s trong tác vụ %s", videoID, id)
	}

	persistJob(job)
	return nil
}

// ApplyVideoDecisions applies decisions and resumes conversion if all decisions are met.
func ApplyVideoDecisions(id string, decisions map[string]string) error {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()

	if job == nil {
		return fmt.Errorf("không tìm thấy tác vụ X: %s", id)
	}

	job.mu.Lock()
	for vID, q := range decisions {
		for i := range job.Videos {
			if job.Videos[i].ID == vID {
				job.Videos[i].SelectedQuality = q
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
	job.mu.Unlock()

	persistJob(job)

	if allDecided && job.State == "video_decision_required" {
		workspace, err := WorkspaceDir(job.ID)
		if err != nil {
			return err
		}
		convertDir := filepath.Join(workspace, ".convert-video")
		go startConversion(job, convertDir)
	}

	return nil
}

// GetJobSnapshot returns the current snapshot of an X job.
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

// GetJobSnapshots returns all active and persisted X job snapshots.
func GetJobSnapshots() []Snapshot {
	seen := make(map[string]bool)
	var result []Snapshot

	activeJobs.RLock()
	for _, j := range activeJobs.items {
		seen[j.ID] = true
		result = append(result, j.Snapshot())
	}
	activeJobs.RUnlock()

	stateDir, err := StateDir()
	if err == nil {
		entries, _ := os.ReadDir(stateDir)
		for _, entry := range entries {
			if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
				id := strings.TrimSuffix(entry.Name(), ".json")
				if !seen[id] {
					if snap, err := loadJob(id); err == nil && snap != nil {
						seen[id] = true
						result = append(result, *snap)
					}
				}
			}
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})
	return result
}

// SetCanonicalID updates the canonical Coordinator Job ID.
func SetCanonicalID(id, canonicalID string) bool {
	activeJobs.Lock()
	defer activeJobs.Unlock()

	job := activeJobs.items[id]
	if job == nil {
		return false
	}

	job.mu.Lock()
	job.CanonicalID = canonicalID
	job.mu.Unlock()

	persistJob(job)
	return true
}
