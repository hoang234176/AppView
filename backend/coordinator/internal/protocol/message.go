package protocol

import "encoding/json"

type MessageType string

const (
	WorkerRegister   MessageType = "worker.register"
	WorkerRegistered MessageType = "worker.registered"
	WorkerHeartbeat  MessageType = "worker.heartbeat"
	TaskAssign       MessageType = "task.assign"
	TaskAccepted     MessageType = "task.accepted"
	TaskProgress     MessageType = "task.progress"
	TaskCompleted    MessageType = "task.completed"
	TaskFailed       MessageType = "task.failed"
	Error            MessageType = "error"
)

// Message is the single JSON envelope used on worker WebSockets. Payload and
// Result intentionally retain raw JSON: the coordinator routes opaque worker
// data and must not learn scraping or filesystem-specific schemas.
type Message struct {
	Type         MessageType     `json:"type"`
	TaskID       string          `json:"taskId,omitempty"`
	WorkerID     string          `json:"workerId,omitempty"`
	Action       string          `json:"action,omitempty"`
	Capabilities []Capability    `json:"capabilities,omitempty"`
	Payload      json.RawMessage `json:"payload,omitempty"`
	Result       json.RawMessage `json:"result,omitempty"`
	Progress     json.RawMessage `json:"progress,omitempty"`
	Error        *ErrorPayload   `json:"error,omitempty"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func NewError(code, message string) Message {
	return Message{Type: Error, Error: &ErrorPayload{Code: code, Message: message}}
}
