package scheduler

import (
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
	"testing"
)

func TestSelectsFirstSortedCandidate(t *testing.T) {
	selected, ok := New().Select(task.Task{Action: "resolve_download"}, []worker.Worker{{ID: "download-01"}, {ID: "download-02"}})
	if !ok || selected.ID != "download-01" {
		t.Fatalf("selected %#v", selected)
	}
}
