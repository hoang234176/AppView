package task

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"appview/coordinator/internal/protocol"
)

type Registry struct {
	mu    sync.RWMutex
	tasks map[string]Task
}

func NewRegistry() *Registry { return &Registry{tasks: make(map[string]Task)} }

func (r *Registry) Create(task Task) (Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.tasks[task.ID]; exists {
		return Task{}, fmt.Errorf("task %s already exists", task.ID)
	}
	if len(task.Payload) == 0 {
		task.Payload = json.RawMessage(`{}`)
	}
	task.State, task.CreatedAt, task.UpdatedAt = Queued, time.Now().UTC(), time.Now().UTC()
	r.tasks[task.ID] = task
	return task.Clone(), nil
}
func (r *Registry) Get(id string) (Task, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	task, ok := r.tasks[id]
	return task.Clone(), ok
}

// ReleaseTransient removes queued/terminal preview work. Active work is
// returned so its owner can cancel it and await the worker acknowledgement.
func (r *Registry) ReleaseTransient(id string) (Task, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	current, ok := r.tasks[id]
	if !ok {
		return Task{}, false
	}
	if current.State == Queued || current.State == Completed || current.State == Failed {
		delete(r.tasks, id)
		return Task{}, false
	}
	return current.Clone(), true
}

func (r *Registry) Assign(id, workerID string) (Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	task, ok := r.tasks[id]
	if !ok {
		return Task{}, fmt.Errorf("task not found")
	}
	if err := ValidateTransition(task.State, Assigned); err != nil {
		return Task{}, err
	}
	task.State, task.AssignedWorkerID, task.Attempts, task.UpdatedAt = Assigned, workerID, task.Attempts+1, time.Now().UTC()
	r.tasks[id] = task
	return task.Clone(), nil
}
func (r *Registry) Accept(id, workerID string) (Task, error) {
	return r.transitionOwned(id, workerID, Processing)
}
func (r *Registry) Complete(id, workerID string, result json.RawMessage) (Task, error) {
	return r.finishOwned(id, workerID, Completed, result, nil)
}
func (r *Registry) Fail(id, workerID string, failure *protocol.ErrorPayload) (Task, error) {
	return r.finishOwned(id, workerID, Failed, nil, failure)
}

// Publish terminal state and its result atomically: transient preview cleanup
// may remove the record as soon as observers see a terminal state.
func (r *Registry) finishOwned(id, workerID string, next State, result json.RawMessage, failure *protocol.ErrorPayload) (Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	current, ok := r.tasks[id]
	if !ok {
		return Task{}, fmt.Errorf("task not found")
	}
	if current.AssignedWorkerID != workerID {
		return Task{}, fmt.Errorf("worker does not own task")
	}
	if err := ValidateTransition(current.State, next); err != nil {
		return Task{}, err
	}
	current.State, current.UpdatedAt = next, time.Now().UTC()
	current.Result = append(json.RawMessage(nil), result...)
	current.Error = failure
	r.tasks[id] = current
	return current.Clone(), nil
}
func (r *Registry) Progress(id, workerID string, progress json.RawMessage) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	task, ok := r.tasks[id]
	if !ok {
		return fmt.Errorf("task not found")
	}
	if task.AssignedWorkerID != workerID || task.State != Processing {
		return fmt.Errorf("worker does not own processing task")
	}
	task.Progress, task.UpdatedAt = append(json.RawMessage(nil), progress...), time.Now().UTC()
	r.tasks[id] = task
	return nil
}
func (r *Registry) transitionOwned(id, workerID string, next State) (Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	task, ok := r.tasks[id]
	if !ok {
		return Task{}, fmt.Errorf("task not found")
	}
	if task.AssignedWorkerID != workerID {
		return Task{}, fmt.Errorf("worker does not own task")
	}
	if err := ValidateTransition(task.State, next); err != nil {
		return Task{}, err
	}
	task.State, task.UpdatedAt = next, time.Now().UTC()
	r.tasks[id] = task
	return task.Clone(), nil
}

// RequeueForWorker returns queued tasks. Terminal tasks remain untouched.
func (r *Registry) RequeueForWorker(workerID string) []Task {
	r.mu.Lock()
	defer r.mu.Unlock()
	result := make([]Task, 0)
	for id, current := range r.tasks {
		if current.AssignedWorkerID != workerID || (current.State != Assigned && current.State != Processing) {
			continue
		}
		if current.Retryable && current.Attempts < current.MaxAttempts {
			current.State, current.AssignedWorkerID, current.UpdatedAt = Queued, "", time.Now().UTC()
			r.tasks[id] = current
			result = append(result, current.Clone())
		} else {
			current.State, current.UpdatedAt = Failed, time.Now().UTC()
			current.Error = &protocol.ErrorPayload{Code: "WORKER_DISCONNECTED", Message: "worker disconnected before task completed"}
			r.tasks[id] = current
		}
	}
	return result
}
func (r *Registry) Queued() []Task {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]Task, 0)
	for _, current := range r.tasks {
		if current.State == Queued {
			result = append(result, current.Clone())
		}
	}
	return result
}
