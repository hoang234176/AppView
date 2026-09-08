package pythonapi

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"backend/configs"
)

func TestVideoOptimizationIdentityAndQualityOptions(t *testing.T) {
	if videoID("nested/ảnh #1.mp4") != videoID("nested/ảnh #1.mp4") || videoID("a.mp4") == videoID("b.mp4") {
		t.Fatal("video ids must be stable and path-specific")
	}
	if got := allowedQualities("4k"); len(got) != 3 || got[0] != "4k" || got[2] != "1080p" {
		t.Fatalf("4k options = %#v", got)
	}
	if got := allowedQualities("2k"); len(got) != 2 || got[0] != "2k" {
		t.Fatalf("2k options = %#v", got)
	}
	if got := allowedQualities("1080p_or_lower"); len(got) != 0 {
		t.Fatalf("lower resolution must not upscale: %#v", got)
	}
}

func TestScanVideoOptimizationsKeepsSourceSizeWithoutEstimates(t *testing.T) {
	probeDir := t.TempDir()
	probePath := filepath.Join(probeDir, "ffprobe")
	probeOutput := `{"format":{"format_name":"matroska"},"streams":[{"codec_type":"video","codec_name":"vp9","pix_fmt":"yuv420p","width":3840,"height":2160},{"codec_type":"audio","codec_name":"opus"}]}`
	if err := os.WriteFile(probePath, []byte("#!/bin/sh\nprintf '%s\\n' '"+probeOutput+"'\n"), 0755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", probeDir+string(os.PathListSeparator)+os.Getenv("PATH"))

	folder := t.TempDir()
	contents := []byte("source-video-bytes")
	if err := os.WriteFile(filepath.Join(folder, "movie.mkv"), contents, 0644); err != nil {
		t.Fatal(err)
	}

	videos := ScanVideoOptimizations(context.Background(), folder)
	if len(videos) != 1 {
		t.Fatalf("videos = %#v, want one scanned video", videos)
	}
	video := videos[0]
	if video.SourceSizeBytes != int64(len(contents)) {
		t.Fatalf("sourceSizeBytes = %d, want %d", video.SourceSizeBytes, len(contents))
	}
	if got := video.AllowedQualities; len(got) != 3 || got[0] != "4k" || got[1] != "2k" || got[2] != "1080p" {
		t.Fatalf("allowed qualities = %#v", got)
	}
	encoded, err := json.Marshal(video)
	if err != nil {
		t.Fatal(err)
	}
	var canonical map[string]any
	if err := json.Unmarshal(encoded, &canonical); err != nil {
		t.Fatal(err)
	}
	if _, ok := canonical["estimates"]; ok {
		t.Fatalf("new video state must not contain estimates: %s", encoded)
	}
}

func TestSafeArchivePathKeepsLogicalPathUnderRoot(t *testing.T) {
	old := configs.DEFAULT_ROOT_PATH
	configs.DEFAULT_ROOT_PATH = t.TempDir()
	defer func() { configs.DEFAULT_ROOT_PATH = old }()
	for logical, suffix := range map[string]string{
		"/":                ".",
		"/Test":            "Test",
		"/Test/Subfolder":  "Test/Subfolder",
		"/Albums/Test":     "Albums/Test",
		"/Ảnh #1/玉汇 @test": "Ảnh #1/玉汇 @test",
	} {
		path, err := safeArchivePath(logical)
		want := filepath.Join(configs.DEFAULT_ROOT_PATH, suffix)
		if err != nil || path != want {
			t.Fatalf("%s resolved to %q, want %q (%v)", logical, path, want, err)
		}
	}
	if _, err := safeArchivePath("../escape"); err == nil {
		t.Fatal("traversal must be rejected")
	}
}
