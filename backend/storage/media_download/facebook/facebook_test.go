package facebook

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"backend/configs"
)

func TestFacebookStateAndWorkspacePaths(t *testing.T) {
	tempState := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempState)

	stateDir, err := StateDir()
	if err != nil {
		t.Fatalf("unexpected error getting StateDir: %v", err)
	}
	expectedStateDir := filepath.Join(tempState, "media_download", "facebook", "jobs")
	if stateDir != expectedStateDir {
		t.Errorf("StateDir = %s; want %s", stateDir, expectedStateDir)
	}

	jobID := "fb-test-job-1"
	workspaceDir, err := WorkspaceDir(jobID)
	if err != nil {
		t.Fatalf("unexpected error getting WorkspaceDir: %v", err)
	}
	expectedWorkspace := filepath.Join(tempState, "media_download", "facebook", "workspaces", jobID)
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

func TestFacebookPhotoDownloadAndCommit(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)
	configs.DEFAULT_ROOT_PATH = tempDir
	destDir := filepath.Join(tempDir, "photos")
	_ = os.MkdirAll(destDir, 0755)

	// Mock HTTP server serving 2 dummy images
	img1Content := []byte("fake-jpeg-image-1")
	img2Content := []byte("fake-jpeg-image-2")
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/img1.jpg" {
			w.Header().Set("Content-Type", "image/jpeg")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(img1Content)
			return
		}
		if r.URL.Path == "/img2.jpg" {
			w.Header().Set("Content-Type", "image/jpeg")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(img2Content)
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	items := []DownloadItem{
		{URL: ts.URL + "/img1.jpg", Filename: "01_photo.jpeg", Type: "image"},
		{URL: ts.URL + "/img2.jpg", Filename: "02_photo.jpeg", Type: "image"},
	}

	jobID := "fb-photo-test-1"
	err := StartJob(jobID, ts.URL, "test_album.zip", "photos", "", items, nil)
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
			t.Fatalf("Job did not complete within timeout. Current state: %s, error: %s", finalSnap.State, finalSnap.Error)
		case <-ticker.C:
			snap, ok := GetJobSnapshot(jobID)
			if ok {
				finalSnap = snap
				if snap.State == "completed" {
					completed = true
				} else if snap.State == "error" {
					t.Fatalf("Job failed with error: %s - %s", snap.ErrorCode, snap.Error)
				}
			}
		}
	}

	// Verify committed files exist at destination
	committed1 := filepath.Join(destDir, "01_photo.jpeg")
	committed2 := filepath.Join(destDir, "02_photo.jpeg")

	if _, err := os.Stat(committed1); err != nil {
		t.Fatalf("Expected %s to exist: %v", committed1, err)
	}
	if _, err := os.Stat(committed2); err != nil {
		t.Fatalf("Expected %s to exist: %v", committed2, err)
	}

	data1, _ := os.ReadFile(committed1)
	if string(data1) != string(img1Content) {
		t.Fatalf("Content mismatch for %s", committed1)
	}
}

func TestFacebookVideoDownloadCancel(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)

	blockCh := make(chan struct{})
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "video/mp4")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("chunk1"))
		w.(http.Flusher).Flush()
		<-blockCh
	}))
	defer func() {
		close(blockCh)
		ts.Close()
	}()

	jobID := "fb-cancel-test-1"
	err := StartJob(jobID, ts.URL, "cancel_test.mp4", "", "", nil, nil)
	if err != nil {
		t.Fatalf("StartJob failed: %v", err)
	}

	time.Sleep(100 * time.Millisecond)
	ok := CancelJob(jobID)
	if !ok {
		t.Fatalf("CancelJob failed")
	}

	snap, exists := GetJobSnapshot(jobID)
	if !exists {
		t.Fatalf("GetJobSnapshot returned false")
	}
	if snap.State != "cancelled" {
		t.Fatalf("Expected state cancelled, got %s", snap.State)
	}
}
