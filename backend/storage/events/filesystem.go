package events

import (
	"sync"
	"time"
)

type FilesystemEvent struct {
	Type          string   `json:"type"`
	Drive         string   `json:"drive,omitempty"`
	Path          string   `json:"path,omitempty"`
	OldPath       string   `json:"oldPath,omitempty"`
	NewPath       string   `json:"newPath,omitempty"`
	ParentPath    string   `json:"parentPath,omitempty"`
	OldParentPath string   `json:"oldParentPath,omitempty"`
	NewParentPath string   `json:"newParentPath,omitempty"`
	Paths         []string `json:"paths,omitempty"`
	Item          any      `json:"item,omitempty"`
	Items         any      `json:"items,omitempty"`
}

type BatchJobProgressEvent struct {
	ID          string    `json:"id"`
	Action      string    `json:"action"`
	SrcDrive    string    `json:"src_drive"`
	DestDrive   string    `json:"dest_drive"`
	DestFolder  string    `json:"dest_folder"`
	Status      string    `json:"status"` // "running", "completed", "failed"
	Percent     int       `json:"percent"`
	TotalBytes  int64     `json:"total_bytes"`
	CopiedBytes int64     `json:"copied_bytes"`
	CurrentFile string    `json:"current_file"`
	Message     string    `json:"message"`
	Error       string    `json:"error,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Publisher func(FilesystemEvent) error
type BatchProgressPublisher func(BatchJobProgressEvent) error

var state struct {
	sync.RWMutex
	publish      Publisher
	batchPublish BatchProgressPublisher
}

func SetPublisher(p Publisher) { state.Lock(); state.publish = p; state.Unlock() }
func Publish(event FilesystemEvent) error {
	state.RLock()
	publish := state.publish
	state.RUnlock()
	if publish == nil {
		return nil
	}
	return publish(event)
}

func SetBatchProgressPublisher(p BatchProgressPublisher) {
	state.Lock()
	state.batchPublish = p
	state.Unlock()
}

func PublishBatchProgress(event BatchJobProgressEvent) error {
	state.RLock()
	publish := state.batchPublish
	state.RUnlock()
	if publish == nil {
		return nil
	}
	return publish(event)
}
