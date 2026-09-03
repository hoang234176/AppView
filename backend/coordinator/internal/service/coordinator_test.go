package service

import (
	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/scheduler"
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
	"testing"
)

type memorySender struct{ messages []protocol.Message }

func (s *memorySender) Send(message protocol.Message) error {
	s.messages = append(s.messages, message)
	return nil
}

func TestDispatchesByCapabilityAndRequeuesOnDisconnect(t *testing.T) {
	workers := worker.NewRegistry()
	tasks := task.NewRegistry()
	coordinator := New(workers, tasks, scheduler.New(), 2)
	sender := &memorySender{}
	if err := coordinator.RegisterWorker("download-01", []protocol.Capability{protocol.ResolveDownload}, sender); err != nil {
		t.Fatal(err)
	}
	created, err := coordinator.CreateTask("resolve_download", []byte(`{"url":"https://example.test"}`), true, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(sender.messages) != 1 || sender.messages[0].Type != protocol.TaskAssign {
		t.Fatalf("assignment missing: %#v", sender.messages)
	}
	if err := coordinator.TaskAccepted("download-01", created.ID); err != nil {
		t.Fatal(err)
	}
	coordinator.WorkerDisconnected("download-01")
	requeued, ok := coordinator.GetTask(created.ID)
	if !ok || requeued.State != task.Queued {
		t.Fatalf("task not requeued: %#v", requeued)
	}
}
