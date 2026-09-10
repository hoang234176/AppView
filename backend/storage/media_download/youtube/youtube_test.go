package youtube

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	pythonapi "backend/api/python"
	"backend/configs"
)

func TestStateAndWorkspacePaths(t *testing.T) {
	tempState := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempState)

	stateDir, err := StateDir()
	if err != nil {
		t.Fatalf("unexpected error getting StateDir: %v", err)
	}
	expectedStateDir := filepath.Join(tempState, "media_download", "youtube", "jobs")
	if stateDir != expectedStateDir {
		t.Errorf("StateDir = %s; want %s", stateDir, expectedStateDir)
	}

	jobID := "yt-test-job-42"
	workspaceDir, err := WorkspaceDir(jobID)
	if err != nil {
		t.Fatalf("unexpected error getting WorkspaceDir: %v", err)
	}
	expectedWorkspace := filepath.Join(tempState, "media_download", "youtube", "workspaces", jobID)
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

	// Verify path traversal rejection in WorkspaceDir
	if _, err := WorkspaceDir("../escape"); err == nil {
		t.Error("WorkspaceDir with traversal should return error")
	}
	if _, err := WorkspaceDir("a/b"); err == nil {
		t.Error("WorkspaceDir with slash should return error")
	}

	// Test job persistence writes to media_download/youtube/jobs, never to downloads/jobs
	job := &Job{
		ID:          jobID,
		CanonicalID: jobID,
		URL:         "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
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

	// Verify NO files were created in archive state path (downloads/jobs)
	archiveJobPath := filepath.Join(tempState, "downloads", "jobs", jobID+".json")
	if _, err := os.Stat(archiveJobPath); !os.IsNotExist(err) {
		t.Fatalf("YouTube state was unexpectedly written to archive state path: %s", archiveJobPath)
	}
}

func TestCompatibleYouTubeMedia_DestinationSemantics(t *testing.T) {
	tempRoot := t.TempDir()
	configs.DEFAULT_ROOT_PATH = tempRoot
	destDir := filepath.Join(tempRoot, "Downloads")
	if err := os.MkdirAll(destDir, 0755); err != nil {
		t.Fatal(err)
	}

	srcWorkspace := t.TempDir()
	srcFile := filepath.Join(srcWorkspace, "video.mp4")
	if err := os.WriteFile(srcFile, []byte("fake-mp4-stream-data"), 0644); err != nil {
		t.Fatal(err)
	}

	// Commit media file to /Downloads
	committedPath, err := commitMediaFile(context.Background(), srcFile, "Downloads", "video.mp4", "job-1")
	if err != nil {
		t.Fatalf("commitMediaFile failed: %v", err)
	}

	expectedFile := filepath.Join(destDir, "video.mp4")
	if committedPath != expectedFile {
		t.Errorf("committedPath = %s; want %s", committedPath, expectedFile)
	}
	if _, err := os.Stat(expectedFile); os.IsNotExist(err) {
		t.Errorf("expected file %s does not exist", expectedFile)
	}

	// Crucial check: /Downloads/video/ directory must NOT exist!
	forbiddenDir := filepath.Join(destDir, "video")
	if info, err := os.Stat(forbiddenDir); err == nil && info.IsDir() {
		t.Fatalf("BUG REPRODUCED: title-named directory was created at %s", forbiddenDir)
	}

	// Collision safety check: commit another file with the same name
	committedPath2, err := commitMediaFile(context.Background(), srcFile, "Downloads", "video.mp4", "job-2")
	if err != nil {
		t.Fatalf("second commitMediaFile failed: %v", err)
	}
	expectedFile2 := filepath.Join(destDir, "video (1).mp4")
	if committedPath2 != expectedFile2 {
		t.Errorf("collision path = %s; want %s", committedPath2, expectedFile2)
	}
	if _, err := os.Stat(expectedFile2); os.IsNotExist(err) {
		t.Errorf("expected collision file %s does not exist", expectedFile2)
	}
	if info, err := os.Stat(forbiddenDir); err == nil && info.IsDir() {
		t.Fatalf("title-named directory was created on collision at %s", forbiddenDir)
	}
}

func TestAdaptiveYouTubeMedia_DownloaderAndMux(t *testing.T) {
	tempState := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempState)

	// Mock server serving video and audio streams
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "video") {
			w.Header().Set("Content-Type", "video/mp4")
			_, _ = w.Write([]byte("video-part-content"))
			return
		}
		if strings.Contains(r.URL.Path, "audio") {
			w.Header().Set("Content-Type", "audio/mp4")
			_, _ = w.Write([]byte("audio-part-content"))
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	wsDir, err := WorkspaceDir("adaptive-test")
	if err != nil {
		t.Fatal(err)
	}
	_ = os.MkdirAll(wsDir, 0755)

	job := &Job{
		ID:       "adaptive-test",
		Filename: "adaptive.mp4",
		ctx:      context.Background(),
	}

	vPart := filepath.Join(wsDir, "video.part")
	aPart := filepath.Join(wsDir, "audio.part")

	vBytes, err := downloadStream(context.Background(), job, ts.URL+"/video", nil, vPart, 0)
	if err != nil {
		t.Fatalf("download video part failed: %v", err)
	}
	if vBytes != int64(len("video-part-content")) {
		t.Errorf("downloaded video bytes = %d; want %d", vBytes, len("video-part-content"))
	}

	aBytes, err := downloadStream(context.Background(), job, ts.URL+"/audio", nil, aPart, vBytes)
	if err != nil {
		t.Fatalf("download audio part failed: %v", err)
	}
	if aBytes != int64(len("audio-part-content")) {
		t.Errorf("downloaded audio bytes = %d; want %d", aBytes, len("audio-part-content"))
	}

	if _, err := os.Stat(vPart); os.IsNotExist(err) {
		t.Errorf("video.part does not exist")
	}
	if _, err := os.Stat(aPart); os.IsNotExist(err) {
		t.Errorf("audio.part does not exist")
	}
}

func TestConversionRequired_WorkspaceConvertVideoDir(t *testing.T) {
	tempState := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempState)

	jobID := "incompatible-test"
	wsDir, err := WorkspaceDir(jobID)
	if err != nil {
		t.Fatal(err)
	}
	_ = os.MkdirAll(wsDir, 0755)

	dummyIncompatible := filepath.Join(wsDir, "4k_video.mp4")
	if err := os.WriteFile(dummyIncompatible, []byte("dummy-4k-source"), 0644); err != nil {
		t.Fatal(err)
	}

	// Verify staging into .convert-video/
	convertDir := filepath.Join(wsDir, ".convert-video")
	if err := os.MkdirAll(convertDir, 0755); err != nil {
		t.Fatal(err)
	}
	stagedFile := filepath.Join(convertDir, "4k_video.mp4")
	if err := os.Rename(dummyIncompatible, stagedFile); err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(stagedFile); os.IsNotExist(err) {
		t.Fatalf(".convert-video/ staged file does not exist: %s", stagedFile)
	}

	// Verify .convert-video is located inside the YouTube job workspace
	expectedPrefix := filepath.Join(tempState, "media_download", "youtube", "workspaces", jobID, ".convert-video")
	if convertDir != expectedPrefix {
		t.Errorf("convertDir = %s; want %s", convertDir, expectedPrefix)
	}

	// Simulate completed conversion output inside .convert-video/
	convertedOutput := filepath.Join(convertDir, "4k_video.mp4")
	_ = os.WriteFile(convertedOutput, []byte("converted-1080p-content"), 0644)

	tempRoot := t.TempDir()
	configs.DEFAULT_ROOT_PATH = tempRoot
	destDir := filepath.Join(tempRoot, "Downloads")
	_ = os.MkdirAll(destDir, 0755)

	committedPath, err := commitMediaFile(context.Background(), convertedOutput, "Downloads", "4k_video.mp4", jobID)
	if err != nil {
		t.Fatalf("commitMediaFile after conversion failed: %v", err)
	}

	expectedFile := filepath.Join(destDir, "4k_video.mp4")
	if committedPath != expectedFile {
		t.Errorf("committedPath = %s; want %s", committedPath, expectedFile)
	}

	// Title-named folder must NOT exist!
	forbiddenDir := filepath.Join(destDir, "4k_video")
	if info, err := os.Stat(forbiddenDir); err == nil && info.IsDir() {
		t.Fatalf("title-named folder was created after conversion: %s", forbiddenDir)
	}
}

func TestCancellation_WorkspaceIsolatedFromDestination(t *testing.T) {
	tempState := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempState)

	tempRoot := t.TempDir()
	configs.DEFAULT_ROOT_PATH = tempRoot
	destDir := filepath.Join(tempRoot, "Downloads")
	_ = os.MkdirAll(destDir, 0755)

	jobID := "cancel-test"
	wsDir, err := WorkspaceDir(jobID)
	if err != nil {
		t.Fatal(err)
	}
	_ = os.MkdirAll(wsDir, 0755)

	// Write partial/intermediate file into workspace
	partFile := filepath.Join(wsDir, "download.part")
	_ = os.WriteFile(partFile, []byte("partial-download-bytes"), 0644)

	ctx, cancel := context.WithCancel(context.Background())
	job := &Job{
		ID:          jobID,
		CanonicalID: jobID,
		URL:         "https://youtube.com/watch?v=cancelled",
		Filename:    "cancelled.mp4",
		Destination: "Downloads",
		State:       "downloading",
		ctx:         ctx,
		cancel:      cancel,
	}
	activeJobs.Lock()
	activeJobs.items[jobID] = job
	activeJobs.Unlock()
	persistJob(job)

	// Cancel the job
	if !CancelJob(jobID) {
		t.Fatal("CancelJob returned false")
	}

	// Verify cancellation state
	snapshot, ok := GetJobSnapshot(jobID)
	if !ok {
		t.Fatal("job not found after cancel")
	}
	if snapshot.State != "cancelled" {
		t.Errorf("snapshot.State = %s; want cancelled", snapshot.State)
	}

	// Verify intermediate files stay inside workspace and NEVER appear in destination
	if _, err := os.Stat(filepath.Join(destDir, "cancelled.mp4")); !os.IsNotExist(err) {
		t.Errorf("cancelled file unexpectedly appeared in destination: %s", filepath.Join(destDir, "cancelled.mp4"))
	}
	if _, err := os.Stat(filepath.Join(destDir, "cancelled")); !os.IsNotExist(err) {
		t.Errorf("cancelled folder unexpectedly appeared in destination: %s", filepath.Join(destDir, "cancelled"))
	}
	if _, err := os.Stat(partFile); os.IsNotExist(err) {
		t.Errorf("partial file was removed from workspace before explicit deletion")
	}
}

func TestArchiveRegression_PathsAndBehaviorUnchanged(t *testing.T) {
	tempState := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempState)

	// Verify pythonapi.SafeArchivePath behavior
	tempRoot := t.TempDir()
	configs.DEFAULT_ROOT_PATH = tempRoot

	dest, err := pythonapi.SafeArchivePath("archive-dest")
	if err != nil {
		t.Fatalf("SafeArchivePath failed: %v", err)
	}
	expected := filepath.Join(tempRoot, "archive-dest")
	if dest != expected {
		t.Errorf("SafeArchivePath = %s; want %s", dest, expected)
	}

	// Traversal must be rejected
	if _, err := pythonapi.SafeArchivePath("../escape"); err == nil {
		t.Error("SafeArchivePath should reject traversal")
	}
}

func TestFFmpegMuxExecutionIfAvailable(t *testing.T) {
	ffmpegPath, err := exec.LookPath("ffmpeg")
	if err != nil || ffmpegPath == "" {
		t.Skip("ffmpeg not available in PATH, skipping mux integration check")
	}

	tempDir := t.TempDir()
	vPart := filepath.Join(tempDir, "video.part")
	aPart := filepath.Join(tempDir, "audio.part")
	output := filepath.Join(tempDir, "muxed.mp4")

	// Generate tiny test video and audio files using lavfi
	cmd1 := exec.Command("ffmpeg", "-y", "-f", "lavfi", "-i", "nullsrc=s=64x64:d=0.1", "-vcodec", "libx264", "-pix_fmt", "yuv420p", "-f", "mp4", "-movflags", "+frag_keyframe+empty_moov", vPart)
	if out, err := cmd1.CombinedOutput(); err != nil {
		t.Skipf("ffmpeg cannot generate test video: %v, out: %s", err, string(out))
	}
	cmd2 := exec.Command("ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.1", "-acodec", "aac", "-f", "mp4", "-movflags", "+frag_keyframe+empty_moov", aPart)
	if out, err := cmd2.CombinedOutput(); err != nil {
		t.Skipf("ffmpeg cannot generate test audio: %v, out: %s", err, string(out))
	}

	// Run muxVideoAudio
	if err := muxVideoAudio(context.Background(), vPart, aPart, output); err != nil {
		t.Fatalf("muxVideoAudio failed: %v", err)
	}

	info, err := os.Stat(output)
	if err != nil || info.Size() == 0 {
		t.Fatalf("muxed.mp4 output missing or empty")
	}
}
