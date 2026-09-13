package downloadjob

import (
	"encoding/json"
	"strings"
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
	ID                string                       `json:"id"`
	URL               string                       `json:"url"`
	SourceURL         string                       `json:"sourceUrl,omitempty"`
	Source            string                       `json:"source,omitempty"`
	Filename          string                       `json:"filename,omitempty"`
	DisplayName       string                       `json:"displayName,omitempty"`
	Destination       string                       `json:"destination,omitempty"`
	State             State                        `json:"state"`
	Stage             string                       `json:"stage,omitempty"`
	ResolveTaskID     string                       `json:"resolveTaskId,omitempty"`
	StorageTaskID     string                       `json:"storageTaskId,omitempty"`
	CurrentTaskID     string                       `json:"currentTaskId,omitempty"`
	Progress          json.RawMessage              `json:"progress,omitempty"`
	Result            json.RawMessage              `json:"result,omitempty"`
	Error             *protocol.ErrorPayload       `json:"error,omitempty"`
	FailureStage      FailureStage                 `json:"failureStage,omitempty"`
	CreatedAt         time.Time                    `json:"createdAt"`
	UpdatedAt         time.Time                    `json:"updatedAt"`
	ArchiveDownloaded bool                         `json:"archiveDownloaded"`
	ArchiveExtracted  bool                         `json:"archiveExtracted"`
	PasswordRequired  bool                         `json:"passwordRequired"`
	TotalVideoCount       int                          `json:"totalVideoCount,omitempty"`
	InvalidVideoCount     int                          `json:"invalidVideoCount,omitempty"`
	OptimizationCancelled bool                         `json:"optimizationCancelled,omitempty"`
	UnoptimizedVideoCount int                          `json:"unoptimizedVideoCount,omitempty"`
	CancelledFromStage    string                       `json:"cancelledFromStage,omitempty"`
	VideoScanState        string                       `json:"videoScanState,omitempty"`
	ConversionTotal       int                          `json:"conversionTotal,omitempty"`
	ConversionCurrent     int                          `json:"conversionCurrent,omitempty"`
	ConversionFailed      int                          `json:"conversionFailed,omitempty"`
	Videos                []protocol.VideoOptimization `json:"videos,omitempty"`

	password                 string
	storagePending           bool
	storageWorkerID          string
	storageSnapshotUpdatedAt time.Time
}

func (j Job) Clone() Job {
	j.Progress = append(json.RawMessage(nil), j.Progress...)
	j.Result = append(json.RawMessage(nil), j.Result...)
	j.Videos = append([]protocol.VideoOptimization(nil), j.Videos...)
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
	source := ""
	if strings.Contains(request.URL, "youtube.com") || strings.Contains(request.URL, "youtu.be") {
		source = "youtube"
	} else if strings.Contains(request.URL, "tiktok.com") {
		source = "tiktok"
	} else if strings.Contains(request.URL, "facebook.com") || strings.Contains(request.URL, "fb.watch") || strings.Contains(request.URL, "fb.com") {
		source = "facebook"
	} else if strings.Contains(request.URL, "instagram.com") || strings.Contains(request.URL, "instagr.am") {
		source = "instagram"
	}
	return Job{
		ID:          id,
		URL:         request.URL,
		SourceURL:   request.URL,
		Source:      source,
		Filename:    request.Filename,
		DisplayName: request.Filename,
		Destination: request.Destination,
		password:    request.Password,
	}
}

type StorageRequest struct {
	URL         string
	AudioURL    string
	Headers     map[string]string
	Filename    string
	Destination string
	Password    string
	Source      string
	Items       []any
}
