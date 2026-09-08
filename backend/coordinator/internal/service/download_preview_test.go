package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/scheduler"
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
)

func waitPreviewAssignment(t *testing.T, sender *lockedSender) protocol.Message {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		for _, message := range sender.assignments() {
			if message.Type == protocol.TaskAssign {
				return message
			}
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("preview was not assigned")
	return protocol.Message{}
}

func TestPreviewDoesNotCreateDownloadOrStorageAndAllowsOnlyPublicMetadata(t *testing.T) {
	c, resolver, storage := newDownloadCoordinator(t)
	done := make(chan struct{})
	go func() {
		defer close(done)
		preview, failure := c.PreviewDownload(context.Background(), "https://youtube.com/watch?v=id")
		if failure != nil {
			t.Errorf("preview failed: %v", failure)
			return
		}
		encoded, _ := json.Marshal(preview)
		if strings.Contains(string(encoded), "secret") || strings.Contains(string(encoded), "formats") || len(preview.Qualities) != 3 {
			t.Errorf("unsafe preview: %s", encoded)
		}
	}()
	assignment := waitPreviewAssignment(t, resolver)
	var payload map[string]any
	_ = json.Unmarshal(assignment.Payload, &payload)
	if payload["operation"] != "preview" {
		t.Fatal("preview operation missing")
	}
	if err := c.TaskAccepted("resolver", assignment.TaskID); err != nil {
		t.Fatal(err)
	}
	if err := c.TaskCompleted("resolver", assignment.TaskID, json.RawMessage(`{"source":"youtube","title":"Video","qualities":[2160,1080,720],"formats":[{"url":"secret"}],"headers":{"Cookie":"secret"}}`)); err != nil {
		t.Fatal(err)
	}
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("preview hung")
	}
	if len(storage.assignments()) != 0 || len(c.ListDownloads()) != 0 {
		t.Fatal("preview started a download")
	}
	if _, exists := c.GetTask(assignment.TaskID); exists {
		t.Fatal("transient task was retained")
	}
}

func TestPreviewCancellationWaitsForWorkerBeforeReusingIt(t *testing.T) {
	c, resolver, _ := newDownloadCoordinator(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { defer close(done); c.PreviewDownload(ctx, "https://youtube.com/watch?v=id") }()
	assignment := waitPreviewAssignment(t, resolver)
	if err := c.TaskAccepted("resolver", assignment.TaskID); err != nil {
		t.Fatal(err)
	}
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("cancel hung")
	}
	messages := resolver.assignments()
	if messages[len(messages)-1].Type != protocol.TaskCancel {
		t.Fatal("extractor was not cancelled")
	}
	registered, _ := c.workers.Get("resolver")
	if registered.Status != worker.Busy {
		t.Fatal("worker reused before cleanup")
	}
	if err := c.TaskFailed("resolver", assignment.TaskID, &protocol.ErrorPayload{Code: "CANCELLED"}); err != nil {
		t.Fatal(err)
	}
	registered, _ = c.workers.Get("resolver")
	if registered.Status != worker.Idle {
		t.Fatal("worker not released after acknowledgement")
	}
	if _, exists := c.GetTask(assignment.TaskID); exists {
		t.Fatal("cancelled preview retained")
	}
}

func TestCancelledQueuedPreviewNeverDispatches(t *testing.T) {
	c := New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	_, failure := c.PreviewDownload(ctx, "https://youtube.com/watch?v=id")
	if failure == nil {
		t.Fatal("expected cancellation")
	}
	if len(c.tasks.Queued()) != 0 {
		t.Fatal("abandoned preview still queued")
	}
}

func TestSelectedSourceQualityOnlyReachesResolver(t *testing.T) {
	c, resolver, storage := newDownloadCoordinator(t)
	job, err := c.CreateDownload(DownloadRequest{URL: "https://youtube.com/watch?v=id", Quality: 1080, Destination: "/Ảnh/Test"})
	if err != nil {
		t.Fatal(err)
	}
	var request map[string]any
	_ = json.Unmarshal(resolver.assignments()[0].Payload, &request)
	if request["quality"] != float64(1080) {
		t.Fatalf("wrong quality: %v", request)
	}
	if err := c.TaskAccepted("resolver", job.ResolveTaskID); err != nil {
		t.Fatal(err)
	}
	if err := c.TaskCompleted("resolver", job.ResolveTaskID, json.RawMessage(`{"downloadUrl":"https://media.example/1080","audioUrl":"https://media.example/audio","filename":"video.mp4","headers":{"User-Agent":"AppView","Cookie":"secret"}}`)); err != nil {
		t.Fatal(err)
	}
	var transfer map[string]any
	if len(storage.assignments()) != 1 {
		t.Fatal("expected one Storage task")
	}
	_ = json.Unmarshal(storage.assignments()[0].Payload, &transfer)
	if transfer["url"] != "https://media.example/1080" || transfer["audioUrl"] != "https://media.example/audio" || transfer["destination"] != "/Ảnh/Test" {
		t.Fatalf("incorrect transfer: %v", transfer)
	}
	if _, ok := transfer["quality"]; ok {
		t.Fatal("Storage must not interpret source quality")
	}
	if strings.Contains(string(storage.assignments()[0].Payload), "secret") {
		t.Fatal("unsafe header forwarded")
	}
}
