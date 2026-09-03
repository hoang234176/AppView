package downloadjob

import (
	"encoding/json"
	"fmt"
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
	job.State, job.CreatedAt, job.UpdatedAt = Queued, now, now
	r.jobs[job.ID] = job
	return job.Clone(), nil
}

func (r *Registry) Get(id string) (Job, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	job, ok := r.jobs[id]
	return job.Clone(), ok
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
	job.ResolveTaskID, job.CurrentTaskID, job.State, job.UpdatedAt = taskID, taskID, Resolving, time.Now().UTC()
	r.jobs[jobID] = job
	r.children[taskID] = childRef{JobID: jobID, Stage: resolveChild}
	return nil
}

// PrepareStorage marks the one permitted transition before a storage child is
// created. This makes duplicate resolve completions harmless even if callers
// race: only the first one obtains shouldCreate=true.
func (r *Registry) PrepareStorage(resolveTaskID, resolvedURL, resolvedFilename string) (Job, StorageRequest, bool, error) {
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
	filename := job.Filename
	if filename == "" {
		filename = resolvedFilename
	}
	job.State, job.storagePending, job.UpdatedAt = Downloading, true, time.Now().UTC()
	r.jobs[job.ID] = job
	return job.Clone(), StorageRequest{URL: resolvedURL, Filename: filename, Destination: job.Destination, Password: job.password}, true, nil
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
	job.State, job.Error, job.FailureStage, job.storagePending, job.UpdatedAt = Failed, cloneError(failure), stage, false, time.Now().UTC()
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
	stage := FailureResolve
	if ref.Stage == storageChild {
		stage = FailureStorage
	}
	job.State, job.Error, job.FailureStage, job.storagePending, job.UpdatedAt = Failed, cloneError(failure), stage, false, time.Now().UTC()
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
	job.State, job.Result, job.Progress, job.UpdatedAt = Completed, append(json.RawMessage(nil), result...), nil, time.Now().UTC()
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

func cloneError(failure *protocol.ErrorPayload) *protocol.ErrorPayload {
	if failure == nil {
		return &protocol.ErrorPayload{Code: "TASK_FAILED", Message: "worker reported task failure"}
	}
	copy := *failure
	return &copy
}
