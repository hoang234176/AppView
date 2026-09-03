package service

import (
	"encoding/json"
	"strings"
	"sync"
	"testing"

	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/scheduler"
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
)

type lockedSender struct {
	mu       sync.Mutex
	messages []protocol.Message
}

func (s *lockedSender) Send(message protocol.Message) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.messages = append(s.messages, message)
	return nil
}

func (s *lockedSender) assignments() []protocol.Message {
	s.mu.Lock()
	defer s.mu.Unlock()
	items := make([]protocol.Message, len(s.messages))
	copy(items, s.messages)
	return items
}

func newDownloadCoordinator(t *testing.T) (*Coordinator, *lockedSender, *lockedSender) {
	t.Helper()
	coordinator := New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	resolver, storage := &lockedSender{}, &lockedSender{}
	if err := coordinator.RegisterWorker("resolver", []protocol.Capability{protocol.ResolveDownload}, resolver); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.RegisterWorker("storage", []protocol.Capability{protocol.DownloadFile}, storage); err != nil {
		t.Fatal(err)
	}
	return coordinator, resolver, storage
}

func resolveResult(url, filename string) json.RawMessage {
	return json.RawMessage(`{"downloadUrl":"` + url + `","filename":"` + filename + `"}`)
}

func TestDownloadCreatesResolveThenExactlyOneStorageTask(t *testing.T) {
	coordinator, resolver, storage := newDownloadCoordinator(t)
	job, err := coordinator.CreateDownload(DownloadRequest{
		URL: "https://www.mediafire.com/file/example", Destination: "albums/new", Password: "safe-password",
	})
	if err != nil {
		t.Fatal(err)
	}
	if job.State != "resolving" || job.ResolveTaskID == "" || len(resolver.assignments()) != 1 {
		t.Fatalf("unexpected created job: %#v", job)
	}
	if err := coordinator.TaskAccepted("resolver", job.ResolveTaskID); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.TaskCompleted("resolver", job.ResolveTaskID, resolveResult("https://direct.test/file.zip", "resolved.zip")); err != nil {
		t.Fatal(err)
	}

	updated, ok := coordinator.GetDownload(job.ID)
	if !ok || updated.State != "downloading" || updated.StorageTaskID == "" {
		t.Fatalf("storage transition missing: %#v", updated)
	}
	assignments := storage.assignments()
	if len(assignments) != 1 || assignments[0].Action != string(protocol.DownloadFile) {
		t.Fatalf("storage assignment missing: %#v", assignments)
	}
	var payload map[string]string
	if err := json.Unmarshal(assignments[0].Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["url"] != "https://direct.test/file.zip" || payload["filename"] != "resolved.zip" || payload["destination"] != "albums/new" || payload["password"] != "safe-password" {
		t.Fatalf("storage payload was not preserved/mapped: %#v", payload)
	}
	encodedJob, _ := json.Marshal(updated)
	if strings.Contains(string(encodedJob), "safe-password") {
		t.Fatalf("parent API job leaked password: %s", encodedJob)
	}

	// The task registry rejects a second terminal completion, and the parent
	// registry independently refuses a second storage transition.
	if err := coordinator.TaskCompleted("resolver", job.ResolveTaskID, resolveResult("https://other.test/file.zip", "other.zip")); err == nil {
		t.Fatal("duplicate resolver completion should be rejected")
	}
	if len(storage.assignments()) != 1 {
		t.Fatalf("duplicate resolve completion created storage task: %#v", storage.assignments())
	}
}

func TestDownloadResolveFailureDoesNotCreateStorageTask(t *testing.T) {
	coordinator, _, storage := newDownloadCoordinator(t)
	job, err := coordinator.CreateDownload(DownloadRequest{URL: "https://example.test"})
	if err != nil {
		t.Fatal(err)
	}
	if err := coordinator.TaskAccepted("resolver", job.ResolveTaskID); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.TaskFailed("resolver", job.ResolveTaskID, &protocol.ErrorPayload{Code: "RESOLVE_FAILED", Message: "safe"}); err != nil {
		t.Fatal(err)
	}
	updated, _ := coordinator.GetDownload(job.ID)
	if updated.State != "failed" || updated.FailureStage != "resolve" || updated.StorageTaskID != "" || len(storage.assignments()) != 0 {
		t.Fatalf("resolve failure state incorrect: %#v", updated)
	}
}

func TestDownloadStorageCompletionAndFailurePropagate(t *testing.T) {
	for _, scenario := range []struct {
		name      string
		complete  bool
		wantState string
		wantStage string
	}{
		{name: "completed", complete: true, wantState: "completed"},
		{name: "failed", wantState: "failed", wantStage: "storage"},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			coordinator, _, _ := newDownloadCoordinator(t)
			job, _ := coordinator.CreateDownload(DownloadRequest{URL: "https://example.test"})
			_ = coordinator.TaskAccepted("resolver", job.ResolveTaskID)
			_ = coordinator.TaskCompleted("resolver", job.ResolveTaskID, resolveResult("https://direct.test/file.zip", "file.zip"))
			current, _ := coordinator.GetDownload(job.ID)
			if err := coordinator.TaskAccepted("storage", current.StorageTaskID); err != nil {
				t.Fatal(err)
			}
			if scenario.complete {
				err := coordinator.TaskCompleted("storage", current.StorageTaskID, json.RawMessage(`{"jobId":"local-job","state":"completed"}`))
				if err != nil {
					t.Fatal(err)
				}
			} else if err := coordinator.TaskFailed("storage", current.StorageTaskID, &protocol.ErrorPayload{Code: "STORAGE_JOB_FAILED", Message: "safe"}); err != nil {
				t.Fatal(err)
			}
			updated, _ := coordinator.GetDownload(job.ID)
			if string(updated.State) != scenario.wantState || string(updated.FailureStage) != scenario.wantStage {
				t.Fatalf("unexpected terminal parent: %#v", updated)
			}
		})
	}
}

func TestMultipleDownloadJobsRemainIsolated(t *testing.T) {
	coordinator, _, storage := newDownloadCoordinator(t)
	requests := []DownloadRequest{
		{URL: "https://first.test", Filename: "first.zip"},
		{URL: "https://second.test", Filename: "second.zip"},
	}
	jobs := make([]string, len(requests))
	errs := make([]error, len(requests))
	var create sync.WaitGroup
	for index, request := range requests {
		create.Add(1)
		go func(index int, request DownloadRequest) {
			defer create.Done()
			job, err := coordinator.CreateDownload(request)
			jobs[index], errs[index] = job.ID, err
		}(index, request)
	}
	create.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}

	for completed := 0; completed < len(jobs); {
		advanced := false
		for _, jobID := range jobs {
			job, _ := coordinator.GetDownload(jobID)
			child, _ := coordinator.GetTask(job.ResolveTaskID)
			if child.State != task.Assigned {
				continue
			}
			if err := coordinator.TaskAccepted("resolver", job.ResolveTaskID); err != nil {
				t.Fatal(err)
			}
			if err := coordinator.TaskCompleted("resolver", job.ResolveTaskID, resolveResult("https://direct.test/"+jobID, "resolved-"+jobID+".zip")); err != nil {
				t.Fatal(err)
			}
			completed++
			advanced = true
			break
		}
		if !advanced {
			t.Fatal("no queued resolve child was dispatched")
		}
	}
	assignments := storage.assignments()
	if len(assignments) != 1 {
		t.Fatalf("one Storage worker should receive its first assignment: %#v", assignments)
	}
	for _, id := range jobs {
		job, _ := coordinator.GetDownload(id)
		if job.StorageTaskID == "" || job.State != "downloading" {
			t.Fatalf("job lost isolation: %#v", job)
		}
	}
}
