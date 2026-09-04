package pythonapi

import (
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
