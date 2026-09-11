package tiktok

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"backend/configs"
)

func TestTikTokStateAndWorkspacePaths(t *testing.T) {
	tempState := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempState)

	stateDir, err := StateDir()
	if err != nil {
		t.Fatalf("unexpected error getting StateDir: %v", err)
	}
	expectedStateDir := filepath.Join(tempState, "media_download", "tiktok", "jobs")
	if stateDir != expectedStateDir {
		t.Errorf("StateDir = %s; want %s", stateDir, expectedStateDir)
	}

	jobID := "tt-test-job-1"
	workspaceDir, err := WorkspaceDir(jobID)
	if err != nil {
		t.Fatalf("unexpected error getting WorkspaceDir: %v", err)
	}
	expectedWorkspace := filepath.Join(tempState, "media_download", "tiktok", "workspaces", jobID)
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

	// Test job persistence
	job := &Job{
		ID:          jobID,
		CanonicalID: jobID,
		URL:         "https://www.tiktok.com/@user/video/123",
		Filename:    "test_video.mp4",
		Destination: "Downloads",
		State:       "downloading",
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	persistJob(job)

	if _, err := os.Stat(expectedStatePath); os.IsNotExist(err) {
		t.Fatalf("state file was not created at %s", expectedStatePath)
	}
}

func TestTikTokCommit_SingleVideo(t *testing.T) {
	tempRoot := t.TempDir()
	configs.DEFAULT_ROOT_PATH = tempRoot
	destDir := filepath.Join(tempRoot, "Downloads")
	if err := os.MkdirAll(destDir, 0755); err != nil {
		t.Fatal(err)
	}

	srcWorkspace := t.TempDir()
	srcFile := filepath.Join(srcWorkspace, "video.mp4")
	if err := os.WriteFile(srcFile, []byte("fake-tiktok-video-bytes"), 0644); err != nil {
		t.Fatal(err)
	}

	job := &Job{
		ID:          "job-single",
		Filename:    "video.mp4",
		Destination: "Downloads",
		items:       nil, // single video mode
	}

	err := commitTikTokMedia(context.Background(), job, srcWorkspace)
	if err != nil {
		t.Fatalf("commitTikTokMedia failed: %v", err)
	}

	expectedFile := filepath.Join(destDir, "video.mp4")
	if _, err := os.Stat(expectedFile); os.IsNotExist(err) {
		t.Fatalf("expected file %s does not exist", expectedFile)
	}

	// Single video should NOT create a subfolder
	forbiddenDir := filepath.Join(destDir, "video")
	if info, err := os.Stat(forbiddenDir); err == nil && info.IsDir() {
		t.Fatalf("subfolder should not be created for single video: %s", forbiddenDir)
	}
}

func TestTikTokCommit_MultipleItems(t *testing.T) {
	tempRoot := t.TempDir()
	configs.DEFAULT_ROOT_PATH = tempRoot
	destDir := filepath.Join(tempRoot, "Downloads")
	if err := os.MkdirAll(destDir, 0755); err != nil {
		t.Fatal(err)
	}

	srcWorkspace := t.TempDir()
	img1 := filepath.Join(srcWorkspace, "image_01.jpg")
	img2 := filepath.Join(srcWorkspace, "image_02.jpg")

	if err := os.WriteFile(img1, []byte("img1"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(img2, []byte("img2"), 0644); err != nil {
		t.Fatal(err)
	}

	job := &Job{
		ID:          "job-multi",
		Filename:    "My Cool Photoshoot",
		Destination: "Downloads",
		items: []DownloadItem{
			{Filename: "image_01.jpg", URL: "http://example.com/1.jpg"},
			{Filename: "image_02.jpg", URL: "http://example.com/2.jpg"},
		},
	}

	err := commitTikTokMedia(context.Background(), job, srcWorkspace)
	if err != nil {
		t.Fatalf("commitTikTokMedia failed: %v", err)
	}

	// Multiple photos must go directly into destDir, NEVER creating a subfolder
	forbiddenFolder := filepath.Join(destDir, "My Cool Photoshoot")
	if info, err := os.Stat(forbiddenFolder); err == nil && info.IsDir() {
		t.Fatalf("subfolder should not be created for photos: %s", forbiddenFolder)
	}

	for _, fname := range []string{"image_01.jpg", "image_02.jpg"} {
		fpath := filepath.Join(destDir, fname)
		if _, err := os.Stat(fpath); os.IsNotExist(err) {
			t.Errorf("expected photo %s does not exist in destination folder", fpath)
		}
	}
}

func TestTikTokDownloader(t *testing.T) {
	tempState := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempState)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "item1") {
			_, _ = w.Write([]byte("item1-data"))
			return
		}
		if strings.Contains(r.URL.Path, "item2") {
			_, _ = w.Write([]byte("item2-data"))
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	wsDir, err := WorkspaceDir("dl-test")
	if err != nil {
		t.Fatal(err)
	}
	_ = os.MkdirAll(wsDir, 0755)

	job := &Job{
		ID:       "dl-test",
		Filename: "test",
		ctx:      context.Background(),
	}

	item1File := filepath.Join(wsDir, "item1.jpg")
	b1, err := downloadStream(context.Background(), job, ts.URL+"/item1", nil, item1File, 0)
	if err != nil {
		t.Fatalf("downloadStream item1 failed: %v", err)
	}
	if b1 != int64(len("item1-data")) {
		t.Errorf("bytes = %d; want %d", b1, len("item1-data"))
	}

	items := []DownloadItem{
		{URL: ts.URL + "/item1", Filename: "dl_1.jpg"},
		{URL: ts.URL + "/item2", Filename: "dl_2.jpg"},
	}
	job.items = items
	err = downloadAllItems(context.Background(), job, wsDir)
	if err != nil {
		t.Fatalf("downloadAllItems failed: %v", err)
	}

	if _, err := os.Stat(filepath.Join(wsDir, "dl_1.jpg")); os.IsNotExist(err) {
		t.Errorf("dl_1.jpg does not exist")
	}
	if _, err := os.Stat(filepath.Join(wsDir, "dl_2.jpg")); os.IsNotExist(err) {
		t.Errorf("dl_2.jpg does not exist")
	}
}

func TestTikTokCancellation(t *testing.T) {
	tempState := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempState)

	ctx, cancel := context.WithCancel(context.Background())
	job := &Job{
		ID:          "cancel-tt-test",
		CanonicalID: "cancel-tt-test",
		URL:         "https://tiktok.com/@u/video/1",
		Filename:    "test.mp4",
		Destination: "Downloads",
		State:       "downloading",
		ctx:         ctx,
		cancel:      cancel,
	}

	activeJobs.Lock()
	activeJobs.items[job.ID] = job
	activeJobs.Unlock()
	persistJob(job)

	if !CancelJob(job.ID) {
		t.Fatal("CancelJob returned false")
	}

	snap, ok := GetJobSnapshot(job.ID)
	if !ok {
		t.Fatal("GetJobSnapshot returned false")
	}
	if snap.State != "cancelled" {
		t.Errorf("snap.State = %s; want cancelled", snap.State)
	}
}
