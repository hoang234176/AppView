package protocol

import (
	"encoding/json"
	"time"
)

type MessageType string

const (
	WorkerRegister         MessageType = "worker.register"
	WorkerRegistered       MessageType = "worker.registered"
	WorkerHeartbeat        MessageType = "worker.heartbeat"
	TaskAssign             MessageType = "task.assign"
	TaskAccepted           MessageType = "task.accepted"
	TaskProgress           MessageType = "task.progress"
	TaskCompleted          MessageType = "task.completed"
	TaskFailed             MessageType = "task.failed"
	FilesystemEventMessage MessageType = "filesystem_event"
	StorageHistory         MessageType = "storage.history"
	DownloadEventMessage   MessageType = "download_event"
	Error                  MessageType = "error"
)

// Message is the single JSON envelope used on worker WebSockets. Payload and
// Result intentionally retain raw JSON: the coordinator routes opaque worker
// data and must not learn scraping or filesystem-specific schemas.
type Message struct {
	Type           MessageType            `json:"type"`
	TaskID         string                 `json:"taskId,omitempty"`
	WorkerID       string                 `json:"workerId,omitempty"`
	Action         string                 `json:"action,omitempty"`
	Capabilities   []Capability           `json:"capabilities,omitempty"`
	Payload        json.RawMessage        `json:"payload,omitempty"`
	Result         json.RawMessage        `json:"result,omitempty"`
	Progress       json.RawMessage        `json:"progress,omitempty"`
	Error          *ErrorPayload          `json:"error,omitempty"`
	Event          *FilesystemEvent       `json:"event,omitempty"`
	StorageHistory *StorageHistoryPayload `json:"storageHistory,omitempty"`
	DownloadEvent  *DownloadEvent         `json:"download,omitempty"`
}

// StorageHistoryPayload is metadata-only durable state sent by one identified
// local Storage worker. It never contains local paths, passwords, or files.
type StorageHistoryPayload struct {
	Jobs []StorageJobSnapshot `json:"jobs"`
}

type StorageJobSnapshot struct {
	ID                string    `json:"id"`
	CanonicalID       string    `json:"canonicalJobId,omitempty"`
	SourceURL         string    `json:"sourceUrl,omitempty"`
	Filename          string    `json:"filename"`
	Destination       string    `json:"destination,omitempty"`
	State             string    `json:"state"`
	DownloadedBytes   int64     `json:"downloadedBytes,omitempty"`
	TotalBytes        int64     `json:"totalBytes,omitempty"`
	SpeedBytes        int64     `json:"speedBytes,omitempty"`
	ExtractedPercent  float64   `json:"extractedPercent,omitempty"`
	ConversionTotal   int       `json:"conversionTotal,omitempty"`
	ConversionCurrent int       `json:"conversionCurrent,omitempty"`
	ConversionFailed  int       `json:"conversionFailed,omitempty"`
	ErrorCode         string    `json:"errorCode,omitempty"`
	Error             string    `json:"error,omitempty"`
	PasswordRequired  bool      `json:"passwordRequired"`
	ArchiveDownloaded bool      `json:"archiveDownloaded"`
	ArchiveExtracted  bool      `json:"archiveExtracted"`
	VideoScanState    string    `json:"videoScanState,omitempty"`
	TotalVideoCount   int       `json:"totalVideoCount,omitempty"`
	InvalidVideoCount int       `json:"invalidVideoCount,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// DownloadEvent is a deliberately small invalidation notification. Clients
// refetch GET /api/v1/download for the canonical snapshot.
type DownloadEvent struct {
	JobID string `json:"jobId"`
	Kind  string `json:"kind"`
}

type FilesystemEvent struct {
	Type          string `json:"type"`
	Path          string `json:"path,omitempty"`
	OldPath       string `json:"oldPath,omitempty"`
	NewPath       string `json:"newPath,omitempty"`
	ParentPath    string `json:"parentPath,omitempty"`
	OldParentPath string `json:"oldParentPath,omitempty"`
	NewParentPath string `json:"newParentPath,omitempty"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func NewError(code, message string) Message {
	return Message{Type: Error, Error: &ErrorPayload{Code: code, Message: message}}
}
