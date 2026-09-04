package pythonapi

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func resetArchiveJobsForTest(t *testing.T) {
	t.Helper()
	archiveJobs.Lock()
	for _, job := range archiveJobs.items {
		if job.cancel != nil {
			job.cancel()
		}
	}
	archiveJobs.items = make(map[string]*ArchiveJob)
	archiveJobs.Unlock()
	t.Cleanup(func() {
		archiveJobs.Lock()
		for _, job := range archiveJobs.items {
			if job.cancel != nil {
				job.cancel()
			}
		}
		archiveJobs.items = make(map[string]*ArchiveJob)
		archiveJobs.Unlock()
	})
}

func TestPersistentArchiveStateRestoresInterruptedJobWithoutPassword(t *testing.T) {
	stateDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", stateDir)
	resetArchiveJobsForTest(t)
	ctx, cancel := context.WithCancel(context.Background())
	now := time.Now().UTC().Add(-time.Minute)
	job := &ArchiveJob{
		ID: "job-123", CanonicalID: "parent-visible-id", URL: "https://example.test/archive.zip", Filename: "archive.zip", Destination: "albums/test",
		Stage: "downloading", DownloadedBytes: 123, TotalBytes: 456, CreatedAt: now, UpdatedAt: now,
		ctx: ctx, cancel: cancel,
	}
	archiveJobs.Lock()
	archiveJobs.items[job.ID] = job
	archiveJobs.Unlock()
	persistArchiveJob(job)

	statePath := filepath.Join(stateDir, "downloads", "jobs", "job-123.json")
	contents, err := os.ReadFile(statePath)
	if err != nil {
		t.Fatal(err)
	}
	var persisted map[string]any
	if err := json.Unmarshal(contents, &persisted); err != nil {
		t.Fatal(err)
	}
	if storedJob, ok := persisted["job"].(map[string]any); ok {
		if _, passwordPresent := storedJob["password"]; passwordPresent {
			t.Fatalf("persistent state must not include a password: %s", contents)
		}
	} else {
		t.Fatalf("unexpected persisted job shape: %s", contents)
	}

	archiveJobs.Lock()
	archiveJobs.items = make(map[string]*ArchiveJob)
	archiveJobs.Unlock()
	LoadPersistentArchiveJobs()
	restored, ok := GetArchiveJobSnapshot(job.ID)
	if !ok {
		t.Fatal("persisted job was not restored")
	}
	if restored.State != "interrupted" || restored.ErrorCode != "STORAGE_RESTARTED" {
		t.Fatalf("restored state = %#v, want interrupted restart recovery", restored)
	}
	if restored.CanonicalID != "parent-visible-id" || restored.DownloadedBytes != 123 || restored.TotalBytes != 456 || restored.Filename != "archive.zip" {
		t.Fatalf("restored metadata = %#v", restored)
	}
}
