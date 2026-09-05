package utils

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"
)

func TestFormatEvent(t *testing.T) {
	// Test basic format
	entry := formatEvent("INFO", "Download started: example.zip", nil)
	if !strings.Contains(entry, "INFO  [STORAGE] Download started: example.zip") {
		t.Fatalf("unexpected entry: %q", entry)
	}

	// Test redundant prefix stripping
	entryService := formatEvent("INFO", "[STORAGE SERVICE] Đọc danh sách thư mục", nil)
	if strings.Contains(entryService, "[STORAGE] [STORAGE") {
		t.Fatalf("did not strip [STORAGE SERVICE]: %q", entryService)
	}
	if !strings.Contains(entryService, "[STORAGE] Đọc danh sách thư mục") {
		t.Fatalf("missing clean message: %q", entryService)
	}

	// Test subsystem preservation
	entryArchive := formatEvent("INFO", "[ARCHIVE] Extraction completed", nil)
	if !strings.Contains(entryArchive, "[STORAGE] [ARCHIVE] Extraction completed") {
		t.Fatalf("failed to preserve [ARCHIVE]: %q", entryArchive)
	}

	entryThumb := formatEvent("INFO", "[THUMBNAIL] Đã tạo thumbnail", nil)
	if !strings.Contains(entryThumb, "[STORAGE] [THUMBNAIL] Đã tạo thumbnail") {
		t.Fatalf("failed to preserve [THUMBNAIL]: %q", entryThumb)
	}

	// Test error formatting with errorCode
	entryErr := formatEvent("ERROR", "[ARCHIVE] archive failed", map[string]any{"errorCode": "FINALIZE_FAILED", "error": "permission denied"})
	if !strings.Contains(entryErr, "ERROR [STORAGE] [ARCHIVE] archive failed | [FINALIZE_FAILED] permission denied") {
		t.Fatalf("unexpected error formatting: %q", entryErr)
	}

	// Test fields formatting
	entryFields := formatEvent("INFO", "storage archive start", map[string]any{"taskId": "task-1", "filename": "test.zip"})
	if !strings.Contains(entryFields, "taskId=task-1") || !strings.Contains(entryFields, "filename=test.zip") {
		t.Fatalf("missing fields: %q", entryFields)
	}
}

func TestLogEventOutput(t *testing.T) {
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	origStdout := os.Stdout
	os.Stdout = w
	defer func() {
		os.Stdout = origStdout
	}()

	LogInfo("[STORAGE SERVICE] Test message")
	w.Close()

	var buf bytes.Buffer
	_, _ = io.Copy(&buf, r)
	output := buf.String()

	if !strings.Contains(output, "INFO  [STORAGE] Test message") {
		t.Fatalf("unexpected stdout: %q", output)
	}
}
