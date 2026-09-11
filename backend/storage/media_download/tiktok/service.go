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

	// 2. Commit
	setJobStage(job, "committing")
	if err := commitTikTokMedia(job.ctx, job, workspace); err != nil {
		if job.ctx.Err() != nil {
			setJobStage(job, "cancelled")
			return
		}
		setJobError(job, "COMMIT_FAILED", err.Error())
		return
	}

	// 3. Complete & Cleanup workspace
	setJobStage(job, "completed")
	_ = os.RemoveAll(workspace)
}

func CancelJob(id string) bool {
	activeJobs.Lock()
	job := activeJobs.items[id]
	activeJobs.Unlock()

	if job == nil {
		return false
	}
	job.cancel()
	setJobStage(job, "cancelled")
	return true
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
