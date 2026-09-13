package cookies

import (
	"os"
	"path/filepath"
	"strings"
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

func TestSaveMergePreservesExistingCookies(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)

	// 1. Initial save: sessionid, ds_user_id, datr
	initialCookies := "# Netscape HTTP Cookie File\n" +
		".instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\tinitial_session_123\n" +
		".instagram.com\tTRUE\t/\tTRUE\t2147483647\tds_user_id\tuser_987\n" +
		".instagram.com\tTRUE\t/\tTRUE\t2147483647\tdatr\tdatr_abc\n"

	if _, err := Save("instagram", initialCookies); err != nil {
		t.Fatalf("Initial Save error: %v", err)
	}

	// 2. Incoming update from Instagram Set-Cookie: only csrftoken and mid
	updateCookies := "# Netscape HTTP Cookie File\n" +
		".instagram.com\tTRUE\t/\tTRUE\t2147483647\tcsrftoken\tnew_token_456\n" +
		".instagram.com\tTRUE\t/\tTRUE\t2147483647\tmid\tnew_mid_789\n"

	if _, err := Save("instagram", updateCookies); err != nil {
		t.Fatalf("Update Save error: %v", err)
	}

	// 3. Read back: sessionid, ds_user_id, datr must still exist!
	content, exists, err := Read("instagram")
	if err != nil {
		t.Fatalf("Read error: %v", err)
	}
	if !exists {
		t.Fatalf("expected file to exist")
	}

	expectedKeys := []string{
		"sessionid\tinitial_session_123",
		"ds_user_id\tuser_987",
		"datr\tdatr_abc",
		"csrftoken\tnew_token_456",
		"mid\tnew_mid_789",
	}
	for _, expected := range expectedKeys {
		if !strings.Contains(content, expected) {
			t.Fatalf("expected content to contain %q, got:\n%s", expected, content)
		}
	}

	// 4. Update sessionid with a new value: should update sessionid and keep all other keys
	updateSession := ".instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\tupdated_session_999\n"
	if _, err := Save("instagram", updateSession); err != nil {
		t.Fatalf("Update sessionid error: %v", err)
	}

	content, _, _ = Read("instagram")
	if !strings.Contains(content, "sessionid\tupdated_session_999") {
		t.Fatalf("expected sessionid to be updated, got:\n%s", content)
	}
	if strings.Contains(content, "sessionid\tinitial_session_123") {
		t.Fatalf("old sessionid should be replaced, got:\n%s", content)
	}
	// Verify other keys still present
	for _, expected := range []string{"ds_user_id\tuser_987", "datr\tdatr_abc", "csrftoken\tnew_token_456", "mid\tnew_mid_789"} {
		if !strings.Contains(content, expected) {
			t.Fatalf("expected key %q to still be present, got:\n%s", expected, content)
		}
	}
}
