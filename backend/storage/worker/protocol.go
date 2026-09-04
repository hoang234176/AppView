// Package worker is the Storage-side adapter for the shared Coordinator
// worker protocol. It never owns filesystem or archive implementation.
package worker

import (
	"backend/events"
	"encoding/json"
	"time"
)

const (
	WorkerRegister   = "worker.register"
	WorkerRegistered = "worker.registered"
	WorkerHeartbeat  = "worker.heartbeat"
	TaskAssign       = "task.assign"
	TaskAccepted     = "task.accepted"
	TaskProgress     = "task.progress"
	TaskCompleted    = "task.completed"
	TaskFailed       = "task.failed"
	ProtocolError    = "error"
	FilesystemEvent  = "filesystem_event"
	StorageHistory   = "storage.history"

	CapabilityDownloadFile = "download_file"
)

type Message struct {
	Type           string                  `json:"type"`
	TaskID         string                  `json:"taskId,omitempty"`
	WorkerID       string                  `json:"workerId,omitempty"`
	Action         string                  `json:"action,omitempty"`
	Capabilities   []string                `json:"capabilities,omitempty"`
	Payload        json.RawMessage         `json:"payload,omitempty"`
	Result         any                     `json:"result,omitempty"`
	Progress       any                     `json:"progress,omitempty"`
	Error          *ErrorPayload           `json:"error,omitempty"`
	Event          *events.FilesystemEvent `json:"event,omitempty"`
	StorageHistory *StorageHistoryPayload  `json:"storageHistory,omitempty"`
}

// StorageHistoryPayload contains safe durable metadata only. Workspace paths,
// local artifacts and passwords never leave the Storage process.
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

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
