package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"path"
	"strings"
	"sync"
	"time"

	"appview/coordinator/internal/downloadjob"
	"appview/coordinator/internal/logging"
	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/realtime"
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
	realtime           *realtime.Hub
	downloadEvents     struct {
		sync.Mutex
		lastProgress map[string]time.Time
	}
	pinnedTasks       sync.Map // map[task ID]Storage worker ID for durable controls
	busyControls      sync.Map // map[task ID]struct{}; completion must not idle an active archive worker
	abandonedPreviews sync.Map // active previews waiting for cancellation acknowledgement
	pendingRPC        sync.Map // map[requestID (string)]chan protocol.Message
	storageInfo       struct {
		sync.RWMutex
		workerID string
		value    protocol.StorageInfo
	}
}

func New(workers *worker.Registry, tasks *task.Registry, scheduler *scheduler.Scheduler, defaultMaxAttempts int) *Coordinator {
	coordinator := &Coordinator{workers: workers, tasks: tasks, scheduler: scheduler, defaultMaxAttempts: defaultMaxAttempts, downloads: downloadjob.NewRegistry(), realtime: realtime.NewHub()}
	coordinator.downloadEvents.lastProgress = make(map[string]time.Time)
	return coordinator
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
	URL             string
	Filename        string
	Destination     string
	Password        string
	Quality         int
	SelectedIndices []int
	MediaType       string
}

func (c *Coordinator) CreateDownload(request DownloadRequest) (downloadjob.Job, error) {
	request.URL = strings.TrimSpace(request.URL)
	request.Filename = strings.TrimSpace(request.Filename)
	request.Destination = strings.TrimSpace(request.Destination)
	if request.URL == "" {
		return downloadjob.Job{}, fmt.Errorf("url is required")
	}
	if request.Quality < 0 {
		return downloadjob.Job{}, fmt.Errorf("quality must be a positive resolution")
	}
	created, err := c.downloads.Create(downloadjob.NewJob(newID(), downloadjob.CreateRequest{
		URL: request.URL, Filename: request.Filename, Destination: request.Destination, Password: request.Password,
	}))
	if err != nil {
		return downloadjob.Job{}, err
	}
	logging.Event("INFO", fmt.Sprintf("Bắt đầu xử lý link tải: %s (Đích: %s)", logging.SafeURL(request.URL), created.Destination), map[string]any{"jobId": created.ID, "state": downloadjob.Resolving, "destination": created.Destination})
	resolvePayload := map[string]any{"url": request.URL}
	if request.Quality > 0 {
		resolvePayload["quality"] = request.Quality
	}
	if len(request.SelectedIndices) > 0 {
		resolvePayload["selected_indices"] = request.SelectedIndices
	}
	if strings.TrimSpace(request.MediaType) != "" {
		resolvePayload["media_type"] = strings.TrimSpace(request.MediaType)
	}
	createdTask, err := c.createTask(string(protocol.ResolveDownload), mustJSON(resolvePayload), true, 0, func(child task.Task) error {
		return c.downloads.AttachResolve(created.ID, child.ID)
	})
	if err != nil {
		c.downloads.FailJob(created.ID, downloadjob.FailureResolve, &protocol.ErrorPayload{Code: "RESOLVE_TASK_CREATE_FAILED", Message: "could not create resolve task"})
		logging.Event("ERROR", "download job failed", map[string]any{"jobId": created.ID, "failureStage": downloadjob.FailureResolve, "errorCode": "RESOLVE_TASK_CREATE_FAILED"})
		job, _ := c.downloads.Get(created.ID)
		return job, err
	}
	logging.Event("INFO", fmt.Sprintf("Giao việc phân tích link cho Download worker (Task: %s)...", createdTask.ID), map[string]any{"jobId": created.ID, "resolveTaskId": createdTask.ID})
	_ = createdTask
	job, _ := c.downloads.Get(created.ID)
	c.notifyDownload(job, "created")
	return job, nil
}

func (c *Coordinator) GetDownload(id string) (downloadjob.Job, bool) { return c.downloads.Get(id) }
func (c *Coordinator) ListDownloads() []downloadjob.Job              { return c.downloads.List() }
func (c *Coordinator) StorageInfo(workerID string, info *protocol.StorageInfo) error {
	if info == nil || strings.TrimSpace(info.DisplayName) == "" || info.TotalBytes < 0 || info.UsedBytes < 0 || info.AvailableBytes < 0 {
		return fmt.Errorf("invalid storage info")
	}
	if _, ok := c.workers.Get(workerID); !ok {
		return fmt.Errorf("unknown storage worker")
	}
	c.storageInfo.Lock()
	c.storageInfo.workerID, c.storageInfo.value = workerID, *info
	c.storageInfo.Unlock()
	return nil
}
func (c *Coordinator) GetStorageInfo() (protocol.StorageInfo, bool) {
	c.storageInfo.RLock()
	defer c.storageInfo.RUnlock()
	return c.storageInfo.value, c.storageInfo.workerID != ""
}

// RetryDownload forwards one recovery command to the Storage worker owning
// the durable archive. The password only lives in this short-lived task
// payload and never reaches the canonical job projection.
func (c *Coordinator) RetryDownload(jobID, password string, extractionOnly bool) error {
	operation := "retry"
	if extractionOnly {
		operation = "extract"
	}
	return c.controlDownload(jobID, operation, password)
}

// CancelDownload cooperatively stops the Storage-owned archive workflow while
// retaining its durable history and already committed/downloaded artifacts.
func (c *Coordinator) CancelDownload(jobID string) error {
	job, ok := c.downloads.Get(jobID)
	if !ok {
		return fmt.Errorf("download job not found")
	}
	if job.State == downloadjob.Completed {
		return fmt.Errorf("completed download cannot be cancelled")
	}
	if job.State == "cancelled" {
		return nil
	}
	return c.controlDownload(jobID, "cancel", "")
}

// DeleteDownload stops active work (if running), forwards a delete command to
// the owning Storage worker (if any) to remove persisted artifacts/state from disk,
// removes the job from Coordinator memory, and notifies clients.
func (c *Coordinator) DeleteDownload(jobID string) error {
	job, ok := c.downloads.Get(jobID)
	if !ok {
		return nil
	}
	if job.State != downloadjob.Completed && job.State != "cancelled" && job.State != "failed" {
		_ = c.CancelDownload(jobID)
	}
	_ = c.controlDownload(jobID, "delete", "")

	deletedJob, removed := c.downloads.Delete(jobID)
	if removed {
		deletedJob.State = "deleted"
		c.notifyDownload(deletedJob, "deleted")
	}
	return nil
}

// DecideVideo forwards a single persisted per-video quality choice to the
// owning Storage worker. Coordinator validates only public canonical shape;
// Storage remains authoritative for allowed options and filesystem work.
func (c *Coordinator) DecideVideo(jobID, videoID, quality string) error {
	job, ok := c.downloads.Get(jobID)
	if !ok {
		return fmt.Errorf("download job not found")
	}
	found := false
	for _, video := range job.Videos {
		if video.ID == strings.TrimSpace(videoID) {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("video not found")
	}
	if strings.TrimSpace(quality) == "" {
		return fmt.Errorf("quality is required")
	}
	return c.controlDownloadPayload(jobID, map[string]string{"operation": "video_decision", "archiveTaskId": job.StorageTaskID, "videoId": videoID, "quality": strings.ToLower(strings.TrimSpace(quality))})
}

// ApplyVideoDecisions forwards complete decisions and an apply signal to the
// owning Storage worker.
func (c *Coordinator) ApplyVideoDecisions(jobID string, decisions map[string]string) error {
	job, ok := c.downloads.Get(jobID)
	if !ok {
		return fmt.Errorf("download job not found")
	}
	if decisions != nil {
		for videoID, quality := range decisions {
			found := false
			quality = strings.ToLower(strings.TrimSpace(quality))
			for _, video := range job.Videos {
				if video.ID == strings.TrimSpace(videoID) {
					found = true
					allowed := false
					for _, opt := range video.AllowedQualities {
						if opt == quality {
							allowed = true
							break
						}
					}
					if !allowed && len(video.AllowedQualities) > 0 {
						return fmt.Errorf("quality is not allowed for video %s", videoID)
					}
					break
				}
			}
			if !found {
				return fmt.Errorf("video not found: %s", videoID)
			}
		}
	}
	decisionsBytes, _ := json.Marshal(decisions)
	return c.controlDownloadPayload(jobID, map[string]string{
		"operation":     "video_apply",
		"archiveTaskId": job.StorageTaskID,
		"decisions":     string(decisionsBytes),
	})
}

func (c *Coordinator) controlDownload(jobID, operation, password string) error {
	job, ok := c.downloads.Get(jobID)
	if !ok {
		return fmt.Errorf("download job not found")
	}
	return c.controlDownloadPayload(jobID, map[string]string{"operation": operation, "archiveTaskId": job.StorageTaskID, "password": password})
}

func (c *Coordinator) controlDownloadPayload(jobID string, payload map[string]string) error {
	job, ok := c.downloads.Get(jobID)
	if !ok {
		return fmt.Errorf("download job not found")
	}
	workerID, found := c.downloads.StorageWorkerForJob(jobID)
	if !found && job.StorageTaskID != "" {
		if child, exists := c.tasks.Get(job.StorageTaskID); exists {
			workerID = child.AssignedWorkerID
		}
	}
	registered, exists := c.workers.Get(workerID)
	if !exists || !registered.Supports(string(protocol.DownloadFile)) {
		return fmt.Errorf("owning storage worker is unavailable")
	}
	operation := payload["operation"]
	control, err := c.tasks.Create(task.Task{
		ID:          newID(),
		Action:      string(protocol.DownloadFile),
		Payload:     mustJSON(payload),
		Retryable:   false,
		MaxAttempts: c.defaultMaxAttempts,
	})
	if err != nil {
		return err
	}
	logging.Event("INFO", "task created", map[string]any{"taskId": control.ID, "action": control.Action})
	c.pinnedTasks.Store(control.ID, workerID)
	if (operation == "cancel" || operation == "delete" || operation == "video_decision" || operation == "video_apply") && registered.Status == worker.Busy {
		// Cancellation is a cooperative control message for the job already
		// running on this worker; waiting for it to become idle would make
		// cancel/decision ineffective. It does not start a second archive workflow.
		assigned, err := c.tasks.Assign(control.ID, workerID)
		if err != nil {
			return err
		}
		if err := registered.Sender.Send(protocol.Message{Type: protocol.TaskAssign, TaskID: assigned.ID, Action: assigned.Action, Payload: assigned.Payload}); err != nil {
			c.WorkerDisconnected(workerID)
			return nil
		}
		c.pinnedTasks.Delete(control.ID)
		c.busyControls.Store(control.ID, struct{}{})
	} else if err := c.dispatch(control.ID); err != nil {
		return err
	}
	logging.Event("INFO", "download archive retry requested", map[string]any{"jobId": jobID, "operation": operation, "workerId": workerID})
	return nil
}

func (c *Coordinator) TaskAccepted(workerID, taskID string) error {
	_, err := c.tasks.Accept(taskID, workerID)
	if err == nil {
		if _, abandoned := c.abandonedPreviews.Load(taskID); abandoned {
			c.cancelPreviewWorker(workerID, taskID)
		}
		logging.Event("INFO", "task accepted", map[string]any{"taskId": taskID, "workerId": workerID})
	}
	return err
}
func (c *Coordinator) TaskProgress(workerID, taskID string, progress json.RawMessage) error {
	if err := c.tasks.Progress(taskID, workerID, progress); err != nil {
		return err
	}
	c.downloads.UpdateProgress(taskID, progress)
	if job, ok := c.downloads.JobForChild(taskID); ok {
		c.notifyDownload(job, "progress")
	}
	logging.Event("DEBUG", "task progress", map[string]any{"taskId": taskID, "workerId": workerID})
	return nil
}
func (c *Coordinator) TaskCompleted(workerID, taskID string, result json.RawMessage) error {
	completed, err := c.tasks.Complete(taskID, workerID, result)
	if err != nil {
		return err
	}
	if _, busyControl := c.busyControls.LoadAndDelete(taskID); !busyControl {
		c.workers.SetStatus(workerID, worker.Idle)
	}
	logging.Event("INFO", "task completed", map[string]any{"taskId": taskID, "workerId": workerID, "action": completed.Action})
	c.handleDownloadCompletion(completed)
	c.releaseAbandonedPreview(taskID)
	return c.dispatchQueued()
}
func (c *Coordinator) TaskFailed(workerID, taskID string, failure *protocol.ErrorPayload) error {
	if _, err := c.tasks.Fail(taskID, workerID, failure); err != nil {
		return err
	}
	c.workers.SetStatus(workerID, worker.Idle)
	c.downloads.FailChild(taskID, failure)
	c.releaseAbandonedPreview(taskID)
	fields := map[string]any{"taskId": taskID, "workerId": workerID}
	if job, ok := c.downloads.JobForChild(taskID); ok {
		fields["jobId"] = job.ID
		fields["failureStage"] = job.FailureStage
		c.notifyDownload(job, "state_changed")
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
	c.abandonedPreviews.Range(func(key, _ any) bool {
		id := key.(string)
		if current, ok := c.tasks.Get(id); ok && current.AssignedWorkerID == workerID {
			c.releaseAbandonedPreview(id)
		}
		return true
	})
	c.syncFailedDownloadChildren()
	_ = c.dispatchQueued()
}
func (c *Coordinator) RequeueStaleWorkers(timeout time.Duration) {
	for _, id := range c.workers.StaleIDs(time.Now().UTC().Add(-timeout)) {
		c.WorkerDisconnected(id)
	}
}
func (c *Coordinator) WorkerCount() int           { return c.workers.Count() }
func (c *Coordinator) RealtimeHub() *realtime.Hub { return c.realtime }

func (c *Coordinator) FilesystemEvent(workerID string, event *protocol.FilesystemEvent) error {
	if _, ok := c.workers.Get(workerID); !ok {
		return fmt.Errorf("unknown worker")
	}
	if event == nil {
		return fmt.Errorf("invalid filesystem event")
	}
	cleanRel := func(p string) string {
		p = strings.TrimSpace(p)
		p = strings.TrimPrefix(p, "/")
		if p == "." {
			return ""
		}
		return p
	}
	event.Path = cleanRel(event.Path)
	event.OldPath = cleanRel(event.OldPath)
	event.NewPath = cleanRel(event.NewPath)
	event.ParentPath = cleanRel(event.ParentPath)
	event.OldParentPath = cleanRel(event.OldParentPath)
	event.NewParentPath = cleanRel(event.NewParentPath)
	if !validFilesystemEvent(*event) {
		return fmt.Errorf("invalid filesystem event")
	}
	count := c.realtime.Broadcast(*event)
	logging.Event("INFO", "filesystem event broadcast", map[string]any{"workerId": workerID, "eventType": event.Type, "subscriberCount": count, "oldPath": event.OldPath, "newPath": event.NewPath})
	return nil
}

// StorageHistory is the only durable-state ingress. Coordinator does not read
// local state directories; it accepts safe snapshots only from a registered
// Storage download worker and projects them into the public history.
func (c *Coordinator) StorageHistory(workerID string, history *protocol.StorageHistoryPayload) error {
	registered, exists := c.workers.Get(workerID)
	if !exists || !registered.Supports(string(protocol.DownloadFile)) {
		return fmt.Errorf("storage history requires a registered download_file worker")
	}
	if history == nil {
		return fmt.Errorf("storage history is required")
	}
	changed, err := c.downloads.MergeStorageHistory(workerID, history.Jobs)
	if err != nil {
		return err
	}
	for _, job := range changed {
		c.notifyDownload(job, "updated")
	}
	logging.Event("INFO", "storage history synchronized", map[string]any{"workerId": workerID, "jobCount": len(history.Jobs), "changedCount": len(changed)})
	return nil
}

func (c *Coordinator) notifyDownload(job downloadjob.Job, kind string) {
	if job.ID == "" {
		return
	}
	if kind == "progress" {
		c.downloadEvents.Lock()
		last := c.downloadEvents.lastProgress[job.ID]
		if !last.IsZero() && time.Since(last) < 750*time.Millisecond {
			c.downloadEvents.Unlock()
			return
		}
		c.downloadEvents.lastProgress[job.ID] = time.Now()
		c.downloadEvents.Unlock()
	}
	c.realtime.BroadcastDownload(protocol.DownloadEvent{JobID: job.ID, Kind: kind})
}

func validFilesystemEvent(event protocol.FilesystemEvent) bool {
	if !validFilesystemPath(event.Path) || !validFilesystemPath(event.OldPath) || !validFilesystemPath(event.NewPath) || !validFilesystemPath(event.ParentPath) || !validFilesystemPath(event.OldParentPath) || !validFilesystemPath(event.NewParentPath) {
		return false
	}
	switch event.Type {
	case "folder_created":
		return event.NewPath != "" || event.Path != ""
	case "folder_deleted":
		return event.OldPath != "" || event.Path != ""
	case "folder_moved", "folder_renamed":
		return event.OldPath != "" && event.NewPath != ""
	default:
		return false
	}
}

func validFilesystemPath(value string) bool {
	if value == "" {
		return true
	}
	return value != "." && value != ".." && !strings.HasPrefix(value, "../") && path.Clean(value) == value && value[0] != '/'
}

func (c *Coordinator) handleDownloadCompletion(completed task.Task) {
	if _, ok := c.downloads.JobForChild(completed.ID); !ok {
		return
	}
	if completed.Action == string(protocol.ResolveDownload) {
		var result struct {
			DownloadURL string            `json:"downloadUrl"`
			AudioURL    string            `json:"audioUrl,omitempty"`
			Headers     map[string]string `json:"headers,omitempty"`
			Filename    string            `json:"filename"`
			Source      string            `json:"source,omitempty"`
			Items       []any             `json:"items,omitempty"`
		}
		if err := json.Unmarshal(completed.Result, &result); err != nil {
			c.downloads.FailChild(completed.ID, &protocol.ErrorPayload{Code: "INVALID_RESOLVE_RESULT", Message: "resolver returned an invalid result"})
			if job, ok := c.downloads.JobForChild(completed.ID); ok {
				c.notifyDownload(job, "state_changed")
			}
			return
		}
		// Filter safe headers, strictly preventing leakage of cookies or authorization tokens
		safeHeaders := make(map[string]string)
		for k, v := range result.Headers {
			lk := strings.ToLower(strings.TrimSpace(k))
			if lk == "user-agent" || lk == "referer" || lk == "accept" || lk == "accept-language" {
				safeHeaders[k] = v
			}
		}
		job, storageRequest, shouldCreate, err := c.downloads.PrepareStorage(completed.ID, strings.TrimSpace(result.DownloadURL), strings.TrimSpace(result.Filename), strings.TrimSpace(result.AudioURL), safeHeaders, strings.TrimSpace(result.Source), result.Items)
		if err != nil {
			c.downloads.FailChild(completed.ID, &protocol.ErrorPayload{Code: "INVALID_RESOLVE_RESULT", Message: "resolver result is missing required download metadata"})
			if failedJob, ok := c.downloads.JobForChild(completed.ID); ok {
				c.notifyDownload(failedJob, "state_changed")
			}
			return
		}
		if !shouldCreate {
			return
		}
		logging.Event("INFO", fmt.Sprintf("Giải mã link thành công cho tệp: %s (%s). Chuyển tiếp sang Storage worker tải về...", storageRequest.Filename, storageRequest.Source), map[string]any{"jobId": job.ID, "state": downloadjob.Downloading, "resolveTaskId": completed.ID, "filename": storageRequest.Filename})
		payloadMap := map[string]any{
			"url": storageRequest.URL, "filename": storageRequest.Filename,
			"destination": storageRequest.Destination, "password": storageRequest.Password, "parentJobId": job.ID,
		}
		if storageRequest.AudioURL != "" {
			payloadMap["audioUrl"] = storageRequest.AudioURL
		}
		if len(storageRequest.Headers) > 0 {
			payloadMap["headers"] = storageRequest.Headers
		}
		if storageRequest.Source != "" {
			payloadMap["source"] = storageRequest.Source
		}
		if len(storageRequest.Items) > 0 {
			payloadMap["items"] = storageRequest.Items
		}
		payload := mustJSON(payloadMap)
		if storageTask, err := c.createTask(string(protocol.DownloadFile), payload, true, 0, func(child task.Task) error {
			return c.downloads.AttachStorage(job.ID, child.ID)
		}); err != nil {
			c.downloads.FailJob(job.ID, downloadjob.FailureStorage, &protocol.ErrorPayload{Code: "STORAGE_TASK_CREATE_FAILED", Message: "could not create storage task"})
			logging.Event("ERROR", "download job failed", map[string]any{"jobId": job.ID, "failureStage": downloadjob.FailureStorage, "errorCode": "STORAGE_TASK_CREATE_FAILED"})
		} else {
			logging.Event("INFO", fmt.Sprintf("Đã giao việc tải tệp cho Storage worker (Task: %s, File: %s)", storageTask.ID, storageRequest.Filename), map[string]any{"jobId": job.ID, "storageTaskId": storageTask.ID, "filename": storageRequest.Filename})
			if current, ok := c.downloads.Get(job.ID); ok {
				c.notifyDownload(current, "state_changed")
			}
		}
		return
	}
	if completed.Action == string(protocol.DownloadFile) {
		c.downloads.CompleteStorage(completed.ID, completed.Result)
		fields := map[string]any{"storageTaskId": completed.ID, "state": downloadjob.Completed}
		if job, ok := c.downloads.JobForChild(completed.ID); ok {
			fields["jobId"] = job.ID
			c.notifyDownload(job, "state_changed")
			logging.Event("INFO", fmt.Sprintf("✓ Toàn bộ quá trình tải xuống đã hoàn tất thành công: %s (JobId: %s)", job.Filename, job.ID), fields)
		} else {
			logging.Event("INFO", "download job completed", fields)
		}
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
	candidates := c.workers.IdleFor(pending.Action)
	if value, pinned := c.pinnedTasks.Load(taskID); pinned {
		workerID, _ := value.(string)
		candidates = nil
		if candidate, exists := c.workers.Get(workerID); exists && candidate.Status == worker.Idle && candidate.Supports(pending.Action) {
			candidates = []worker.Worker{candidate}
		}
	}
	candidate, found := c.scheduler.Select(pending, candidates)
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
	c.pinnedTasks.Delete(taskID)
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

func (c *Coordinator) GetWorker(id string) (worker.Worker, bool) {
	return c.workers.Get(id)
}

func (c *Coordinator) CallWorkerRPC(ctx context.Context, workerID string, msg protocol.Message) (protocol.Message, error) {
	registered, exists := c.workers.Get(workerID)
	if !exists {
		return protocol.Message{}, fmt.Errorf("worker is unavailable")
	}
	if msg.TaskID == "" {
		msg.TaskID = newID()
	}
	ch := make(chan protocol.Message, 1)
	c.pendingRPC.Store(msg.TaskID, ch)
	defer c.pendingRPC.Delete(msg.TaskID)

	if err := registered.Sender.Send(msg); err != nil {
		c.WorkerDisconnected(workerID)
		return protocol.Message{}, fmt.Errorf("failed to send message to worker: %w", err)
	}

	select {
	case <-ctx.Done():
		return protocol.Message{}, ctx.Err()
	case resp := <-ch:
		return resp, nil
	}
}

func (c *Coordinator) ResolveRPC(taskID string, resp protocol.Message) bool {
	if val, ok := c.pendingRPC.Load(taskID); ok {
		ch := val.(chan protocol.Message)
		select {
		case ch <- resp:
		default:
		}
		return true
	}
	return false
}

func (c *Coordinator) GetCookieStatus(ctx context.Context, platform string) (protocol.CookieStatusResult, error) {
	platform = strings.TrimSpace(platform)
	if platform == "" {
		return protocol.CookieStatusResult{}, fmt.Errorf("platform is required")
	}
	storageWorker, ok := c.workers.AnyFor(string(protocol.DownloadFile))
	if !ok {
		return protocol.CookieStatusResult{}, fmt.Errorf("storage worker is unavailable")
	}
	payload := mustJSON(protocol.CookieRequestPayload{Platform: platform})
	resp, err := c.CallWorkerRPC(ctx, storageWorker.ID, protocol.Message{
		Type:    protocol.CookieStatus,
		Payload: payload,
	})
	if err != nil {
		return protocol.CookieStatusResult{}, err
	}
	if resp.Error != nil {
		return protocol.CookieStatusResult{}, fmt.Errorf("%s: %s", resp.Error.Code, resp.Error.Message)
	}
	var res protocol.CookieStatusResult
	if err := json.Unmarshal(resp.Result, &res); err != nil {
		return protocol.CookieStatusResult{}, fmt.Errorf("invalid response from storage worker: %w", err)
	}
	return res, nil
}

func (c *Coordinator) SaveCookies(ctx context.Context, platform, cookies string) (protocol.CookieSaveResult, error) {
	platform = strings.TrimSpace(platform)
	if platform == "" {
		return protocol.CookieSaveResult{}, fmt.Errorf("platform is required")
	}
	if strings.TrimSpace(cookies) == "" {
		return protocol.CookieSaveResult{}, fmt.Errorf("cookies cannot be empty")
	}
	storageWorker, ok := c.workers.AnyFor(string(protocol.DownloadFile))
	if !ok {
		return protocol.CookieSaveResult{}, fmt.Errorf("storage worker is unavailable")
	}
	payload := mustJSON(protocol.CookieRequestPayload{Platform: platform, Cookies: cookies})
	resp, err := c.CallWorkerRPC(ctx, storageWorker.ID, protocol.Message{
		Type:    protocol.CookieSave,
		Payload: payload,
	})
	if err != nil {
		return protocol.CookieSaveResult{}, err
	}
	if resp.Error != nil {
		return protocol.CookieSaveResult{}, fmt.Errorf("%s: %s", resp.Error.Code, resp.Error.Message)
	}
	var res protocol.CookieSaveResult
	if err := json.Unmarshal(resp.Result, &res); err != nil {
		return protocol.CookieSaveResult{}, fmt.Errorf("invalid response from storage worker: %w", err)
	}
	return res, nil
}

func (c *Coordinator) GetCookieContent(ctx context.Context, platform string) (protocol.CookieGetResult, error) {
	platform = strings.TrimSpace(platform)
	if platform == "" {
		return protocol.CookieGetResult{}, fmt.Errorf("platform is required")
	}
	storageWorker, ok := c.workers.AnyFor(string(protocol.DownloadFile))
	if !ok {
		return protocol.CookieGetResult{}, fmt.Errorf("storage worker is unavailable")
	}
	payload := mustJSON(protocol.CookieRequestPayload{Platform: platform})
	resp, err := c.CallWorkerRPC(ctx, storageWorker.ID, protocol.Message{
		Type:    protocol.CookieGet,
		Payload: payload,
	})
	if err != nil {
		return protocol.CookieGetResult{}, err
	}
	if resp.Error != nil {
		return protocol.CookieGetResult{}, fmt.Errorf("%s: %s", resp.Error.Code, resp.Error.Message)
	}
	var res protocol.CookieGetResult
	if err := json.Unmarshal(resp.Result, &res); err != nil {
		return protocol.CookieGetResult{}, fmt.Errorf("invalid response from storage worker: %w", err)
	}
	return res, nil
}

func (c *Coordinator) VerifyCookies(ctx context.Context, platform, cookies string) (protocol.CookieVerifyResult, error) {
	platform = strings.TrimSpace(platform)
	if platform == "" {
		return protocol.CookieVerifyResult{}, fmt.Errorf("platform is required")
	}
	if strings.TrimSpace(cookies) == "" {
		return protocol.CookieVerifyResult{}, fmt.Errorf("cookies cannot be empty")
	}
	downloadWorker, ok := c.workers.AnyFor(string(protocol.ResolveDownload))
	if !ok {
		return protocol.CookieVerifyResult{}, fmt.Errorf("download worker is unavailable")
	}
	payload := mustJSON(protocol.CookieRequestPayload{Platform: platform, Cookies: cookies})
	resp, err := c.CallWorkerRPC(ctx, downloadWorker.ID, protocol.Message{
		Type:    protocol.CookieVerify,
		Payload: payload,
	})
	if err != nil {
		return protocol.CookieVerifyResult{}, err
	}
	if resp.Error != nil {
		return protocol.CookieVerifyResult{Valid: false, Message: resp.Error.Message}, nil
	}
	var res protocol.CookieVerifyResult
	if err := json.Unmarshal(resp.Result, &res); err != nil {
		return protocol.CookieVerifyResult{}, fmt.Errorf("invalid response from download worker: %w", err)
	}
	return res, nil
}
