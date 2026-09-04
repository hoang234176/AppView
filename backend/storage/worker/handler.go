package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
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
	Retry(id, password string) error
	RetryExtraction(id, password string) error
	Cancel(id string) bool
	Snapshot(id string) (pythonapi.ArchiveJobSnapshot, bool)
	Snapshots() []pythonapi.ArchiveJobSnapshot
}

type archiveOperations struct{}

func (archiveOperations) Start(id, sourceURL, filename, destination, password string) error {
	return pythonapi.StartArchiveJob(id, sourceURL, filename, destination, password)
}

func (archiveOperations) Retry(id, password string) error {
	return pythonapi.RetryArchiveJob(id, password)
}

func (archiveOperations) RetryExtraction(id, password string) error {
	return pythonapi.RetryArchiveExtraction(id, password)
}

func (archiveOperations) Cancel(id string) bool { return pythonapi.CancelArchiveJob(id) }
func (archiveOperations) SetVideoDecision(id, videoID, quality string) error {
	return pythonapi.SetVideoDecision(id, videoID, quality)
}

type videoDecisionOperations interface {
	SetVideoDecision(id, videoID, quality string) error
}

func (archiveOperations) Snapshot(id string) (pythonapi.ArchiveJobSnapshot, bool) {
	return pythonapi.GetArchiveJobSnapshot(id)
}

func (archiveOperations) Snapshots() []pythonapi.ArchiveJobSnapshot {
	return pythonapi.GetArchiveJobSnapshots()
}

func (archiveOperations) SetCanonicalID(id, canonicalID string) bool {
	return pythonapi.SetArchiveJobCanonicalID(id, canonicalID)
}

type canonicalArchiveOperations interface {
	SetCanonicalID(id, canonicalID string) bool
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

func (h *Handler) History() StorageHistoryPayload {
	snapshots := h.archive.Snapshots()
	jobs := make([]StorageJobSnapshot, 0, len(snapshots))
	for _, snapshot := range snapshots {
		jobs = append(jobs, storageSnapshot(snapshot))
	}
	return StorageHistoryPayload{Jobs: jobs}
}

func storageSnapshot(snapshot pythonapi.ArchiveJobSnapshot) StorageJobSnapshot {
	return StorageJobSnapshot{
		ID: snapshot.ID, CanonicalID: snapshot.CanonicalID, SourceURL: safeHistoryURL(snapshot.URL), Filename: snapshot.Filename, Destination: snapshot.Destination, State: snapshot.State,
		DownloadedBytes: snapshot.DownloadedBytes, TotalBytes: snapshot.TotalBytes, SpeedBytes: snapshot.SpeedBytes,
		ExtractedPercent: snapshot.ExtractedPct, ConversionTotal: snapshot.Conversion.Total, ConversionCurrent: snapshot.Conversion.Current,
		ConversionFailed: snapshot.Conversion.Failed, ErrorCode: snapshot.ErrorCode, Error: snapshot.Error,
		PasswordRequired: snapshot.PasswordNeeded, ArchiveDownloaded: snapshot.ArchiveDownloaded, ArchiveExtracted: snapshot.ArchiveExtracted,
		VideoScanState: snapshot.VideoScanState, TotalVideoCount: snapshot.TotalVideoCount, InvalidVideoCount: snapshot.InvalidVideoCount,
		Videos:    snapshot.Videos,
		CreatedAt: snapshot.CreatedAt, UpdatedAt: snapshot.UpdatedAt,
	}
}

func safeHistoryURL(value string) string {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	parsed.RawQuery, parsed.Fragment, parsed.User = "", "", nil
	return parsed.String()
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

	if control, ok := decodeArchiveControl(task.Payload); ok {
		h.handleArchiveControl(ctx, task.TaskID, control, send)
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
	if request.ParentJobID != "" {
		if archive, ok := h.archive.(canonicalArchiveOperations); ok {
			archive.SetCanonicalID(task.TaskID, request.ParentJobID)
		}
	}
	h.monitor(ctx, task.TaskID, send)
}

type archiveControl struct {
	Operation     string `json:"operation"`
	ArchiveTaskID string `json:"archiveTaskId"`
	Password      string `json:"password"`
	VideoID       string `json:"videoId"`
	Quality       string `json:"quality"`
}

func decodeArchiveControl(payload json.RawMessage) (archiveControl, bool) {
	var control archiveControl
	if len(payload) == 0 || json.Unmarshal(payload, &control) != nil || control.Operation == "" {
		return archiveControl{}, false
	}
	control.Operation = strings.TrimSpace(control.Operation)
	control.ArchiveTaskID = strings.TrimSpace(control.ArchiveTaskID)
	if control.ArchiveTaskID == "" || (control.Operation != "retry" && control.Operation != "extract" && control.Operation != "cancel" && control.Operation != "video_decision") {
		return archiveControl{}, false
	}
	return control, true
}

func (h *Handler) handleArchiveControl(ctx context.Context, controlTaskID string, control archiveControl, send SendFunc) {
	if err := send(Message{Type: TaskAccepted, TaskID: controlTaskID}); err != nil {
		return
	}
	var err error
	if control.Operation == "video_decision" {
		operations, ok := h.archive.(videoDecisionOperations)
		if !ok {
			err = fmt.Errorf("video decision không được hỗ trợ")
		} else {
			err = operations.SetVideoDecision(control.ArchiveTaskID, control.VideoID, control.Quality)
		}
	} else if control.Operation == "extract" {
		err = h.archive.RetryExtraction(control.ArchiveTaskID, control.Password)
	} else if control.Operation == "cancel" {
		if !h.archive.Cancel(control.ArchiveTaskID) {
			err = fmt.Errorf("archive job not found")
		}
	} else {
		err = h.archive.Retry(control.ArchiveTaskID, control.Password)
	}
	if err != nil {
		h.fail(send, controlTaskID, "ARCHIVE_RETRY_FAILED", "Storage không thể tiếp tục archive.")
		return
	}
	if control.Operation == "video_decision" {
		// A decision is a short control operation while the original archive
		// monitor remains busy/waiting. Persist + publish one canonical snapshot
		// then finish this control task; do not attach a second long monitor.
		if snapshot, ok := h.archive.Snapshot(control.ArchiveTaskID); ok {
			_ = send(Message{Type: StorageHistory, StorageHistory: &StorageHistoryPayload{Jobs: []StorageJobSnapshot{storageSnapshot(snapshot)}}})
		}
		_ = send(Message{Type: TaskCompleted, TaskID: controlTaskID, Result: map[string]string{"operation": "video_decision"}})
		return
	}
	// Storage history updates the canonical parent. This short-lived control
	// task deliberately has no parent-child relationship of its own.
	h.monitor(ctx, control.ArchiveTaskID, send)
}

type downloadRequest struct {
	URL         string `json:"url"`
	Filename    string `json:"filename"`
	Destination string `json:"destination"`
	Password    string `json:"password"`
	ParentJobID string `json:"parentJobId"`
}

func decodeDownloadRequest(payload json.RawMessage) (downloadRequest, error) {
	var request downloadRequest
	if len(payload) == 0 || json.Unmarshal(payload, &request) != nil {
		return downloadRequest{}, fmt.Errorf("payload phải chứa url và filename")
	}
	request.URL = strings.TrimSpace(request.URL)
	request.Filename = strings.TrimSpace(request.Filename)
	request.Destination = strings.TrimSpace(request.Destination)
	request.ParentJobID = strings.TrimSpace(request.ParentJobID)
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
		// Keep Coordinator's public projection current without exposing a local
		// path. This is one small snapshot per active job, not a full history.
		if err := send(Message{Type: StorageHistory, StorageHistory: &StorageHistoryPayload{Jobs: []StorageJobSnapshot{storageSnapshot(snapshot)}}}); err != nil {
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
