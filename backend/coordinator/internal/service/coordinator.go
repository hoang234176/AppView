package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/scheduler"
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
)

type Coordinator struct {
	workers            *worker.Registry
	tasks              *task.Registry
	scheduler          *scheduler.Scheduler
	defaultMaxAttempts int
}

func New(workers *worker.Registry, tasks *task.Registry, scheduler *scheduler.Scheduler, defaultMaxAttempts int) *Coordinator {
	return &Coordinator{workers: workers, tasks: tasks, scheduler: scheduler, defaultMaxAttempts: defaultMaxAttempts}
}

func (c *Coordinator) RegisterWorker(id string, capabilities []protocol.Capability, sender worker.Sender) error {
	if id == "" || len(capabilities) == 0 || sender == nil {
		return fmt.Errorf("worker id, capabilities, and connection are required")
	}
	if c.workers.Register(id, capabilities, sender, time.Now().UTC()) {
		c.tasks.RequeueForWorker(id)
	}
	return c.dispatchQueued()
}
func (c *Coordinator) Heartbeat(id string) error {
	if !c.workers.Heartbeat(id, time.Now().UTC()) {
		return fmt.Errorf("unknown worker")
	}
	return nil
}

func (c *Coordinator) CreateTask(action string, payload json.RawMessage, retryable bool, maxAttempts int) (task.Task, error) {
	if action == "" {
		return task.Task{}, fmt.Errorf("action is required")
	}
	if len(payload) > 0 && !json.Valid(payload) {
		return task.Task{}, fmt.Errorf("payload must be valid JSON")
	}
	if maxAttempts <= 0 {
		maxAttempts = c.defaultMaxAttempts
	}
	created, err := c.tasks.Create(task.Task{ID: newID(), Action: action, Payload: payload, Retryable: retryable, MaxAttempts: maxAttempts})
	if err != nil {
		return task.Task{}, err
	}
	if err := c.dispatch(created.ID); err != nil {
		return task.Task{}, err
	}
	current, _ := c.tasks.Get(created.ID)
	return current, nil
}
func (c *Coordinator) GetTask(id string) (task.Task, bool) { return c.tasks.Get(id) }

func (c *Coordinator) TaskAccepted(workerID, taskID string) error {
	_, err := c.tasks.Accept(taskID, workerID)
	return err
}
func (c *Coordinator) TaskProgress(workerID, taskID string, progress json.RawMessage) error {
	return c.tasks.Progress(taskID, workerID, progress)
}
func (c *Coordinator) TaskCompleted(workerID, taskID string, result json.RawMessage) error {
	if _, err := c.tasks.Complete(taskID, workerID, result); err != nil {
		return err
	}
	c.workers.SetStatus(workerID, worker.Idle)
	return c.dispatchQueued()
}
func (c *Coordinator) TaskFailed(workerID, taskID string, failure *protocol.ErrorPayload) error {
	if _, err := c.tasks.Fail(taskID, workerID, failure); err != nil {
		return err
	}
	c.workers.SetStatus(workerID, worker.Idle)
	return c.dispatchQueued()
}

func (c *Coordinator) WorkerDisconnected(workerID string) {
	if _, ok := c.workers.Unregister(workerID); !ok {
		return
	}
	c.tasks.RequeueForWorker(workerID)
	_ = c.dispatchQueued()
}
func (c *Coordinator) RequeueStaleWorkers(timeout time.Duration) {
	for _, id := range c.workers.StaleIDs(time.Now().UTC().Add(-timeout)) {
		c.WorkerDisconnected(id)
	}
}
func (c *Coordinator) WorkerCount() int { return c.workers.Count() }

func (c *Coordinator) dispatchQueued() error {
	for _, queued := range c.tasks.Queued() {
		if err := c.dispatch(queued.ID); err != nil {
			return err
		}
	}
	return nil
}
func (c *Coordinator) dispatch(taskID string) error {
	pending, ok := c.tasks.Get(taskID)
	if !ok || pending.State != task.Queued {
		return nil
	}
	candidate, found := c.scheduler.Select(pending, c.workers.IdleFor(pending.Action))
	if !found {
		return nil
	}
	assigned, err := c.tasks.Assign(taskID, candidate.ID)
	if err != nil {
		return err
	}
	if !c.workers.SetStatus(candidate.ID, worker.Busy) {
		c.tasks.RequeueForWorker(candidate.ID)
		return nil
	}
	if err := candidate.Sender.Send(protocol.Message{Type: protocol.TaskAssign, TaskID: assigned.ID, Action: assigned.Action, Payload: assigned.Payload}); err != nil {
		c.WorkerDisconnected(candidate.ID)
		return nil
	}
	return nil
}
func newID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("task-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes)
}
