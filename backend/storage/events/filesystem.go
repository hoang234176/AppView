package events

import "sync"

type FilesystemEvent struct {
	Type          string `json:"type"`
	Path          string `json:"path,omitempty"`
	OldPath       string `json:"oldPath,omitempty"`
	NewPath       string `json:"newPath,omitempty"`
	ParentPath    string `json:"parentPath,omitempty"`
	OldParentPath string `json:"oldParentPath,omitempty"`
	NewParentPath string `json:"newParentPath,omitempty"`
}

type Publisher func(FilesystemEvent) error

var state struct {
	sync.RWMutex
	publish Publisher
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
