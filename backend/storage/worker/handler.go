package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	pythonapi "backend/api/python"
	"backend/cookies"
	"backend/media_download/youtube"
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

// YouTubeOperations is the Storage-side business boundary for YouTube downloads.
type YouTubeOperations interface {
	Start(id, sourceURL, filename, destination, audioURL string, headers map[string]string) error
	Cancel(id string) bool
	SetVideoDecision(id, videoID, quality string) error
	ApplyVideoDecisions(id string, decisions map[string]string) error
	Snapshot(id string) (youtube.Snapshot, bool)
	Snapshots() []youtube.Snapshot
	SetCanonicalID(id, canonicalID string) bool
}

type youtubeOperations struct{}

func (youtubeOperations) Start(id, sourceURL, filename, destination, audioURL string, headers map[string]string) error {
	return youtube.StartJob(id, sourceURL, filename, destination, audioURL, headers)
}

func (youtubeOperations) Cancel(id string) bool {
	return youtube.CancelJob(id)
}

func (youtubeOperations) SetVideoDecision(id, videoID, quality string) error {
	return youtube.SetVideoDecision(id, videoID, quality)
}

func (youtubeOperations) ApplyVideoDecisions(id string, decisions map[string]string) error {
	return youtube.ApplyVideoDecisions(id, decisions)
}

func (youtubeOperations) Snapshot(id string) (youtube.Snapshot, bool) {
	return youtube.GetJobSnapshot(id)
}

func (youtubeOperations) Snapshots() []youtube.Snapshot {
	return youtube.GetJobSnapshots()
}

func (youtubeOperations) SetCanonicalID(id, canonicalID string) bool {
	return youtube.SetCanonicalID(id, canonicalID)
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

func (archiveOperations) ApplyVideoDecisions(id string, decisions map[string]string) error {
	return pythonapi.ApplyVideoDecisions(id, decisions)
}

type videoDecisionOperations interface {
	SetVideoDecision(id, videoID, quality string) error
	ApplyVideoDecisions(id string, decisions map[string]string) error
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

type streamArchiveOperations interface {
	StartWithStreams(id, sourceURL, filename, destination, password, audioURL string, headers map[string]string) error
}

func (archiveOperations) StartWithStreams(id, sourceURL, filename, destination, password, audioURL string, headers map[string]string) error {
	return pythonapi.StartArchiveJobWithStreams(id, sourceURL, filename, destination, password, audioURL, headers)
}

type SendFunc func(Message) error

type Handler struct {
	archive      ArchiveOperations
	youtube      YouTubeOperations
	pollInterval time.Duration
}

func NewHandler(archive ArchiveOperations, youtubeOps ...YouTubeOperations) *Handler {
	if archive == nil {
		archive = archiveOperations{}
	}
	var yt YouTubeOperations
	if len(youtubeOps) > 0 && youtubeOps[0] != nil {
		yt = youtubeOps[0]
	} else {
		yt = youtubeOperations{}
	}
	return &Handler{archive: archive, youtube: yt, pollInterval: time.Second}
}

func (h *Handler) Capabilities() []string {
	return []string{CapabilityDownloadFile}
}

func (h *Handler) History() StorageHistoryPayload {
	archiveSnapshots := h.archive.Snapshots()
	ytSnapshots := h.youtube.Snapshots()
	jobs := make([]StorageJobSnapshot, 0, len(archiveSnapshots)+len(ytSnapshots))
	for _, snapshot := range archiveSnapshots {
		jobs = append(jobs, storageSnapshot(snapshot))
	}
	for _, snapshot := range ytSnapshots {
		jobs = append(jobs, youtubeStorageSnapshot(snapshot))
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
		OptimizationCancelled: snapshot.OptimizationCancelled, UnoptimizedVideoCount: snapshot.UnoptimizedVideoCount, CancelledFromStage: snapshot.CancelledFromStage,
		Videos:    snapshot.Videos,
		CreatedAt: snapshot.CreatedAt, UpdatedAt: snapshot.UpdatedAt,
	}
}

func youtubeStorageSnapshot(snapshot youtube.Snapshot) StorageJobSnapshot {
	return StorageJobSnapshot{
		ID:                    snapshot.ID,
		CanonicalID:           snapshot.CanonicalID,
		SourceURL:             safeHistoryURL(snapshot.URL),
		Filename:              snapshot.Filename,
		Destination:           snapshot.Destination,
		State:                 snapshot.State,
		DownloadedBytes:       snapshot.DownloadedBytes,
		TotalBytes:            snapshot.TotalBytes,
		SpeedBytes:            snapshot.SpeedBytes,
		ExtractedPercent:      0,
		ConversionTotal:       snapshot.Conversion.Total,
		ConversionCurrent:     snapshot.Conversion.Current,
		ConversionFailed:      snapshot.Conversion.Failed,
		ErrorCode:             snapshot.ErrorCode,
		Error:                 snapshot.Error,
		PasswordRequired:      false,
		ArchiveDownloaded:     false,
		ArchiveExtracted:      false,
		VideoScanState:        snapshot.VideoScanState,
		TotalVideoCount:       snapshot.TotalVideoCount,
		InvalidVideoCount:     snapshot.InvalidVideoCount,
		OptimizationCancelled: snapshot.OptimizationCancelled,
		CancelledFromStage:    snapshot.CancelledFromStage,
		Videos:                snapshot.Videos,
		CreatedAt:             snapshot.CreatedAt,
		UpdatedAt:             snapshot.UpdatedAt,
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

	if isYouTubeRequest(request) {
		if _, exists := h.youtube.Snapshot(task.TaskID); !exists {
			utils.LogEvent("INFO", "storage youtube start", map[string]any{"taskId": task.TaskID, "filename": request.Filename, "destination": request.Destination})
			if err := h.youtube.Start(task.TaskID, request.URL, request.Filename, request.Destination, request.AudioURL, request.Headers); err != nil {
				h.fail(send, task.TaskID, "STORAGE_START_FAILED", "Storage không thể bắt đầu tác vụ tải YouTube.")
				return
			}
		}
		if request.ParentJobID != "" {
			h.youtube.SetCanonicalID(task.TaskID, request.ParentJobID)
		}
		h.monitor(ctx, task.TaskID, send)
		return
	}

	// A requeued Coordinator task keeps its original ID. If local Storage has
	// already started that archive job, only reconnect monitoring; do not start
	// a second download or cancel the existing one.
	if _, exists := h.archive.Snapshot(task.TaskID); !exists {
		utils.LogEvent("INFO", "storage archive start", map[string]any{"taskId": task.TaskID, "filename": request.Filename, "destination": request.Destination})
		var startErr error
		if streamer, ok := h.archive.(streamArchiveOperations); ok && (request.AudioURL != "" || len(request.Headers) > 0) {
			startErr = streamer.StartWithStreams(task.TaskID, request.URL, request.Filename, request.Destination, request.Password, request.AudioURL, request.Headers)
		} else {
			startErr = h.archive.Start(task.TaskID, request.URL, request.Filename, request.Destination, request.Password)
		}
		if startErr != nil {
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
	Operation     string          `json:"operation"`
	ArchiveTaskID string          `json:"archiveTaskId"`
	Password      string          `json:"password"`
	VideoID       string          `json:"videoId"`
	Quality       string          `json:"quality"`
	Decisions     json.RawMessage `json:"decisions"`
}

func decodeArchiveControl(payload json.RawMessage) (archiveControl, bool) {
	var control archiveControl
	if len(payload) == 0 || json.Unmarshal(payload, &control) != nil || control.Operation == "" {
		return archiveControl{}, false
	}
	control.Operation = strings.TrimSpace(control.Operation)
	control.ArchiveTaskID = strings.TrimSpace(control.ArchiveTaskID)
	if control.ArchiveTaskID == "" || (control.Operation != "retry" && control.Operation != "extract" && control.Operation != "cancel" && control.Operation != "video_decision" && control.Operation != "video_apply") {
		return archiveControl{}, false
	}
	return control, true
}

func (h *Handler) handleArchiveControl(ctx context.Context, controlTaskID string, control archiveControl, send SendFunc) {
	if err := send(Message{Type: TaskAccepted, TaskID: controlTaskID}); err != nil {
		return
	}

	if _, isYT := h.youtube.Snapshot(control.ArchiveTaskID); isYT {
		var err error
		if control.Operation == "video_decision" {
			err = h.youtube.SetVideoDecision(control.ArchiveTaskID, control.VideoID, control.Quality)
		} else if control.Operation == "video_apply" {
			var decisions map[string]string
			if len(control.Decisions) > 0 {
				if unmarshalErr := json.Unmarshal(control.Decisions, &decisions); unmarshalErr != nil {
					var str string
					if json.Unmarshal(control.Decisions, &str) == nil {
						_ = json.Unmarshal([]byte(str), &decisions)
					}
				}
			}
			err = h.youtube.ApplyVideoDecisions(control.ArchiveTaskID, decisions)
		} else if control.Operation == "cancel" {
			if !h.youtube.Cancel(control.ArchiveTaskID) {
				err = fmt.Errorf("youtube job not found")
			}
		} else {
			err = fmt.Errorf("thao tác %s không được hỗ trợ cho YouTube", control.Operation)
		}

		if err != nil {
			h.fail(send, controlTaskID, "STORAGE_CONTROL_FAILED", err.Error())
			return
		}

		if control.Operation == "video_decision" || control.Operation == "video_apply" {
			if snapshot, ok := h.youtube.Snapshot(control.ArchiveTaskID); ok {
				_ = send(Message{Type: StorageHistory, StorageHistory: &StorageHistoryPayload{Jobs: []StorageJobSnapshot{youtubeStorageSnapshot(snapshot)}}})
			}
			_ = send(Message{Type: TaskCompleted, TaskID: controlTaskID, Result: map[string]string{"operation": control.Operation}})
			return
		}

		h.monitor(ctx, control.ArchiveTaskID, send)
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
	} else if control.Operation == "video_apply" {
		operations, ok := h.archive.(videoDecisionOperations)
		if !ok {
			err = fmt.Errorf("video apply không được hỗ trợ")
		} else {
			var decisions map[string]string
			if len(control.Decisions) > 0 {
				if unmarshalErr := json.Unmarshal(control.Decisions, &decisions); unmarshalErr != nil {
					var str string
					if json.Unmarshal(control.Decisions, &str) == nil {
						_ = json.Unmarshal([]byte(str), &decisions)
					}
				}
			}
			err = operations.ApplyVideoDecisions(control.ArchiveTaskID, decisions)
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
	if control.Operation == "video_decision" || control.Operation == "video_apply" {
		// A decision/apply is a short control operation while the original archive
		// monitor remains busy/waiting. Persist + publish one canonical snapshot
		// then finish this control task; do not attach a second long monitor.
		if snapshot, ok := h.archive.Snapshot(control.ArchiveTaskID); ok {
			_ = send(Message{Type: StorageHistory, StorageHistory: &StorageHistoryPayload{Jobs: []StorageJobSnapshot{storageSnapshot(snapshot)}}})
		}
		_ = send(Message{Type: TaskCompleted, TaskID: controlTaskID, Result: map[string]string{"operation": control.Operation}})
		return
	}
	// Storage history updates the canonical parent. This short-lived control
	// task deliberately has no parent-child relationship of its own.
	h.monitor(ctx, control.ArchiveTaskID, send)
}

type downloadRequest struct {
	URL         string            `json:"url"`
	AudioURL    string            `json:"audioUrl,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	Filename    string            `json:"filename"`
	Destination string            `json:"destination"`
	Password    string            `json:"password"`
	ParentJobID string            `json:"parentJobId"`
	Source      string            `json:"source,omitempty"`
}

func isYouTubeRequest(request downloadRequest) bool {
	if strings.EqualFold(strings.TrimSpace(request.Source), "youtube") {
		return true
	}
	u := strings.ToLower(request.URL)
	return strings.Contains(u, "googlevideo.com") || strings.Contains(u, "youtube.com") || strings.Contains(u, "youtu.be")
}

func decodeDownloadRequest(payload json.RawMessage) (downloadRequest, error) {
	var request downloadRequest
	if len(payload) == 0 || json.Unmarshal(payload, &request) != nil {
		return downloadRequest{}, fmt.Errorf("payload phải chứa url và filename")
	}
	request.URL = strings.TrimSpace(request.URL)
	request.AudioURL = strings.TrimSpace(request.AudioURL)
	request.Filename = strings.TrimSpace(request.Filename)
	request.Destination = strings.TrimSpace(request.Destination)
	request.ParentJobID = strings.TrimSpace(request.ParentJobID)
	request.Source = strings.TrimSpace(request.Source)
	if request.URL == "" || request.Filename == "" {
		return downloadRequest{}, fmt.Errorf("payload.url và payload.filename không được để trống")
	}
	return request, nil
}

func (h *Handler) monitor(ctx context.Context, taskID string, send SendFunc) {
	if _, isYT := h.youtube.Snapshot(taskID); isYT {
		h.monitorYouTube(ctx, taskID, send)
		return
	}
	h.monitorArchive(ctx, taskID, send)
}

func (h *Handler) monitorYouTube(ctx context.Context, taskID string, send SendFunc) {
	for {
		snapshot, exists := h.youtube.Snapshot(taskID)
		if !exists {
			h.fail(send, taskID, "STORAGE_JOB_MISSING", "Storage không còn tác vụ YouTube được giao.")
			return
		}
		if err := send(Message{Type: StorageHistory, StorageHistory: &StorageHistoryPayload{Jobs: []StorageJobSnapshot{youtubeStorageSnapshot(snapshot)}}}); err != nil {
			return
		}

		switch snapshot.State {
		case "completed":
			utils.LogEvent("INFO", "storage youtube completed", map[string]any{"taskId": taskID, "filename": snapshot.Filename})
			_ = send(Message{Type: TaskCompleted, TaskID: taskID, Result: map[string]any{
				"jobId":    snapshot.ID,
				"filename": snapshot.Filename,
				"state":    snapshot.State,
				"conversion": map[string]int{
					"total": snapshot.Conversion.Total, "current": snapshot.Conversion.Current, "failed": snapshot.Conversion.Failed,
				},
			}})
			return
		case "cancelled":
			utils.LogEvent("WARN", "storage youtube cancelled", map[string]any{"taskId": taskID, "filename": snapshot.Filename})
			h.fail(send, taskID, "STORAGE_JOB_CANCELLED", "Tác vụ YouTube đã bị hủy cục bộ.")
			return
		case "error":
			utils.LogEvent("ERROR", "storage youtube failed", map[string]any{"taskId": taskID, "filename": snapshot.Filename})
			h.fail(send, taskID, "STORAGE_JOB_FAILED", "Storage không thể hoàn tất tác vụ tải YouTube.")
			return
		default:
			utils.LogEvent("DEBUG", "storage youtube progress", map[string]any{"taskId": taskID, "state": snapshot.State, "filename": snapshot.Filename, "downloadedBytes": snapshot.DownloadedBytes, "totalBytes": snapshot.TotalBytes})
			if err := send(Message{Type: TaskProgress, TaskID: taskID, Progress: map[string]any{
				"state":           snapshot.State,
				"filename":        snapshot.Filename,
				"downloadedBytes": snapshot.DownloadedBytes,
				"totalBytes":      snapshot.TotalBytes,
				"speedBytes":      snapshot.SpeedBytes,
				"conversion": map[string]int{
					"total": snapshot.Conversion.Total, "current": snapshot.Conversion.Current, "failed": snapshot.Conversion.Failed,
				},
			}}); err != nil {
				return
			}
		}

		interval := h.pollInterval
		if interval <= 0 {
			interval = time.Millisecond
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(interval):
		}
	}
}

func (h *Handler) monitorArchive(ctx context.Context, taskID string, send SendFunc) {
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

func (h *Handler) HandleCookieMessage(msg Message, send SendFunc) {
	var req CookieRequestPayload
	if len(msg.Payload) > 0 {
		_ = json.Unmarshal(msg.Payload, &req)
	}
	switch msg.Type {
	case CookieStatus:
		exists, modTime, err := cookies.GetStatus(req.Platform)
		if err != nil {
			_ = send(Message{
				Type:   CookieStatus,
				TaskID: msg.TaskID,
				Error:  &ErrorPayload{Code: "STATUS_FAILED", Message: err.Error()},
			})
			return
		}
		_ = send(Message{
			Type:   CookieStatus,
			TaskID: msg.TaskID,
			Result: CookieStatusResult{
				Platform:  req.Platform,
				Exists:    exists,
				UpdatedAt: modTime,
			},
		})
	case CookieSave:
		if strings.TrimSpace(req.Cookies) == "" {
			_ = send(Message{
				Type:   CookieSave,
				TaskID: msg.TaskID,
				Error:  &ErrorPayload{Code: "EMPTY_COOKIES", Message: "Cookies cannot be empty"},
			})
			return
		}
		modTime, err := cookies.Save(req.Platform, req.Cookies)
		if err != nil {
			_ = send(Message{
				Type:   CookieSave,
				TaskID: msg.TaskID,
				Error:  &ErrorPayload{Code: "SAVE_FAILED", Message: err.Error()},
			})
			return
		}
		_ = send(Message{
			Type:   CookieSave,
			TaskID: msg.TaskID,
			Result: CookieSaveResult{
				Success:   true,
				UpdatedAt: modTime,
			},
		})
	case CookieGet:
		content, exists, err := cookies.Read(req.Platform)
		if err != nil {
			_ = send(Message{
				Type:   CookieGet,
				TaskID: msg.TaskID,
				Error:  &ErrorPayload{Code: "READ_FAILED", Message: err.Error()},
			})
			return
		}
		_ = send(Message{
			Type:   CookieGet,
			TaskID: msg.TaskID,
			Result: CookieGetResult{
				Platform: req.Platform,
				Exists:   exists,
				Cookies:  content,
			},
		})
	}
}
