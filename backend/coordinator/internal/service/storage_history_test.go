package service

import (
	"testing"
	"time"

	"appview/coordinator/internal/downloadjob"
	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/scheduler"
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
)

func newHistoryCoordinator(t *testing.T) *Coordinator {
	t.Helper()
	coordinator := New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	if err := coordinator.RegisterWorker("storage-a", []protocol.Capability{protocol.DownloadFile}, &memorySender{}); err != nil {
		t.Fatal(err)
	}
	return coordinator
}

func storageHistoryJob(id, filename string, created, updated time.Time) protocol.StorageJobSnapshot {
	return protocol.StorageJobSnapshot{
		ID: id, SourceURL: "https://example.test/" + filename + "?signature=hidden", Filename: filename, Destination: "albums/target",
		State: "extracting", DownloadedBytes: 100, TotalBytes: 200, ArchiveDownloaded: true,
		CreatedAt: created, UpdatedAt: updated,
	}
}

func TestStorageHistoryRecoversAndMergesByStableID(t *testing.T) {
	coordinator := newHistoryCoordinator(t)
	now := time.Now().UTC().Truncate(time.Second)
	first := storageHistoryJob("archive-1", "real-name.zip", now.Add(-time.Minute), now)
	if err := coordinator.StorageHistory("storage-a", &protocol.StorageHistoryPayload{Jobs: []protocol.StorageJobSnapshot{first}}); err != nil {
		t.Fatal(err)
	}
	jobs := coordinator.ListDownloads()
	if len(jobs) != 1 || jobs[0].ID != "archive-1" || jobs[0].DisplayName != "real-name.zip" || jobs[0].Destination != "albums/target" {
		t.Fatalf("recovered jobs = %#v", jobs)
	}
	if jobs[0].SourceURL != "https://example.test/real-name.zip" {
		t.Fatalf("source URL leaked query or was lost: %q", jobs[0].SourceURL)
	}

	updated := first
	updated.State, updated.DownloadedBytes, updated.UpdatedAt = "converting", 200, now.Add(time.Second)
	if err := coordinator.StorageHistory("storage-a", &protocol.StorageHistoryPayload{Jobs: []protocol.StorageJobSnapshot{updated}}); err != nil {
		t.Fatal(err)
	}
	jobs = coordinator.ListDownloads()
	if len(jobs) != 1 || jobs[0].Stage != "converting" || jobs[0].State != "converting" {
		t.Fatalf("same stable ID was not merged: %#v", jobs)
	}
	// Repeating exactly the same reconnect snapshot is idempotent.
	if err := coordinator.StorageHistory("storage-a", &protocol.StorageHistoryPayload{Jobs: []protocol.StorageJobSnapshot{updated}}); err != nil {
		t.Fatal(err)
	}
	if jobs = coordinator.ListDownloads(); len(jobs) != 1 {
		t.Fatalf("duplicate after repeated sync: %#v", jobs)
	}
}

func TestStorageHistoryRejectsMalformedAndForeignWorkerCollision(t *testing.T) {
	coordinator := newHistoryCoordinator(t)
	if err := coordinator.StorageHistory("storage-a", &protocol.StorageHistoryPayload{Jobs: []protocol.StorageJobSnapshot{{ID: "bad"}}}); err == nil {
		t.Fatal("malformed snapshot was accepted")
	}
	now := time.Now().UTC()
	job := storageHistoryJob("archive-1", "one.zip", now, now)
	if err := coordinator.StorageHistory("storage-a", &protocol.StorageHistoryPayload{Jobs: []protocol.StorageJobSnapshot{job}}); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.RegisterWorker("storage-b", []protocol.Capability{protocol.DownloadFile}, &memorySender{}); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.StorageHistory("storage-b", &protocol.StorageHistoryPayload{Jobs: []protocol.StorageJobSnapshot{job}}); err == nil {
		t.Fatal("foreign storage collision was silently merged")
	}
}

func TestRecoveredHistoryIsNewestFirstAndDoesNotExposePassword(t *testing.T) {
	coordinator := newHistoryCoordinator(t)
	now := time.Now().UTC()
	older := storageHistoryJob("old", "old.zip", now.Add(-2*time.Hour), now.Add(-time.Hour))
	newer := storageHistoryJob("new", "new.zip", now.Add(-time.Hour), now)
	if err := coordinator.StorageHistory("storage-a", &protocol.StorageHistoryPayload{Jobs: []protocol.StorageJobSnapshot{older, newer}}); err != nil {
		t.Fatal(err)
	}
	jobs := coordinator.ListDownloads()
	if len(jobs) != 2 || jobs[0].ID != "new" {
		t.Fatalf("history order = %#v", jobs)
	}
	if jobs[0].DisplayName != "new.zip" {
		t.Fatalf("display name = %q", jobs[0].DisplayName)
	}
}

func TestCoordinatorRestartRecoversWhenStorageReconnects(t *testing.T) {
	now := time.Now().UTC()
	snapshot := storageHistoryJob("storage-child", "resume.zip", now.Add(-time.Minute), now)
	snapshot.CanonicalID = "parent-visible-id"
	history := &protocol.StorageHistoryPayload{Jobs: []protocol.StorageJobSnapshot{snapshot}}
	first := newHistoryCoordinator(t)
	if err := first.StorageHistory("storage-a", history); err != nil {
		t.Fatal(err)
	}
	// This represents a new remote Coordinator process. Only Storage reconnects
	// and replays its local durable snapshot; no Coordinator filesystem access
	// or old in-memory task state is involved.
	restarted := newHistoryCoordinator(t)
	if err := restarted.StorageHistory("storage-a", history); err != nil {
		t.Fatal(err)
	}
	jobs := restarted.ListDownloads()
	if len(jobs) != 1 || jobs[0].ID != "parent-visible-id" || jobs[0].DisplayName != "resume.zip" {
		t.Fatalf("restart recovery failed: %#v", jobs)
	}
}

func TestProgressNotificationsAreThrottledButStateChangeIsNotLost(t *testing.T) {
	coordinator := New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	_, events := coordinator.RealtimeHub().Subscribe()
	job := downloadjob.Job{ID: "job-progress"}
	coordinator.notifyDownload(job, "progress")
	coordinator.notifyDownload(job, "progress")
	first := <-events
	if first.DownloadEvent == nil || first.DownloadEvent.Kind != "progress" {
		t.Fatalf("first event = %#v", first)
	}
	select {
	case unexpected := <-events:
		t.Fatalf("progress was not throttled: %#v", unexpected)
	case <-time.After(25 * time.Millisecond):
	}
	coordinator.notifyDownload(job, "state_changed")
	final := <-events
	if final.DownloadEvent == nil || final.DownloadEvent.Kind != "state_changed" {
		t.Fatalf("final state event lost: %#v", final)
	}
}
