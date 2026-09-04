package worker

import (
	"context"
	"errors"
	"testing"
	"time"

	pythonapi "backend/api/python"
)

type fakeArchiveOperations struct {
	startErr          error
	startSnapshot     *pythonapi.ArchiveJobSnapshot
	started           bool
	retried           bool
	extractionRetried bool
	snapshots         map[string]pythonapi.ArchiveJobSnapshot
}

func (f *fakeArchiveOperations) Start(id, _, _, _, _ string) error {
	f.started = true
	if f.startErr == nil && f.startSnapshot != nil {
		if f.snapshots == nil {
			f.snapshots = make(map[string]pythonapi.ArchiveJobSnapshot)
		}
		snapshot := *f.startSnapshot
		snapshot.ID = id
		f.snapshots[id] = snapshot
	}
	return f.startErr
}

func (f *fakeArchiveOperations) Retry(_, _ string) error { f.retried = true; return f.startErr }
func (f *fakeArchiveOperations) RetryExtraction(_, _ string) error {
	f.extractionRetried = true
	return f.startErr
}
func (f *fakeArchiveOperations) Cancel(id string) bool {
	_, ok := f.snapshots[id]
	return ok
}

func (f *fakeArchiveOperations) Snapshot(id string) (pythonapi.ArchiveJobSnapshot, bool) {
	snapshot, ok := f.snapshots[id]
	return snapshot, ok
}

func (f *fakeArchiveOperations) Snapshots() []pythonapi.ArchiveJobSnapshot {
	result := make([]pythonapi.ArchiveJobSnapshot, 0, len(f.snapshots))
	for _, snapshot := range f.snapshots {
		result = append(result, snapshot)
	}
	return result
}

func collect(messages *[]Message) SendFunc {
	return func(message Message) error {
		*messages = append(*messages, message)
		return nil
	}
}

func completedSnapshot(id string) pythonapi.ArchiveJobSnapshot {
	return pythonapi.ArchiveJobSnapshot{ID: id, State: "completed", Filename: "archive.zip"}
}

func TestHandlerRegistersOnlyDownloadCapability(t *testing.T) {
	handler := NewHandler(&fakeArchiveOperations{})
	capabilities := handler.Capabilities()
	if len(capabilities) != 1 || capabilities[0] != CapabilityDownloadFile {
		t.Fatalf("capabilities = %#v, want only %q", capabilities, CapabilityDownloadFile)
	}
}

func TestHandlerCompletesExistingArchiveJob(t *testing.T) {
	archive := &fakeArchiveOperations{snapshots: map[string]pythonapi.ArchiveJobSnapshot{
		"task-1": completedSnapshot("task-1"),
	}}
	handler := NewHandler(archive)
	var sent []Message
	handler.Handle(context.Background(), Message{
		Type: TaskAssign, TaskID: "task-1", Action: CapabilityDownloadFile,
		Payload: []byte(`{"url":"https://example.test/archive.zip","filename":"archive.zip"}`),
	}, collect(&sent))

	if archive.started {
		t.Fatal("existing archive job must be monitored, not started again")
	}
	if len(sent) != 3 || sent[0].Type != TaskAccepted || sent[1].Type != StorageHistory || sent[2].Type != TaskCompleted {
		t.Fatalf("messages = %#v, want accepted, history, completed", sent)
	}
}

func TestHandlerStartsExistingArchiveServiceAndMapsCompleted(t *testing.T) {
	snapshot := completedSnapshot("")
	archive := &fakeArchiveOperations{startSnapshot: &snapshot}
	handler := NewHandler(archive)
	var sent []Message
	handler.Handle(context.Background(), Message{
		Type: TaskAssign, TaskID: "task-start", Action: CapabilityDownloadFile,
		Payload: []byte(`{"url":"https://example.test/archive.zip","filename":"archive.zip"}`),
	}, collect(&sent))

	if !archive.started || len(sent) != 3 || sent[0].Type != TaskAccepted || sent[1].Type != StorageHistory || sent[2].Type != TaskCompleted {
		t.Fatalf("messages = %#v, want existing service accepted, history, completed", sent)
	}
}

func TestHandlerFailsInvalidPayloadAndUnsupportedAction(t *testing.T) {
	handler := NewHandler(&fakeArchiveOperations{})
	for _, task := range []Message{
		{Type: TaskAssign, TaskID: "invalid", Action: CapabilityDownloadFile, Payload: []byte(`{}`)},
		{Type: TaskAssign, TaskID: "unsupported", Action: "convert_video", Payload: []byte(`{}`)},
	} {
		var sent []Message
		handler.Handle(context.Background(), task, collect(&sent))
		if len(sent) != 1 || sent[0].Type != TaskFailed {
			t.Fatalf("messages = %#v, want one task.failed", sent)
		}
	}
}

func TestHandlerRetriesExistingArchiveWithoutStartingAnotherDownload(t *testing.T) {
	archive := &fakeArchiveOperations{snapshots: map[string]pythonapi.ArchiveJobSnapshot{
		"archive-1": completedSnapshot("archive-1"),
	}}
	handler := NewHandler(archive)
	var sent []Message
	handler.Handle(context.Background(), Message{
		Type: TaskAssign, TaskID: "control-1", Action: CapabilityDownloadFile,
		Payload: []byte(`{"operation":"extract","archiveTaskId":"archive-1","password":"not logged"}`),
	}, collect(&sent))
	if archive.started || !archive.extractionRetried {
		t.Fatalf("control must retry extraction only: started=%v retried=%v", archive.started, archive.extractionRetried)
	}
	if len(sent) != 3 || sent[0].Type != TaskAccepted || sent[1].Type != StorageHistory || sent[2].Type != TaskCompleted {
		t.Fatalf("messages = %#v, want accepted, history, completed", sent)
	}
}

func TestHandlerMapsStartFailureToTaskFailed(t *testing.T) {
	archive := &fakeArchiveOperations{startErr: errors.New("disk unavailable"), snapshots: map[string]pythonapi.ArchiveJobSnapshot{}}
	handler := NewHandler(archive)
	var sent []Message
	handler.Handle(context.Background(), Message{
		Type: TaskAssign, TaskID: "task-2", Action: CapabilityDownloadFile,
		Payload: []byte(`{"url":"https://example.test/archive.zip","filename":"archive.zip"}`),
	}, collect(&sent))

	if !archive.started || len(sent) != 2 || sent[0].Type != TaskAccepted || sent[1].Error.Code != "STORAGE_START_FAILED" {
		t.Fatalf("messages = %#v, want accepted then STORAGE_START_FAILED", sent)
	}
}

func TestHandlerCancellationStopsMonitoringWithoutCancellingArchive(t *testing.T) {
	archive := &fakeArchiveOperations{snapshots: map[string]pythonapi.ArchiveJobSnapshot{
		"task-3": {ID: "task-3", State: "downloading", Filename: "archive.zip"},
	}}
	handler := NewHandler(archive)
	handler.pollInterval = time.Hour
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	finished := make(chan struct{})
	go func() {
		handler.Handle(ctx, Message{
			Type: TaskAssign, TaskID: "task-3", Action: CapabilityDownloadFile,
			Payload: []byte(`{"url":"https://example.test/archive.zip","filename":"archive.zip"}`),
		}, func(Message) error { return nil })
		close(finished)
	}()

	time.Sleep(5 * time.Millisecond)
	cancel()
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("handler did not stop after context cancellation")
	}
	if archive.started {
		t.Fatal("existing archive job must not be cancelled or restarted on worker shutdown")
	}
}
