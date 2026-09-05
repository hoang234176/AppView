package logging

import (
	"bytes"
	"log"
	"strings"
	"testing"
)

func TestFormatEvent(t *testing.T) {
	entry := formatEvent("INFO", "Worker connected", map[string]any{"workerId": "storage-1"})
	if !strings.Contains(entry, "INFO  [COORDINATOR] Worker connected | workerId=storage-1") {
		t.Fatalf("unexpected entry: %q", entry)
	}

	// Test redundant prefix stripping
	entryPrefix := formatEvent("INFO", "[COORDINATOR] Worker connected", nil)
	if strings.Contains(entryPrefix, "[COORDINATOR] [COORDINATOR]") {
		t.Fatalf("did not strip redundant coordinator prefix: %q", entryPrefix)
	}

	// Test error formatting
	errEntry := formatEvent("ERROR", "task failed", map[string]any{"errorCode": "FINALIZE_FAILED", "error": "permission denied"})
	if !strings.Contains(errEntry, "task failed | [FINALIZE_FAILED] permission denied") {
		t.Fatalf("unexpected error format: %q", errEntry)
	}
}

func TestEventOutput(t *testing.T) {
	var buf bytes.Buffer
	origWriter := log.Writer()
	origFlags := log.Flags()
	defer func() {
		log.SetOutput(origWriter)
		log.SetFlags(origFlags)
	}()

	log.SetOutput(&buf)
	log.SetFlags(0)

	Event("INFO", "task created", map[string]any{"taskId": "task-123", "action": "download"})
	got := buf.String()
	if !strings.Contains(got, "INFO  [COORDINATOR] task created") {
		t.Fatalf("missing expected format in: %q", got)
	}
	if !strings.Contains(got, "taskId=task-123") || !strings.Contains(got, "action=download") {
		t.Fatalf("missing fields in: %q", got)
	}
}
