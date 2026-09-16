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

func TestSaveMergePreservesMultiDomainCookies(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)

	// Cookie string with the same cookie name (SID, HSID) on both .youtube.com and .google.com
	multiDomainCookies := "# Netscape HTTP Cookie File\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tLOGIN_INFO\tlogin_123\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tsid_val_yt\n" +
		".google.com\tTRUE\t/\tTRUE\t2147483647\tSID\tsid_val_yt\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tHSID\thsid_val_yt\n" +
		".google.com\tTRUE\t/\tTRUE\t2147483647\tHSID\thsid_val_yt\n"

	if _, err := Save("youtube", multiDomainCookies); err != nil {
		t.Fatalf("Save error: %v", err)
	}

	content, exists, err := Read("youtube")
	if err != nil || !exists {
		t.Fatalf("Read error: %v, exists: %v", err, exists)
	}

	// Verify both domains are preserved in the saved file
	expectedEntries := []string{
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tsid_val_yt",
		".google.com\tTRUE\t/\tTRUE\t2147483647\tSID\tsid_val_yt",
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tHSID\thsid_val_yt",
		".google.com\tTRUE\t/\tTRUE\t2147483647\tHSID\thsid_val_yt",
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tLOGIN_INFO\tlogin_123",
	}
	for _, entry := range expectedEntries {
		if !strings.Contains(content, entry) {
			t.Fatalf("expected content to contain %q, but got:\n%s", entry, content)
		}
	}

	// Update SID value on both domains and add a new cookie
	updatedCookies := "# Netscape HTTP Cookie File\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tnew_sid_yt\n" +
		".google.com\tTRUE\t/\tTRUE\t2147483647\tSID\tnew_sid_yt\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\t__Secure-1PSIDTS\tts_token\n" +
		".google.com\tTRUE\t/\tTRUE\t2147483647\t__Secure-1PSIDTS\tts_token\n"

	if _, err := Save("youtube", updatedCookies); err != nil {
		t.Fatalf("Update Save error: %v", err)
	}

	updatedContent, _, _ := Read("youtube")
	expectedUpdatedEntries := []string{
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tnew_sid_yt",
		".google.com\tTRUE\t/\tTRUE\t2147483647\tSID\tnew_sid_yt",
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tHSID\thsid_val_yt",
		".google.com\tTRUE\t/\tTRUE\t2147483647\tHSID\thsid_val_yt",
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tLOGIN_INFO\tlogin_123",
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\t__Secure-1PSIDTS\tts_token",
		".google.com\tTRUE\t/\tTRUE\t2147483647\t__Secure-1PSIDTS\tts_token",
	}
	for _, entry := range expectedUpdatedEntries {
		if !strings.Contains(updatedContent, entry) {
			t.Fatalf("expected updated content to contain %q, but got:\n%s", entry, updatedContent)
		}
	}
}

func TestSaveMergeNeverOverwritesWithEmptyValue(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)

	initial := "# Netscape HTTP Cookie File\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tkeep_this_sid\n"
	if _, err := Save("youtube", initial); err != nil {
		t.Fatalf("initial save: %v", err)
	}

	// Incoming has empty value for SID
	incoming := "# Netscape HTTP Cookie File\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\t\n"
	if _, err := Save("youtube", incoming); err != nil {
		t.Fatalf("incoming save: %v", err)
	}

	content, _, _ := Read("youtube")
	if !strings.Contains(content, "keep_this_sid") {
		t.Fatalf("expected non-empty SID to be preserved, got:\n%s", content)
	}
}

func TestSaveMergePreservesEssentialYouTubeTokens(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)

	initial := "# Netscape HTTP Cookie File\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tsid_123\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\t__Secure-1PSID\tsid1p_456\n"
	if _, err := Save("youtube", initial); err != nil {
		t.Fatalf("initial save: %v", err)
	}

	// Incoming only has a new token (e.g. VISITOR_INFO1_LIVE), missing SID and __Secure-1PSID
	incoming := "# Netscape HTTP Cookie File\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tVISITOR_INFO1_LIVE\tvis_789\n"
	if _, err := Save("youtube", incoming); err != nil {
		t.Fatalf("incoming save: %v", err)
	}

	content, _, _ := Read("youtube")
	if !strings.Contains(content, "sid_123") || !strings.Contains(content, "sid1p_456") {
		t.Fatalf("expected essential tokens to be preserved, got:\n%s", content)
	}
	if !strings.Contains(content, "vis_789") {
		t.Fatalf("expected new token to be added, got:\n%s", content)
	}
}

func TestSaveNoOpWhenUnchanged(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("APPVIEW_STATE_DIR", tempDir)

	initial := "# Netscape HTTP Cookie File\n" +
		".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tsid_123\n"
	t1, err := Save("youtube", initial)
	if err != nil {
		t.Fatalf("save 1: %v", err)
	}

	// Saving identical content
	t2, err := Save("youtube", initial)
	if err != nil {
		t.Fatalf("save 2: %v", err)
	}

	if !t1.Equal(t2) {
		t.Fatalf("expected mod times to be equal (no-op), got t1=%v t2=%v", t1, t2)
	}
}
