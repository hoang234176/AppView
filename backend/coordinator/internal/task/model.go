package task

import (
	"encoding/json"
	"time"

	"appview/coordinator/internal/protocol"
)

type Task struct {
	ID               string                 `json:"id"`
	Action           string                 `json:"action"`
	Payload          json.RawMessage        `json:"payload"`
	State            State                  `json:"state"`
	AssignedWorkerID string                 `json:"assignedWorkerId,omitempty"`
	Attempts         int                    `json:"attempts"`
	MaxAttempts      int                    `json:"maxAttempts"`
	Retryable        bool                   `json:"retryable"`
	Progress         json.RawMessage        `json:"progress,omitempty"`
	Result           json.RawMessage        `json:"result,omitempty"`
	Error            *protocol.ErrorPayload `json:"error,omitempty"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

func (t Task) Clone() Task {
	t.Payload = append(json.RawMessage(nil), t.Payload...)
	t.Progress = append(json.RawMessage(nil), t.Progress...)
	t.Result = append(json.RawMessage(nil), t.Result...)
	if t.Error != nil {
		errorCopy := *t.Error
		t.Error = &errorCopy
	}
	return t
}
