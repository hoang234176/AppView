package downloadjob

import (
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"appview/coordinator/internal/protocol"
)

type childStage string

const (
	resolveChild childStage = "resolve"
	storageChild childStage = "storage"
)

type childRef struct {
	JobID string
	Stage childStage
}

type Registry struct {
	mu       sync.RWMutex
	jobs     map[string]Job
	children map[string]childRef
}

func NewRegistry() *Registry {
	return &Registry{jobs: make(map[string]Job), children: make(map[string]childRef)}
}

func (r *Registry) Create(job Job) (Job, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.jobs[job.ID]; exists {
		return Job{}, fmt.Errorf("download job %s already exists", job.ID)
	}
	now := time.Now().UTC()
	job.State, job.Stage, job.CreatedAt, job.UpdatedAt = Queued, string(Queued), now, now
	r.jobs[job.ID] = job
	return job.Clone(), nil
}

func (r *Registry) Get(id string) (Job, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	job, ok := r.jobs[id]
	return job.Clone(), ok
}

// List returns stable newest-first snapshots for the client download history.
// It deliberately returns clones, so HTTP/WebSocket callers cannot mutate the
// in-memory orchestration registry.
func (r *Registry) List() []Job {
	r.mu.RLock()
	jobs := make([]Job, 0, len(r.jobs))
	for _, job := range r.jobs {
		jobs = append(jobs, job.Clone())
	}
	r.mu.RUnlock()
	sort.Slice(jobs, func(i, j int) bool { return jobs[i].CreatedAt.After(jobs[j].CreatedAt) })
	return jobs
}

// Delete removes a job from the registry and frees child associations.
func (r *Registry) Delete(id string) (Job, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	job, ok := r.jobs[id]
	if !ok {
		return Job{}, false
	}
	delete(r.jobs, id)
	if job.ResolveTaskID != "" {
		delete(r.children, job.ResolveTaskID)
	}
	if job.StorageTaskID != "" {
		delete(r.children, job.StorageTaskID)
	}
	return job.Clone(), true
}

// MergeStorageHistory imports the local Storage worker's durable projection.
// A snapshot is keyed by the Storage archive ID. When a live Coordinator
// parent already owns that storage child, the existing parent ID is retained;
// after Coordinator restart the archive ID becomes the stable recovered ID.
// A collision from a different worker is rejected rather than merging two
// unrelated local libraries.
func (r *Registry) MergeStorageHistory(workerID string, snapshots []protocol.StorageJobSnapshot) ([]Job, error) {
	if strings.TrimSpace(workerID) == "" {
		return nil, fmt.Errorf("storage worker id is required")
	}
	for i := range snapshots {
		if err := validStorageSnapshot(&snapshots[i]); err != nil {
			return nil, err
		}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	changed := make([]Job, 0, len(snapshots))
	for _, snapshot := range snapshots {
		jobID := snapshot.ID
		if strings.TrimSpace(snapshot.CanonicalID) != "" {
			jobID = snapshot.CanonicalID
		}
		if ref, ok := r.children[snapshot.ID]; ok && ref.Stage == storageChild {
			jobID = ref.JobID
		}
		current, exists := r.jobs[jobID]
		if exists && current.storageWorkerID != "" && current.storageWorkerID != workerID {
			return nil, fmt.Errorf("storage snapshot %s belongs to another worker", snapshot.ID)
		}
		if exists && !current.storageSnapshotUpdatedAt.IsZero() && !snapshot.UpdatedAt.After(current.storageSnapshotUpdatedAt) {
			continue
		}
		next := current
		if !exists {
			next = Job{ID: jobID}
		}
		next.URL = safeSourceURL(snapshot.SourceURL)
		next.SourceURL = next.URL
		if next.StorageTaskID == "" {
			next.StorageTaskID = snapshot.ID
		}
		next.Filename, next.DisplayName, next.Destination = snapshot.Filename, snapshot.Filename, snapshot.Destination
		if snapshot.Source != "" {
			next.Source = snapshot.Source
		} else if next.Source == "" {
			if strings.Contains(next.URL, "youtube.com") || strings.Contains(next.URL, "youtu.be") || strings.Contains(next.SourceURL, "youtube.com") || strings.Contains(next.SourceURL, "youtu.be") || strings.Contains(next.URL, "googlevideo.com") {
				next.Source = "youtube"
			} else if strings.Contains(next.URL, "tiktok.com") || strings.Contains(next.SourceURL, "tiktok.com") || strings.Contains(next.URL, "tiktokcdn.com") {
				next.Source = "tiktok"
			} else if strings.Contains(next.URL, "facebook.com") || strings.Contains(next.URL, "fb.watch") || strings.Contains(next.SourceURL, "facebook.com") || strings.Contains(next.URL, "fbcdn.net") {
				next.Source = "facebook"
			} else if strings.HasSuffix(strings.ToLower(next.Filename), ".zip") || strings.HasSuffix(strings.ToLower(next.Filename), ".rar") || strings.HasSuffix(strings.ToLower(next.Filename), ".7z") || strings.HasSuffix(strings.ToLower(next.Filename), ".tar") || strings.HasSuffix(strings.ToLower(next.Filename), ".gz") {
				next.Source = "archive"
			}
		}
		next.State, next.Stage = State(snapshot.State), snapshot.State
		next.ArchiveDownloaded, next.ArchiveExtracted, next.PasswordRequired = snapshot.ArchiveDownloaded, snapshot.ArchiveExtracted, snapshot.PasswordRequired
		next.TotalVideoCount, next.InvalidVideoCount, next.VideoScanState = snapshot.TotalVideoCount, snapshot.InvalidVideoCount, snapshot.VideoScanState
		next.OptimizationCancelled, next.UnoptimizedVideoCount, next.CancelledFromStage = snapshot.OptimizationCancelled, snapshot.UnoptimizedVideoCount, snapshot.CancelledFromStage
		next.ConversionTotal, next.ConversionCurrent, next.ConversionFailed = snapshot.ConversionTotal, snapshot.ConversionCurrent, snapshot.ConversionFailed
		next.Videos = append([]protocol.VideoOptimization(nil), snapshot.Videos...)
		next.CreatedAt, next.UpdatedAt, next.storageWorkerID, next.storageSnapshotUpdatedAt = snapshot.CreatedAt, snapshot.UpdatedAt, workerID, snapshot.UpdatedAt
		next.Progress = storageProgress(snapshot)
		if snapshot.ErrorCode != "" || snapshot.Error != "" {
			next.Error = &protocol.ErrorPayload{Code: snapshot.ErrorCode, Message: snapshot.Error}
			next.FailureStage = FailureStorage
		} else {
			next.Error, next.FailureStage = nil, ""
		}
		r.jobs[jobID] = next
		changed = append(changed, next.Clone())
	}
	return changed, nil
}

func validStorageSnapshot(snapshot *protocol.StorageJobSnapshot) error {
	if snapshot == nil {
		return fmt.Errorf("storage snapshot is nil")
	}
	if strings.TrimSpace(snapshot.ID) == "" || strings.TrimSpace(snapshot.Filename) == "" || strings.TrimSpace(snapshot.State) == "" {
		return fmt.Errorf("storage snapshot requires id, filename, and state")
	}
	if snapshot.CreatedAt.IsZero() {
		snapshot.CreatedAt = time.Now().UTC()
	}
	if snapshot.UpdatedAt.IsZero() || snapshot.UpdatedAt.Before(snapshot.CreatedAt) {
		snapshot.UpdatedAt = snapshot.CreatedAt
	}
	if snapshot.DownloadedBytes < 0 {
		snapshot.DownloadedBytes = 0
	}
	if snapshot.TotalBytes < 0 {
		snapshot.TotalBytes = 0
	}
	if snapshot.TotalBytes > 0 && snapshot.DownloadedBytes > snapshot.TotalBytes {
		snapshot.TotalBytes = snapshot.DownloadedBytes
	}
	if snapshot.TotalVideoCount < 0 {
		snapshot.TotalVideoCount = 0
	}
	if snapshot.InvalidVideoCount < 0 {
		snapshot.InvalidVideoCount = 0
	}
	if snapshot.InvalidVideoCount > snapshot.TotalVideoCount {
		snapshot.InvalidVideoCount = snapshot.TotalVideoCount
	}
	for _, video := range snapshot.Videos {
		if strings.TrimSpace(video.ID) == "" || strings.TrimSpace(video.RelativePath) == "" || video.SourceSizeBytes < 0 {
			return fmt.Errorf("storage snapshot %s has invalid video", snapshot.ID)
		}
	}
	return nil
}

func safeSourceURL(value string) string {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	parsed.RawQuery, parsed.Fragment, parsed.User = "", "", nil
	return parsed.String()
}

func storageProgress(snapshot protocol.StorageJobSnapshot) json.RawMessage {
	encoded, _ := json.Marshal(map[string]any{
		"state": snapshot.State, "downloadedBytes": snapshot.DownloadedBytes, "totalBytes": snapshot.TotalBytes,
		"speedBytes": snapshot.SpeedBytes, "extractedPercent": snapshot.ExtractedPercent,
		"optimizationCancelled": snapshot.OptimizationCancelled, "unoptimizedVideoCount": snapshot.UnoptimizedVideoCount,
		"cancelledFromStage": snapshot.CancelledFromStage,
		"conversion": map[string]int{"total": snapshot.ConversionTotal, "current": snapshot.ConversionCurrent, "failed": snapshot.ConversionFailed},
	})
	return encoded
}

func (r *Registry) AttachResolve(jobID, taskID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	job, ok := r.jobs[jobID]
	if !ok {
		return fmt.Errorf("download job not found")
	}
	if job.ResolveTaskID != "" {
		return fmt.Errorf("resolve task already attached")
	}
	job.ResolveTaskID, job.CurrentTaskID, job.State, job.Stage, job.UpdatedAt = taskID, taskID, Resolving, string(Resolving), time.Now().UTC()
	r.jobs[jobID] = job
	r.children[taskID] = childRef{JobID: jobID, Stage: resolveChild}
	return nil
}

// PrepareStorage marks the one permitted transition before a storage child is
// created. This makes duplicate resolve completions harmless even if callers
// race: only the first one obtains shouldCreate=true.
func (r *Registry) PrepareStorage(resolveTaskID, resolvedURL, resolvedFilename, audioURL string, headers map[string]string, source string, items ...[]any) (Job, StorageRequest, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ref, ok := r.children[resolveTaskID]
	if !ok || ref.Stage != resolveChild {
		return Job{}, StorageRequest{}, false, nil
	}
	job := r.jobs[ref.JobID]
	if job.State == Failed || job.State == Completed || job.storagePending || job.StorageTaskID != "" {
		return job.Clone(), StorageRequest{}, false, nil
	}
	if resolvedURL == "" || resolvedFilename == "" {
		return Job{}, StorageRequest{}, false, fmt.Errorf("resolver result thiếu downloadUrl hoặc filename")
	}
	// Resolver metadata is authoritative for the archive title. A caller's
	// optional filename is only a temporary display hint before resolution.
	filename := resolvedFilename
	job.Filename, job.DisplayName = filename, filename
	if strings.TrimSpace(source) != "" {
		job.Source = strings.TrimSpace(source)
	} else if job.Source == "" {
		if strings.Contains(job.URL, "youtube.com") || strings.Contains(job.URL, "youtu.be") {
			job.Source = "youtube"
		} else if strings.Contains(job.URL, "tiktok.com") {
			job.Source = "tiktok"
		} else if strings.Contains(job.URL, "facebook.com") || strings.Contains(job.URL, "fb.watch") || strings.Contains(job.URL, "fb.com") {
			job.Source = "facebook"
		}
	}
	job.State, job.Stage, job.storagePending, job.UpdatedAt = Downloading, string(Downloading), true, time.Now().UTC()
	r.jobs[job.ID] = job
	var itemList []any
	if len(items) > 0 && items[0] != nil {
		itemList = items[0]
	}
	return job.Clone(), StorageRequest{
		URL:         resolvedURL,
		AudioURL:    strings.TrimSpace(audioURL),
		Headers:     headers,
		Filename:    filename,
		Destination: job.Destination,
		Password:    job.password,
		Source:      strings.TrimSpace(job.Source),
		Items:       itemList,
	}, true, nil
}

func (r *Registry) AttachStorage(jobID, taskID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	job, ok := r.jobs[jobID]
	if !ok || !job.storagePending || job.StorageTaskID != "" {
		return fmt.Errorf("storage task cannot be attached")
	}
	job.StorageTaskID, job.CurrentTaskID, job.storagePending, job.UpdatedAt = taskID, taskID, false, time.Now().UTC()
	r.jobs[jobID] = job
	r.children[taskID] = childRef{JobID: jobID, Stage: storageChild}
	return nil
}

func (r *Registry) FailJob(jobID string, stage FailureStage, failure *protocol.ErrorPayload) {
	r.mu.Lock()
	defer r.mu.Unlock()
	job, ok := r.jobs[jobID]
	if !ok || job.State == Completed || job.State == Failed {
		return
	}
	job.State, job.Stage, job.Error, job.FailureStage, job.storagePending, job.UpdatedAt = Failed, string(Failed), cloneError(failure), stage, false, time.Now().UTC()
	r.jobs[jobID] = job
}

func (r *Registry) FailChild(taskID string, failure *protocol.ErrorPayload) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ref, ok := r.children[taskID]
	if !ok {
		return
	}
	job := r.jobs[ref.JobID]
	if job.State == Completed || job.State == Failed {
		return
	}
	// Storage deliberately reports password_required as a task failure so its
	// monitor can finish. It is nevertheless a recoverable archive state, not
	// a terminal parent failure: retain the canonical action required by Web
	// and Mobile rather than overwriting the preceding storage.history update.
	if ref.Stage == storageChild && failure != nil && failure.Code == "PASSWORD_REQUIRED" {
		job.State, job.Stage, job.PasswordRequired, job.Error, job.FailureStage, job.storagePending, job.UpdatedAt = State("password_required"), "password_required", true, cloneError(failure), FailureStorage, false, time.Now().UTC()
		r.jobs[job.ID] = job
		return
	}
	if ref.Stage == storageChild && failure != nil && failure.Code == "STORAGE_JOB_CANCELLED" {
		job.State, job.Stage, job.PasswordRequired, job.Error, job.FailureStage, job.storagePending, job.UpdatedAt = State("cancelled"), "cancelled", false, nil, "", false, time.Now().UTC()
		r.jobs[job.ID] = job
		return
	}
	stage := FailureResolve
	if ref.Stage == storageChild {
		stage = FailureStorage
	}
	job.State, job.Stage, job.Error, job.FailureStage, job.storagePending, job.UpdatedAt = Failed, string(Failed), cloneError(failure), stage, false, time.Now().UTC()
	r.jobs[job.ID] = job
}

func (r *Registry) CompleteStorage(taskID string, result json.RawMessage) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ref, ok := r.children[taskID]
	if !ok || ref.Stage != storageChild {
		return
	}
	job := r.jobs[ref.JobID]
	if job.State == Failed || job.State == Completed {
		return
	}
	job.State, job.Stage, job.Result, job.Progress, job.UpdatedAt = Completed, string(Completed), append(json.RawMessage(nil), result...), nil, time.Now().UTC()
	r.jobs[job.ID] = job
}

func (r *Registry) UpdateProgress(taskID string, progress json.RawMessage) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ref, ok := r.children[taskID]
	if !ok {
		return
	}
	job := r.jobs[ref.JobID]
	if job.State == Completed || job.State == Failed {
		return
	}
	job.Progress, job.UpdatedAt = append(json.RawMessage(nil), progress...), time.Now().UTC()
	var storageProgress struct {
		State string `json:"state"`
	}
	if json.Unmarshal(progress, &storageProgress) == nil && storageProgress.State != "" {
		job.State, job.Stage = State(storageProgress.State), storageProgress.State
	}
	r.jobs[job.ID] = job
}

func (r *Registry) ChildTaskIDs() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ids := make([]string, 0, len(r.children))
	for id := range r.children {
		ids = append(ids, id)
	}
	return ids
}

// JobForChild returns the parent snapshot for structured trace logging. It
// does not expose the private password field.
func (r *Registry) JobForChild(taskID string) (Job, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ref, ok := r.children[taskID]
	if !ok {
		return Job{}, false
	}
	job, ok := r.jobs[ref.JobID]
	return job.Clone(), ok
}

// StorageWorkerForJob identifies the one Storage worker that owns a recovered
// durable archive, avoiding cross-library control requests.
func (r *Registry) StorageWorkerForJob(jobID string) (string, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	job, ok := r.jobs[jobID]
	return job.storageWorkerID, ok && job.storageWorkerID != ""
}

func cloneError(failure *protocol.ErrorPayload) *protocol.ErrorPayload {
	if failure == nil {
		return &protocol.ErrorPayload{Code: "TASK_FAILED", Message: "worker reported task failure"}
	}
	copy := *failure
	return &copy
}
