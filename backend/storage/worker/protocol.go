// Package worker is the Storage-side adapter for the shared Coordinator
// worker protocol. It never owns filesystem or archive implementation.
package worker

import (
	"backend/events"
	"encoding/json"
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

	CapabilityDownloadFile = "download_file"
)

type Message struct {
	Type         string                  `json:"type"`
	TaskID       string                  `json:"taskId,omitempty"`
	WorkerID     string                  `json:"workerId,omitempty"`
	Action       string                  `json:"action,omitempty"`
	Capabilities []string                `json:"capabilities,omitempty"`
	Payload      json.RawMessage         `json:"payload,omitempty"`
	Result       any                     `json:"result,omitempty"`
	Progress     any                     `json:"progress,omitempty"`
	Error        *ErrorPayload           `json:"error,omitempty"`
	Event        *events.FilesystemEvent `json:"event,omitempty"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
