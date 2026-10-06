package controllers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"backend/configs"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

func TestHandleBatchItemsAPI(t *testing.T) {
	tempRoot := t.TempDir()
	configs.DEFAULT_ROOT_PATH = tempRoot

	testFile := filepath.Join(tempRoot, "sample.txt")
	_ = os.WriteFile(testFile, []byte("api test content"), 0644)

	app := fiber.New()
	app.Post("/api/v1/items/batch", HandleBatchItems)
	app.Get("/api/v1/jobs/batch/:job_id", GetBatchJobStatus)

	// 1. Post Batch Copy
	reqBody := BatchRequest{
		Action: "copy",
		Items: []utils.BatchItem{
			{Type: "file", Path: "sample.txt"},
		},
		DestFolder: "copied_dir",
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/v1/items/batch", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK && resp.StatusCode != fiber.StatusAccepted {
		t.Fatalf("expected 200 or 202, got %d", resp.StatusCode)
	}

	var resData struct {
		Success bool     `json:"success"`
		Job     BatchJob `json:"job"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&resData)

	if !resData.Success || resData.Job.ID == "" {
		t.Fatalf("expected job creation, got %+v", resData)
	}

	// 2. Poll status
	pollReq := httptest.NewRequest("GET", "/api/v1/jobs/batch/"+resData.Job.ID, nil)
	pollResp, err := app.Test(pollReq)
	if err != nil {
		t.Fatalf("poll failed: %v", err)
	}
	if pollResp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", pollResp.StatusCode)
	}

	// Wait for background goroutine to complete so events don't bleed into adjacent tests
	for i := 0; i < 50; i++ {
		batchJobsMu.RLock()
		job := batchJobs[resData.Job.ID]
		batchJobsMu.RUnlock()
		if job != nil && (job.Status == "completed" || job.Status == "failed") {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestHandleCheckBatchConflictsAPI(t *testing.T) {
	tempRoot := t.TempDir()
	configs.DEFAULT_ROOT_PATH = tempRoot

	srcFile := filepath.Join(tempRoot, "video.mp4")
	_ = os.WriteFile(srcFile, []byte("source video"), 0644)

	destDir := filepath.Join(tempRoot, "target_dir")
	_ = os.MkdirAll(destDir, 0755)
	destFile := filepath.Join(destDir, "video.mp4")
	_ = os.WriteFile(destFile, []byte("existing video"), 0644)

	app := fiber.New()
	app.Post("/api/v1/items/batch/check-conflicts", HandleCheckBatchConflicts)
	app.Post("/api/v1/items/batch", HandleBatchItems)

	// 1. Check conflicts: should report conflict on video.mp4
	reqBody := BatchRequest{
		Action: "copy",
		Items: []utils.BatchItem{
			{Type: "video", Path: "video.mp4"},
		},
		DestFolder: "target_dir",
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/v1/items/batch/check-conflicts", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var resData struct {
		HasConflicts bool           `json:"has_conflicts"`
		Conflicts    []ConflictItem `json:"conflicts"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&resData)

	if !resData.HasConflicts || len(resData.Conflicts) != 1 {
		t.Fatalf("expected 1 conflict, got %+v", resData)
	}
	if resData.Conflicts[0].FileName != "video.mp4" || resData.Conflicts[0].Type != "video" {
		t.Fatalf("unexpected conflict details: %+v", resData.Conflicts[0])
	}

	// 2. Perform copy with keep_both resolution -> should create video (1).mp4
	reqBody.Resolutions = map[string]string{
		"video.mp4": "keep_both",
	}
	bodyBytes, _ = json.Marshal(reqBody)

	copyReq := httptest.NewRequest("POST", "/api/v1/items/batch", bytes.NewReader(bodyBytes))
	copyReq.Header.Set("Content-Type", "application/json")

	copyResp, err := app.Test(copyReq)
	if err != nil {
		t.Fatalf("copy request failed: %v", err)
	}
	if copyResp.StatusCode != fiber.StatusOK && copyResp.StatusCode != fiber.StatusAccepted {
		t.Fatalf("expected 200/202, got %d", copyResp.StatusCode)
	}

	time.Sleep(100 * time.Millisecond)

	expectedNewFile := filepath.Join(destDir, "video (1).mp4")
	if _, err := os.Stat(expectedNewFile); os.IsNotExist(err) {
		t.Fatalf("expected %s to be created by keep_both resolution", expectedNewFile)
	}
	// Original destFile should still exist
	if _, err := os.Stat(destFile); os.IsNotExist(err) {
		t.Fatalf("original dest file was lost: %s", destFile)
	}
}
