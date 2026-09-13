package instagram

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"backend/configs"
)

func TestInstagramStateAndWorkspacePaths(t *testing.T) {
	tempState := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempState)

	stateDir, err := StateDir()
	if err != nil {
		t.Fatalf("unexpected error getting StateDir: %v", err)
	}
	expectedStateDir := filepath.Join(tempState, "media_download", "instagram", "jobs")
	if stateDir != expectedStateDir {
		t.Errorf("StateDir = %s; want %s", stateDir, expectedStateDir)
	}

	jobID := "ig-test-job-1"
	workspaceDir, err := WorkspaceDir(jobID)
	if err != nil {
		t.Fatalf("unexpected error getting WorkspaceDir: %v", err)
	}
	expectedWorkspace := filepath.Join(tempState, "media_download", "instagram", "workspaces", jobID)
	if workspaceDir != expectedWorkspace {
		t.Errorf("WorkspaceDir = %s; want %s", workspaceDir, expectedWorkspace)
	}

	statePath, err := StatePath(jobID)
	if err != nil {
		t.Fatalf("unexpected error getting StatePath: %v", err)
	}
	expectedStatePath := filepath.Join(expectedStateDir, jobID+".json")
	if statePath != expectedStatePath {
		t.Errorf("StatePath = %s; want %s", statePath, expectedStatePath)
	}

	// Traversal rejection
	if _, err := WorkspaceDir("../escape"); err == nil {
		t.Error("WorkspaceDir with traversal should return error")
	}
	if _, err := WorkspaceDir("a/b"); err == nil {
		t.Error("WorkspaceDir with slash should return error")
	}
}

func TestInstagramMultiItemDownloadAndCommit(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)
	configs.DEFAULT_ROOT_PATH = tempDir
	destDir := filepath.Join(tempDir, "instagram_downloads")
	_ = os.MkdirAll(destDir, 0755)

	// Mock HTTP server serving 1 photo and 1 video
	imgContent := []byte("fake-jpeg-photo-content")
	vidContent := []byte("fake-mp4-video-content")
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/photo.jpg" {
			w.Header().Set("Content-Type", "image/jpeg")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(imgContent)
			return
		}
		if r.URL.Path == "/video.mp4" {
			w.Header().Set("Content-Type", "video/mp4")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(vidContent)
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	items := []DownloadItem{
		{URL: ts.URL + "/photo.jpg", Filename: "01_photo.jpg", Type: "image"},
		{URL: ts.URL + "/video.mp4", Filename: "02_video.mp4", Type: "video"},
	}

	jobID := "ig-mixed-test-1"
	err := StartJob(jobID, ts.URL, "test_carousel.zip", "instagram_downloads", "", items, nil)
	if err != nil {
		t.Fatalf("StartJob failed: %v", err)
	}

	// Wait for job to complete
	timeout := time.After(5 * time.Second)
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	var finalSnap Snapshot
	completed := false
	for !completed {
		select {
		case <-timeout:
			t.Fatal("timed out waiting for Instagram download job completion")
		case <-ticker.C:
			snap, ok := GetJobSnapshot(jobID)
			if !ok {
				continue
			}
			if snap.State == "completed" {
				finalSnap = snap
				completed = true
			} else if snap.State == "error" {
				t.Fatalf("job failed with error: %s (%s)", snap.Error, snap.ErrorCode)
			}
		}
	}

	if finalSnap.State != "completed" {
		t.Errorf("final state = %s; want completed", finalSnap.State)
	}

	// Verify both files were committed to destination
	p1 := filepath.Join(destDir, "01_photo.jpg")
	p2 := filepath.Join(destDir, "02_video.mp4")

	if _, err := os.Stat(p1); os.IsNotExist(err) {
		t.Errorf("expected photo file %s to exist", p1)
	}
	if _, err := os.Stat(p2); os.IsNotExist(err) {
		t.Errorf("expected video file %s to exist", p2)
	}
}

func TestInstagramCancelJob(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)
	configs.DEFAULT_ROOT_PATH = tempDir

	jobID := "ig-cancel-test-1"
	job := &Job{
		ID:        jobID,
		State:     "downloading",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	activeJobs.Lock()
	activeJobs.items[jobID] = job
	activeJobs.Unlock()

	cancelled := CancelJob(jobID)
	if !cancelled {
		t.Error("expected CancelJob to return true")
	}

	snap, ok := GetJobSnapshot(jobID)
	if !ok {
		t.Fatal("GetJobSnapshot returned false")
	}
	if snap.State != "cancelled" {
		t.Errorf("job state = %s; want cancelled", snap.State)
	}
}
