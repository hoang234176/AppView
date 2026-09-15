package youtube

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
	utils.LogEvent("INFO", "storage youtube stage changed", map[string]any{"jobId": job.ID, "stage": stage})
}

func setJobError(job *Job, code, message string) {
	job.mu.Lock()
	job.State = "error"
	job.ErrorCode = code
	job.Error = message
	job.UpdatedAt = time.Now().UTC()
	job.mu.Unlock()
	persistJob(job)
	utils.LogEvent("ERROR", "storage youtube job error", map[string]any{"jobId": job.ID, "errorCode": code, "error": message})
}

// StartJob initializes and starts an isolated YouTube download job.
func StartJob(id, sourceURL, filename, destination, audioURL string, headers map[string]string) error {
	if id == "" || sourceURL == "" {
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
		headers:     headers,
		ctx:         ctx,
		cancel:      cancel,
	}

	activeJobs.Lock()
	if old := activeJobs.items[id]; old != nil {
		old.cancel()
		pythonapi.CancelConvertJob(id)
	}
	activeJobs.items[id] = job
	activeJobs.Unlock()

	persistJob(job)
	utils.LogEvent("INFO", "storage youtube job created", map[string]any{"jobId": id, "filename": job.Filename, "destination": destination})
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

	job.mu.RLock()
	audioURL := job.audioURL
	job.mu.RUnlock()

	if audioURL != "" {
		videoPart := filepath.Join(workspace, "video.part")
		audioPart := filepath.Join(workspace, "audio.part")

		if err := downloadDualStream(job.ctx, job, job.URL, videoPart, audioURL, audioPart, job.headers); err != nil {
			if job.ctx.Err() == nil {
				setJobError(job, "DOWNLOAD_FAILED", err.Error())
			}
			return
		}
		if job.ctx.Err() != nil {
			return
		}

		muxedFile := filepath.Join(workspace, job.Filename)
		if err := muxVideoAudio(job.ctx, videoPart, audioPart, muxedFile); err != nil {
			if job.ctx.Err() == nil {
				setJobError(job, "MUX_FAILED", err.Error())
			}
			return
		}
		_ = os.Remove(videoPart)
		_ = os.Remove(audioPart)
	} else {
		partPath := filepath.Join(workspace, "download.part")
		_, err := downloadStream(job.ctx, job, job.URL, job.headers, partPath, 0)
		if err != nil {
			if job.ctx.Err() == nil {
				setJobError(job, "DOWNLOAD_FAILED", err.Error())
			}
			return
		}
		if job.ctx.Err() != nil {
			return
		}
		finalInWorkspace := filepath.Join(workspace, job.Filename)
		_ = os.Remove(finalInWorkspace)
		if err := os.Rename(partPath, finalInWorkspace); err != nil {
			if job.ctx.Err() == nil {
				setJobError(job, "STAGE_FAILED", err.Error())
			}
			return
		}
	}

	if job.ctx.Err() != nil {
		return
	}

	job.mu.Lock()
	if job.TotalBytes > 0 && job.DownloadedBytes > job.TotalBytes {
		job.TotalBytes = job.DownloadedBytes
	}
	job.mu.Unlock()
	persistJob(job)

	// Inspect media compatibility
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

	// Compatible video flow: commit directly to destination without creating folder
	if invalidTotal == 0 {
		sourceFile := filepath.Join(workspace, job.Filename)
		if _, err := commitMediaFile(job.ctx, sourceFile, job.Destination, job.Filename, job.ID); err != nil {
			if job.ctx.Err() == nil {
				setJobError(job, "FINALIZE_FAILED", err.Error())
			}
			return
		}
		_ = os.RemoveAll(workspace)
		setJobStage(job, "completed")
		utils.LogInfo("[YOUTUBE] ✓ Tải xuống hoàn tất: %s", job.Filename)
		return
	}

	// Incompatible video flow: create and use .convert-video/ inside workspace
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

	// Direct single-file transcoding
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

	// Finalize & Clean
	if _, statErr := os.Stat(targetPath); statErr != nil {
		setJobError(job, "FINALIZE_FAILED", fmt.Sprintf("file phương tiện trong workspace không tồn tại: %v", statErr))
		return
	}

	if _, err := commitMediaFile(ctx, targetPath, destination, convertedFilename, id); err != nil {
		setJobError(job, "FINALIZE_FAILED", err.Error())
		return
	}

	_ = os.RemoveAll(workspace)
	setJobStage(job, "completed")
	utils.LogInfo("[YOUTUBE] ✓ Tải xuống hoàn tất: %s", job.Filename)
}

// GetJobSnapshot returns the snapshot for a given job ID.
func GetJobSnapshot(id string) (Snapshot, bool) {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()
	if job == nil {
		return Snapshot{}, false
	}
	job.mu.RLock()
	defer job.mu.RUnlock()
	return jobSnapshot(job), true
}

// GetJobSnapshots returns all active/persisted YouTube job snapshots sorted newest first.
func GetJobSnapshots() []Snapshot {
	activeJobs.RLock()
	jobs := make([]*Job, 0, len(activeJobs.items))
	for _, job := range activeJobs.items {
		jobs = append(jobs, job)
	}
	activeJobs.RUnlock()

	result := make([]Snapshot, 0, len(jobs))
	for _, job := range jobs {
		job.mu.RLock()
		result = append(result, jobSnapshot(job))
		job.mu.RUnlock()
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CreatedAt.After(result[j].CreatedAt) })
	return result
}

// SetCanonicalID updates the public parent coordinator job ID.
func SetCanonicalID(id, canonicalID string) bool {
	if strings.TrimSpace(canonicalID) == "" {
		return false
	}
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()
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

// CancelJob cancels an in-progress YouTube job without committing partial files to destination.
func CancelJob(id string) bool {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()
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

// DeleteJob cooperatively cancels and removes the YouTube job and its persisted file.
func DeleteJob(id string) bool {
	activeJobs.Lock()
	job := activeJobs.items[id]
	delete(activeJobs.items, id)
	activeJobs.Unlock()
	if job != nil && job.cancel != nil {
		job.cancel()
	}
	pythonapi.CancelConvertJob(id)
	if workspace, err := WorkspaceDir(id); err == nil {
		_ = os.RemoveAll(workspace)
	}
	removePersistedJob(id)
	return job != nil
}

// SetVideoDecision records a quality choice for an incompatible video.
func SetVideoDecision(id, videoID, quality string) error {
	activeJobs.RLock()
	job := activeJobs.items[id]
	activeJobs.RUnlock()
	if job == nil {
		return fmt.Errorf("không tìm thấy youtube job")
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
		return fmt.Errorf("không tìm thấy youtube job")
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

// LoadPersistentJobs loads existing YouTube job states on Storage startup.
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
			job.Error = "Máy chủ lưu trữ đã khởi động lại khi đang xử lý video."
		}
		activeJobs.Lock()
		activeJobs.items[job.ID] = job
		activeJobs.Unlock()
		if tot != s.TotalBytes || job.State != s.State {
			persistJob(job)
		}
	}
}
