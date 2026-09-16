package x

import (
	"context"
	"encoding/base64"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func TestXSafeFilename(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"[X]_photo_01.jpeg", "[X]_photo_01.jpeg"},
		{"[X]_video.mp4", "[X]_video.mp4"},
		{"", "x_post.mp4"},
		{".", "x_post.mp4"},
		{"/path/to/my_file.jpeg", "my_file.jpeg"},
	}

	for _, tt := range tests {
		got := safeFilename(tt.input)
		if got != tt.expected {
			t.Errorf("safeFilename(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestXWriteDataURL(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "x-data-url-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Test 1: plain url-encoded text
	textContent := "Tác giả: Jack (@jack)\nThời gian: 2026-09-16\nNội dung: Hello X World!"
	dataURL := "data:text/plain;charset=utf-8," + url.QueryEscape(textContent)
	dest1 := filepath.Join(tmpDir, "test1.txt")

	if err := writeDataURL(dataURL, dest1); err != nil {
		t.Fatalf("writeDataURL failed for plain text: %v", err)
	}
	readBytes, err := os.ReadFile(dest1)
	if err != nil {
		t.Fatalf("failed to read dest1: %v", err)
	}
	if string(readBytes) != textContent {
		t.Errorf("got %q, want %q", string(readBytes), textContent)
	}

	// Test 2: base64 encoded text
	sampleText := "Tác giả: X User"
	b64URL := "data:text/plain;base64," + base64.StdEncoding.EncodeToString([]byte(sampleText))
	dest2 := filepath.Join(tmpDir, "test2.txt")
	if err := writeDataURL(b64URL, dest2); err != nil {
		t.Fatalf("writeDataURL failed for base64: %v", err)
	}
	readBytes2, err := os.ReadFile(dest2)
	if err != nil {
		t.Fatalf("failed to read dest2: %v", err)
	}
	if string(readBytes2) != sampleText {
		t.Errorf("base64 decode mismatch, got %q, want %q", string(readBytes2), sampleText)
	}
}

func TestXJobSnapshots(t *testing.T) {
	jobID := "test-x-job-123"
	items := []DownloadItem{
		{
			URL:      "data:text/plain;charset=utf-8,Test%20Content",
			Filename: "[X]_test_post.txt",
			Type:     "text",
		},
	}

	job := &Job{
		ID:          jobID,
		CanonicalID: jobID,
		Filename:    "[X]_test_post.txt",
		State:       "completed",
		items:       items,
	}

	activeJobs.Lock()
	activeJobs.items[jobID] = job
	activeJobs.Unlock()
	defer func() {
		activeJobs.Lock()
		delete(activeJobs.items, jobID)
		activeJobs.Unlock()
	}()

	snap, found := GetJobSnapshot(jobID)
	if !found {
		t.Fatalf("GetJobSnapshot(%q) not found", jobID)
	}
	if snap.ID != jobID {
		t.Errorf("snap.ID = %q, want %q", snap.ID, jobID)
	}
	if snap.Filename != "[X]_test_post.txt" {
		t.Errorf("snap.Filename = %q, want [X]_test_post.txt", snap.Filename)
	}

	// Test SetCanonicalID
	if !SetCanonicalID(jobID, "canonical-456") {
		t.Errorf("SetCanonicalID returned false")
	}
	snap2, _ := GetJobSnapshot(jobID)
	if snap2.CanonicalID != "canonical-456" {
		t.Errorf("snap.CanonicalID = %q, want canonical-456", snap2.CanonicalID)
	}
}

func TestXCommitMediaFile(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "x-commit-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	srcDir := filepath.Join(tmpDir, "workspace")
	dstDir := filepath.Join(tmpDir, "dest")
	_ = os.MkdirAll(srcDir, 0755)
	_ = os.MkdirAll(dstDir, 0755)

	srcFile := filepath.Join(srcDir, "[X]_photo_01.jpeg")
	if err := os.WriteFile(srcFile, []byte("fake-jpeg-data"), 0644); err != nil {
		t.Fatalf("failed to write src file: %v", err)
	}

	finalPath, err := commitMediaFile(context.Background(), srcFile, dstDir, "[X]_photo_01.jpeg", "test-commit-job")
	if err != nil {
		t.Fatalf("commitMediaFile failed: %v", err)
	}

	if _, err := os.Stat(finalPath); err != nil {
		t.Errorf("committed file does not exist at %s: %v", finalPath, err)
	}
}
