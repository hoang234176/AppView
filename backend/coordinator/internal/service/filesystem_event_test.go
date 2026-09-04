package service

import (
	"testing"

	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/scheduler"
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
)

func TestFilesystemEventIsRelayedOnlyFromRegisteredWorker(t *testing.T) {
	coordinator := New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	sender := &memorySender{}
	if err := coordinator.RegisterWorker("storage-01", []protocol.Capability{protocol.DownloadFile}, sender); err != nil {
		t.Fatal(err)
	}
	event := &protocol.FilesystemEvent{Type: "folder_renamed", OldPath: "before", NewPath: "after"}
	if err := coordinator.FilesystemEvent("storage-01", event); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.FilesystemEvent("unknown", event); err == nil {
		t.Fatal("unregistered worker event was accepted")
	}
	if err := coordinator.FilesystemEvent("storage-01", &protocol.FilesystemEvent{Type: "folder_created", NewPath: "../outside"}); err == nil {
		t.Fatal("unsafe event path was accepted")
	}
}
