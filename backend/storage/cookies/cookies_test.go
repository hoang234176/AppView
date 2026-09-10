package cookies

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSanitizePlatform(t *testing.T) {
	valid := []string{"youtube", "facebook", "instagram_media", "tiktok-1"}
	for _, p := range valid {
		sanitized, err := SanitizePlatform(p)
		if err != nil {
			t.Fatalf("expected %q to be valid, got err: %v", p, err)
		}
		if sanitized != p {
			t.Fatalf("expected %q, got %q", p, sanitized)
		}
	}

	invalid := []string{"", "  ", "../youtube", "yt/cookies", "yt.txt", "yt*cookies", "yt@cookies"}
	for _, p := range invalid {
		if _, err := SanitizePlatform(p); err == nil {
			t.Fatalf("expected %q to be rejected, but succeeded", p)
		}
	}
}

func TestSaveAndReadStatus(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)

	// Initially not exists
	exists, modTime, err := GetStatus("youtube")
	if err != nil {
		t.Fatalf("GetStatus error: %v", err)
	}
	if exists || modTime != nil {
		t.Fatalf("expected exists=false, got exists=%v", exists)
	}

	// Read initially empty
	content, readExists, err := Read("youtube")
	if err != nil {
		t.Fatalf("Read error: %v", err)
	}
	if readExists || content != "" {
		t.Fatalf("expected readExists=false, got %v", readExists)
	}

	// Save
	sampleCookie := "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t2147483647\tTEST\t123\n"
	savedTime, err := Save("youtube", sampleCookie)
	if err != nil {
		t.Fatalf("Save error: %v", err)
	}
	if savedTime.IsZero() {
		t.Fatalf("expected non-zero saved time")
	}

	// Check file permissions and dir permissions
	filePath := filepath.Join(tempDir, "cookies", "youtube.txt")
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		t.Fatalf("stat error: %v", err)
	}
	if fileInfo.Mode().Perm() != 0600 {
		t.Fatalf("expected file perm 0600, got %o", fileInfo.Mode().Perm())
	}

	dirInfo, err := os.Stat(filepath.Join(tempDir, "cookies"))
	if err != nil {
		t.Fatalf("dir stat error: %v", err)
	}
	if dirInfo.Mode().Perm() != 0700 {
		t.Fatalf("expected dir perm 0700, got %o", dirInfo.Mode().Perm())
	}

	// Status now exists
	exists, modTime, err = GetStatus("youtube")
	if err != nil {
		t.Fatalf("GetStatus error: %v", err)
	}
	if !exists || modTime == nil {
		t.Fatalf("expected exists=true, got %v", exists)
	}

	// Read matches
	content, readExists, err = Read("youtube")
	if err != nil {
		t.Fatalf("Read error: %v", err)
	}
	if !readExists || content != sampleCookie {
		t.Fatalf("expected content %q, got %q", sampleCookie, content)
	}
}
