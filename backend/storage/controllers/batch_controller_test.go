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
