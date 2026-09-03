package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"appview/coordinator/internal/downloadjob"
	"appview/coordinator/internal/logging"
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
	downloads          *downloadjob.Registry
}

func New(workers *worker.Registry, tasks *task.Registry, scheduler *scheduler.Scheduler, defaultMaxAttempts int) *Coordinator {
	return &Coordinator{workers: workers, tasks: tasks, scheduler: scheduler, defaultMaxAttempts: defaultMaxAttempts, downloads: downloadjob.NewRegistry()}
}

func (c *Coordinator) RegisterWorker(id string, capabilities []protocol.Capability, sender worker.Sender) error {
	if id == "" || len(capabilities) == 0 || sender == nil {
		return fmt.Errorf("worker id, capabilities, and connection are required")
	}
	if c.workers.Register(id, capabilities, sender, time.Now().UTC()) {
		logging.Event("INFO", "worker registered", map[string]any{"workerId": id, "capability": capabilities})
		c.tasks.RequeueForWorker(id)
		c.syncFailedDownloadChildren()
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
	return c.createTask(action, payload, retryable, maxAttempts, nil)
}

func (c *Coordinator) createTask(action string, payload json.RawMessage, retryable bool, maxAttempts int, beforeDispatch func(task.Task) error) (task.Task, error) {
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
	logging.Event("INFO", "task created", map[string]any{"taskId": created.ID, "action": created.Action})
	if beforeDispatch != nil {
		if err := beforeDispatch(created); err != nil {
			return task.Task{}, err
		}
	}
	if err := c.dispatch(created.ID); err != nil {
		return task.Task{}, err
	}
	current, _ := c.tasks.Get(created.ID)
	return current, nil
}
func (c *Coordinator) GetTask(id string) (task.Task, bool) { return c.tasks.Get(id) }

type DownloadRequest struct {
	URL         string
	Filename    string
	Destination string
	Password    string
}

func (c *Coordinator) CreateDownload(request DownloadRequest) (downloadjob.Job, error) {
	request.URL = strings.TrimSpace(request.URL)
	request.Filename = strings.TrimSpace(request.Filename)
	request.Destination = strings.TrimSpace(request.Destination)
	if request.URL == "" {
		return downloadjob.Job{}, fmt.Errorf("url is required")
	}
	created, err := c.downloads.Create(downloadjob.NewJob(newID(), downloadjob.CreateRequest{
		URL: request.URL, Filename: request.Filename, Destination: request.Destination, Password: request.Password,
	}))
	if err != nil {
		return downloadjob.Job{}, err
	}
	logging.Event("INFO", "download job created", map[string]any{"jobId": created.ID, "state": downloadjob.Resolving, "destination": created.Destination})
	createdTask, err := c.createTask(string(protocol.ResolveDownload), mustJSON(map[string]string{"url": request.URL}), true, 0, func(child task.Task) error {
		return c.downloads.AttachResolve(created.ID, child.ID)
	})
	if err != nil {
		c.downloads.FailJob(created.ID, downloadjob.FailureResolve, &protocol.ErrorPayload{Code: "RESOLVE_TASK_CREATE_FAILED", Message: "could not create resolve task"})
		logging.Event("ERROR", "download job failed", map[string]any{"jobId": created.ID, "failureStage": downloadjob.FailureResolve, "errorCode": "RESOLVE_TASK_CREATE_FAILED"})
		job, _ := c.downloads.Get(created.ID)
		return job, err
	}
	_ = createdTask
	job, _ := c.downloads.Get(created.ID)
	return job, nil
}

func (c *Coordinator) GetDownload(id string) (downloadjob.Job, bool) { return c.downloads.Get(id) }

func (c *Coordinator) TaskAccepted(workerID, taskID string) error {
	_, err := c.tasks.Accept(taskID, workerID)
	if err == nil {
		logging.Event("INFO", "task accepted", map[string]any{"taskId": taskID, "workerId": workerID})
	}
	return err
}
func (c *Coordinator) TaskProgress(workerID, taskID string, progress json.RawMessage) error {
	if err := c.tasks.Progress(taskID, workerID, progress); err != nil {
		return err
	}
	c.downloads.UpdateProgress(taskID, progress)
	logging.Event("DEBUG", "task progress", map[string]any{"taskId": taskID, "workerId": workerID})
	return nil
}
func (c *Coordinator) TaskCompleted(workerID, taskID string, result json.RawMessage) error {
	completed, err := c.tasks.Complete(taskID, workerID, result)
	if err != nil {
		return err
	}
	c.workers.SetStatus(workerID, worker.Idle)
	logging.Event("INFO", "task completed", map[string]any{"taskId": taskID, "workerId": workerID, "action": completed.Action})
	c.handleDownloadCompletion(completed)
	return c.dispatchQueued()
}
func (c *Coordinator) TaskFailed(workerID, taskID string, failure *protocol.ErrorPayload) error {
	if _, err := c.tasks.Fail(taskID, workerID, failure); err != nil {
		return err
	}
	c.workers.SetStatus(workerID, worker.Idle)
	c.downloads.FailChild(taskID, failure)
	fields := map[string]any{"taskId": taskID, "workerId": workerID}
	if job, ok := c.downloads.JobForChild(taskID); ok {
		fields["jobId"] = job.ID
		fields["failureStage"] = job.FailureStage
	}
	if failure != nil {
		fields["errorCode"] = failure.Code
	}
	logging.Event("ERROR", "task failed", fields)
	return c.dispatchQueued()
}

func (c *Coordinator) WorkerDisconnected(workerID string) {
	if _, ok := c.workers.Unregister(workerID); !ok {
		return
	}
	logging.Event("WARN", "worker disconnected; requeueing eligible tasks", map[string]any{"workerId": workerID})
	c.tasks.RequeueForWorker(workerID)
	c.syncFailedDownloadChildren()
	_ = c.dispatchQueued()
}
func (c *Coordinator) RequeueStaleWorkers(timeout time.Duration) {
	for _, id := range c.workers.StaleIDs(time.Now().UTC().Add(-timeout)) {
		c.WorkerDisconnected(id)
	}
}
func (c *Coordinator) WorkerCount() int { return c.workers.Count() }

func (c *Coordinator) handleDownloadCompletion(completed task.Task) {
	if completed.Action == string(protocol.ResolveDownload) {
		var result struct {
			DownloadURL string `json:"downloadUrl"`
			Filename    string `json:"filename"`
		}
		if err := json.Unmarshal(completed.Result, &result); err != nil {
			c.downloads.FailChild(completed.ID, &protocol.ErrorPayload{Code: "INVALID_RESOLVE_RESULT", Message: "resolver returned an invalid result"})
			return
		}
		job, storageRequest, shouldCreate, err := c.downloads.PrepareStorage(completed.ID, strings.TrimSpace(result.DownloadURL), strings.TrimSpace(result.Filename))
		if err != nil {
			c.downloads.FailChild(completed.ID, &protocol.ErrorPayload{Code: "INVALID_RESOLVE_RESULT", Message: "resolver result is missing required download metadata"})
			return
		}
		if !shouldCreate {
			return
		}
		logging.Event("INFO", "download job transition", map[string]any{"jobId": job.ID, "state": downloadjob.Downloading, "resolveTaskId": completed.ID, "filename": storageRequest.Filename})
		payload := mustJSON(map[string]string{
			"url": storageRequest.URL, "filename": storageRequest.Filename,
			"destination": storageRequest.Destination, "password": storageRequest.Password,
		})
		if storageTask, err := c.createTask(string(protocol.DownloadFile), payload, true, 0, func(child task.Task) error {
			return c.downloads.AttachStorage(job.ID, child.ID)
		}); err != nil {
			c.downloads.FailJob(job.ID, downloadjob.FailureStorage, &protocol.ErrorPayload{Code: "STORAGE_TASK_CREATE_FAILED", Message: "could not create storage task"})
			logging.Event("ERROR", "download job failed", map[string]any{"jobId": job.ID, "failureStage": downloadjob.FailureStorage, "errorCode": "STORAGE_TASK_CREATE_FAILED"})
		} else {
			logging.Event("INFO", "storage child created", map[string]any{"jobId": job.ID, "storageTaskId": storageTask.ID, "filename": storageRequest.Filename})
		}
		return
	}
	if completed.Action == string(protocol.DownloadFile) {
		c.downloads.CompleteStorage(completed.ID, completed.Result)
		fields := map[string]any{"storageTaskId": completed.ID, "state": downloadjob.Completed}
		if job, ok := c.downloads.JobForChild(completed.ID); ok {
			fields["jobId"] = job.ID
		}
		logging.Event("INFO", "download job completed", fields)
	}
}

func (c *Coordinator) syncFailedDownloadChildren() {
	for _, childID := range c.downloads.ChildTaskIDs() {
		child, ok := c.tasks.Get(childID)
		if ok && child.State == task.Failed {
			c.downloads.FailChild(childID, child.Error)
		}
	}
}

func mustJSON(value any) json.RawMessage {
	encoded, _ := json.Marshal(value)
	return encoded
}

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
	logging.Event("INFO", "task assigned", map[string]any{"taskId": assigned.ID, "workerId": candidate.ID, "action": assigned.Action})
	return nil
}
func newID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("task-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes)
}
