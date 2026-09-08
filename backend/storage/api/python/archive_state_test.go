package pythonapi

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"backend/configs"
	"backend/events"
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

func TestCommitArchiveResultEmitsOnePublicDestinationEvent(t *testing.T) {
	root := t.TempDir()
	previousRoot := configs.DEFAULT_ROOT_PATH
	configs.DEFAULT_ROOT_PATH = root
	t.Cleanup(func() { configs.DEFAULT_ROOT_PATH = previousRoot; events.SetPublisher(nil) })
	workspace := t.TempDir()
	source := filepath.Join(workspace, "tệp # % @ 😀")
	if err := os.MkdirAll(source, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "a.txt"), []byte("ok"), 0644); err != nil {
		t.Fatal(err)
	}
	var emitted []events.FilesystemEvent
	events.SetPublisher(func(event events.FilesystemEvent) error { emitted = append(emitted, event); return nil })
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	job := &ArchiveJob{ID: "event-job", Destination: "đích/@folder", extractedPath: source, extractedName: "tệp # % @ 😀", ctx: ctx}
	if err := commitArchiveResult(job); err != nil {
		t.Fatal(err)
	}
	if len(emitted) != 1 {
		t.Fatalf("events=%#v", emitted)
	}
	event := emitted[0]
	if event.Type != "folder_created" || event.ParentPath != "đích/@folder" || event.NewPath != "đích/@folder/tệp # % @ 😀" || filepath.IsAbs(event.NewPath) || filepath.IsAbs(event.ParentPath) {
		t.Fatalf("unsafe event=%#v", event)
	}
	if _, err := os.Stat(filepath.Join(root, "đích/@folder/tệp # % @ 😀", "a.txt")); err != nil {
		t.Fatal(err)
	}
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

func TestPersistentArchiveStateIgnoresLegacyVideoEstimates(t *testing.T) {
	stateDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", stateDir)
	resetArchiveJobsForTest(t)
	now := time.Now().UTC()
	job := &ArchiveJob{
		ID: "legacy-estimates", Filename: "archive.zip", Destination: "albums/test", Stage: "completed",
		Videos:    []VideoOptimization{{ID: "video-1", RelativePath: "movie.mkv", SourceSizeBytes: 262282311, AllowedQualities: []string{"4k", "2k", "1080p"}, State: "decision_required"}},
		CreatedAt: now, UpdatedAt: now,
	}
	archiveJobs.Lock()
	archiveJobs.items[job.ID] = job
	archiveJobs.Unlock()
	persistArchiveJob(job)

	statePath := filepath.Join(stateDir, "downloads", "jobs", "legacy-estimates.json")
	contents, err := os.ReadFile(statePath)
	if err != nil {
		t.Fatal(err)
	}
	var persisted map[string]any
	if err := json.Unmarshal(contents, &persisted); err != nil {
		t.Fatal(err)
	}
	videos := persisted["job"].(map[string]any)["videos"].([]any)
	videos[0].(map[string]any)["estimates"] = map[string]int64{"4k": 230808433, "2k": 152123740, "1080p": 78684693}
	legacyContents, err := json.Marshal(persisted)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(statePath, legacyContents, 0600); err != nil {
		t.Fatal(err)
	}

	archiveJobs.Lock()
	archiveJobs.items = make(map[string]*ArchiveJob)
	archiveJobs.Unlock()
	LoadPersistentArchiveJobs()
	restored, ok := GetArchiveJobSnapshot(job.ID)
	if !ok || len(restored.Videos) != 1 {
		t.Fatalf("legacy snapshot was not restored: %#v", restored)
	}
	if restored.Videos[0].SourceSizeBytes != 262282311 || len(restored.Videos[0].AllowedQualities) != 3 {
		t.Fatalf("legacy video fields were not preserved: %#v", restored.Videos[0])
	}
}
