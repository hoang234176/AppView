package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	pythonapi "backend/api/python"
	"backend/utils"
)

// ArchiveOperations is the narrow existing-business boundary used by this
// adapter. The real implementation delegates to pythonapi; tests can provide
// a fake without downloading files or invoking external tools.
type ArchiveOperations interface {
	Start(id, sourceURL, filename, destination, password string) error
	Snapshot(id string) (pythonapi.ArchiveJobSnapshot, bool)
}

type archiveOperations struct{}

func (archiveOperations) Start(id, sourceURL, filename, destination, password string) error {
	return pythonapi.StartArchiveJob(id, sourceURL, filename, destination, password)
}

func (archiveOperations) Snapshot(id string) (pythonapi.ArchiveJobSnapshot, bool) {
	return pythonapi.GetArchiveJobSnapshot(id)
}

type SendFunc func(Message) error

type Handler struct {
	archive      ArchiveOperations
	pollInterval time.Duration
}

func NewHandler(archive ArchiveOperations) *Handler {
	if archive == nil {
		archive = archiveOperations{}
	}
	return &Handler{archive: archive, pollInterval: time.Second}
}

func (h *Handler) Capabilities() []string {
	return []string{CapabilityDownloadFile}
}

func (h *Handler) Handle(ctx context.Context, task Message, send SendFunc) {
	if task.Type != TaskAssign {
		return
	}
	if strings.TrimSpace(task.TaskID) == "" {
		// No task ID means the coordinator cannot associate a failure response.
		return
	}
	if task.Action != CapabilityDownloadFile {
		h.fail(send, task.TaskID, "UNSUPPORTED_ACTION", "Storage worker không hỗ trợ action được giao.")
		return
	}

	request, err := decodeDownloadRequest(task.Payload)
	if err != nil {
		h.fail(send, task.TaskID, "INVALID_PAYLOAD", err.Error())
		return
	}
	utils.LogEvent("INFO", "storage worker accepted download", map[string]any{"taskId": task.TaskID, "action": task.Action, "filename": request.Filename, "destination": request.Destination})
	if err := send(Message{Type: TaskAccepted, TaskID: task.TaskID}); err != nil {
		return
	}

	// A requeued Coordinator task keeps its original ID. If local Storage has
	// already started that archive job, only reconnect monitoring; do not start
	// a second download or cancel the existing one.
	if _, exists := h.archive.Snapshot(task.TaskID); !exists {
		utils.LogEvent("INFO", "storage archive start", map[string]any{"taskId": task.TaskID, "filename": request.Filename, "destination": request.Destination})
		if err := h.archive.Start(task.TaskID, request.URL, request.Filename, request.Destination, request.Password); err != nil {
			h.fail(send, task.TaskID, "STORAGE_START_FAILED", "Storage không thể bắt đầu tác vụ tải.")
			return
		}
	}
	h.monitor(ctx, task.TaskID, send)
}

type downloadRequest struct {
	URL         string `json:"url"`
	Filename    string `json:"filename"`
	Destination string `json:"destination"`
	Password    string `json:"password"`
}

func decodeDownloadRequest(payload json.RawMessage) (downloadRequest, error) {
	var request downloadRequest
	if len(payload) == 0 || json.Unmarshal(payload, &request) != nil {
		return downloadRequest{}, fmt.Errorf("payload phải chứa url và filename")
	}
	request.URL = strings.TrimSpace(request.URL)
	request.Filename = strings.TrimSpace(request.Filename)
	request.Destination = strings.TrimSpace(request.Destination)
	if request.URL == "" || request.Filename == "" {
		return downloadRequest{}, fmt.Errorf("payload.url và payload.filename không được để trống")
	}
	return request, nil
}

func (h *Handler) monitor(ctx context.Context, taskID string, send SendFunc) {
	for {
		snapshot, exists := h.archive.Snapshot(taskID)
		if !exists {
			h.fail(send, taskID, "STORAGE_JOB_MISSING", "Storage không còn tác vụ tải được giao.")
			return
		}

		switch snapshot.State {
		case "completed":
			utils.LogEvent("INFO", "storage archive completed", map[string]any{"taskId": taskID, "filename": snapshot.Filename})
			_ = send(Message{Type: TaskCompleted, TaskID: taskID, Result: completedResult(snapshot)})
			return
		case "cancelled":
			utils.LogEvent("WARN", "storage archive cancelled", map[string]any{"taskId": taskID, "filename": snapshot.Filename})
			h.fail(send, taskID, "STORAGE_JOB_CANCELLED", "Tác vụ Storage đã bị hủy cục bộ.")
			return
		case "password_required":
			utils.LogEvent("WARN", "storage archive requires password", map[string]any{"taskId": taskID, "filename": snapshot.Filename})
			h.fail(send, taskID, "PASSWORD_REQUIRED", "Archive yêu cầu mật khẩu để tiếp tục.")
			return
		case "error":
			utils.LogEvent("ERROR", "storage archive failed", map[string]any{"taskId": taskID, "filename": snapshot.Filename})
			h.fail(send, taskID, "STORAGE_JOB_FAILED", "Storage không thể hoàn tất tác vụ tải.")
			return
		default:
			utils.LogEvent("DEBUG", "storage archive progress", map[string]any{"taskId": taskID, "state": snapshot.State, "filename": snapshot.Filename, "downloadedBytes": snapshot.DownloadedBytes, "totalBytes": snapshot.TotalBytes})
			if err := send(Message{Type: TaskProgress, TaskID: taskID, Progress: progressResult(snapshot)}); err != nil {
				return
			}
		}

		interval := h.pollInterval
		if interval <= 0 {
			interval = time.Millisecond
		}
		select {
		case <-ctx.Done():
			// Do not cancel Go's archive job. The Coordinator will requeue this
			// task if appropriate and a future worker session can monitor it.
			return
		case <-time.After(interval):
		}
	}
}

func progressResult(snapshot pythonapi.ArchiveJobSnapshot) map[string]any {
	return map[string]any{
		"state":            snapshot.State,
		"filename":         snapshot.Filename,
		"downloadedBytes":  snapshot.DownloadedBytes,
		"totalBytes":       snapshot.TotalBytes,
		"speedBytes":       snapshot.SpeedBytes,
		"extractedPercent": snapshot.ExtractedPct,
		"conversion": map[string]int{
			"total": snapshot.Conversion.Total, "current": snapshot.Conversion.Current, "failed": snapshot.Conversion.Failed,
		},
	}
}

func completedResult(snapshot pythonapi.ArchiveJobSnapshot) map[string]any {
	return map[string]any{
		"jobId":    snapshot.ID,
		"filename": snapshot.Filename,
		"state":    snapshot.State,
		"conversion": map[string]int{
			"total": snapshot.Conversion.Total, "current": snapshot.Conversion.Current, "failed": snapshot.Conversion.Failed,
		},
	}
}

func (h *Handler) fail(send SendFunc, taskID, code, description string) {
	utils.LogEvent("ERROR", "storage worker task failed", map[string]any{"taskId": taskID, "errorCode": code})
	_ = send(Message{Type: TaskFailed, TaskID: taskID, Error: &ErrorPayload{Code: code, Message: description}})
}
