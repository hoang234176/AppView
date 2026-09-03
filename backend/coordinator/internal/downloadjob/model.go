package downloadjob

import (
	"encoding/json"
	"time"

	"appview/coordinator/internal/protocol"
)

type State string

const (
	Queued      State = "queued"
	Resolving   State = "resolving"
	Downloading State = "downloading"
	Completed   State = "completed"
	Failed      State = "failed"
)

type FailureStage string

const (
	FailureResolve FailureStage = "resolve"
	FailureStorage FailureStage = "storage"
)

// Job is the parent lifecycle for a two-stage Coordinator download. password
// is intentionally private so API responses never expose it.
type Job struct {
	ID            string                 `json:"id"`
	URL           string                 `json:"url"`
	Filename      string                 `json:"filename,omitempty"`
	Destination   string                 `json:"destination,omitempty"`
	State         State                  `json:"state"`
	ResolveTaskID string                 `json:"resolveTaskId,omitempty"`
	StorageTaskID string                 `json:"storageTaskId,omitempty"`
	CurrentTaskID string                 `json:"currentTaskId,omitempty"`
	Progress      json.RawMessage        `json:"progress,omitempty"`
	Result        json.RawMessage        `json:"result,omitempty"`
	Error         *protocol.ErrorPayload `json:"error,omitempty"`
	FailureStage  FailureStage           `json:"failureStage,omitempty"`
	CreatedAt     time.Time              `json:"createdAt"`
	UpdatedAt     time.Time              `json:"updatedAt"`

	password       string
	storagePending bool
}

func (j Job) Clone() Job {
	j.Progress = append(json.RawMessage(nil), j.Progress...)
	j.Result = append(json.RawMessage(nil), j.Result...)
	if j.Error != nil {
		errorCopy := *j.Error
		j.Error = &errorCopy
	}
	return j
}

type CreateRequest struct {
	URL         string
	Filename    string
	Destination string
	Password    string
}

func NewJob(id string, request CreateRequest) Job {
	return Job{
		ID:          id,
		URL:         request.URL,
		Filename:    request.Filename,
		Destination: request.Destination,
		password:    request.Password,
	}
}

type StorageRequest struct {
	URL         string
	Filename    string
	Destination string
	Password    string
}
