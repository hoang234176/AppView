package task

import "testing"

func TestTaskLifecycleAndDisconnectRequeue(t *testing.T) {
	registry := NewRegistry()
	created, err := registry.Create(Task{ID: "one", Action: "resolve_download", Retryable: true, MaxAttempts: 2})
	if err != nil || created.State != Queued {
		t.Fatalf("create: %#v, %v", created, err)
	}
	assigned, err := registry.Assign("one", "download-01")
	if err != nil || assigned.State != Assigned || assigned.Attempts != 1 {
		t.Fatalf("assign: %#v, %v", assigned, err)
	}
	if _, err := registry.Accept("one", "download-01"); err != nil {
		t.Fatal(err)
	}
	requeued := registry.RequeueForWorker("download-01")
	if len(requeued) != 1 || requeued[0].State != Queued || requeued[0].AssignedWorkerID != "" {
		t.Fatalf("requeue: %#v", requeued)
	}
}

func TestCompletedTaskCannotRequeue(t *testing.T) {
	registry := NewRegistry()
	_, _ = registry.Create(Task{ID: "done", Action: "resolve_download", Retryable: true, MaxAttempts: 2})
	_, _ = registry.Assign("done", "download-01")
	_, _ = registry.Accept("done", "download-01")
	if _, err := registry.Complete("done", "download-01", nil); err != nil {
		t.Fatal(err)
	}
	if got := registry.RequeueForWorker("download-01"); len(got) != 0 {
		t.Fatalf("completed task was requeued: %#v", got)
	}
}
