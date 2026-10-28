package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/scheduler"
	"appview/coordinator/internal/service"
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
)

type mockWorkerSender struct {
	onSend func(protocol.Message) error
}

func (m *mockWorkerSender) Send(msg protocol.Message) error {
	if m.onSend != nil {
		return m.onSend(msg)
	}
	return nil
}

func TestCookieEndpointsValidationAndNoWorker(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	mux := http.NewServeMux()
	Register(mux, coordinator)

	// 1. Verify missing platform -> 400
	req := httptest.NewRequest(http.MethodPost, "/api/v1/cookies/verify", bytes.NewBufferString(`{"platform":"","cookies":"sample"}`))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}

	// 2. Verify no worker -> 503
	req = httptest.NewRequest(http.MethodPost, "/api/v1/cookies/verify", bytes.NewBufferString(`{"platform":"youtube","cookies":"sample"}`))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}

	// 3. Update missing platform -> 400
	req = httptest.NewRequest(http.MethodPost, "/api/v1/cookies/update", bytes.NewBufferString(`{"platform":""}`))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}

	// 4. Update no storage worker -> 503
	req = httptest.NewRequest(http.MethodPost, "/api/v1/cookies/update", bytes.NewBufferString(`{"platform":"youtube"}`))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}

	// 5. Save missing platform -> 400
	req = httptest.NewRequest(http.MethodPost, "/api/v1/cookies/save", bytes.NewBufferString(`{"platform":"","cookies":"sample"}`))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}

	// 6. Save missing cookies -> 400
	req = httptest.NewRequest(http.MethodPost, "/api/v1/cookies/save", bytes.NewBufferString(`{"platform":"youtube","cookies":""}`))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}

	// 7. Save no storage worker -> 503
	req = httptest.NewRequest(http.MethodPost, "/api/v1/cookies/save", bytes.NewBufferString(`{"platform":"youtube","cookies":"sample"}`))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestCookieEndpointsSuccessWithWorkers(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)

	// Register mock storage worker
	storageSender := &mockWorkerSender{}
	storageSender.onSend = func(msg protocol.Message) error {
		go func() {
			switch msg.Type {
			case protocol.CookieSave:
				now := time.Now().UTC()
				b, _ := json.Marshal(protocol.CookieSaveResult{
					Success:   true,
					UpdatedAt: now,
				})
				coordinator.ResolveRPC(msg.TaskID, protocol.Message{
					Type:   protocol.CookieSave,
					TaskID: msg.TaskID,
					Result: b,
				})
			case protocol.CookieGet:
				b, _ := json.Marshal(protocol.CookieGetResult{
					Platform: "youtube",
					Cookies:  "# netscape cookies",
					Exists:   true,
				})
				coordinator.ResolveRPC(msg.TaskID, protocol.Message{
					Type:   protocol.CookieGet,
					TaskID: msg.TaskID,
					Result: b,
				})
			}
		}()
		return nil
	}
	if err := coordinator.RegisterWorker("storage-worker-1", []protocol.Capability{protocol.DownloadFile}, storageSender); err != nil {
		t.Fatal(err)
	}

	// Register mock download worker
	downloadSender := &mockWorkerSender{}
	downloadSender.onSend = func(msg protocol.Message) error {
		go func() {
			if msg.Type == protocol.CookieVerify {
				b, _ := json.Marshal(protocol.CookieVerifyResult{
					Valid:   true,
					Message: "Verification succeeded",
				})
				coordinator.ResolveRPC(msg.TaskID, protocol.Message{
					Type:   protocol.CookieVerify,
					TaskID: msg.TaskID,
					Result: b,
				})
			}
		}()
		return nil
	}
	if err := coordinator.RegisterWorker("download-worker-1", []protocol.Capability{protocol.ResolveDownload}, downloadSender); err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	Register(mux, coordinator)

	// Test Verify success
	req := httptest.NewRequest(http.MethodPost, "/api/v1/cookies/verify", bytes.NewBufferString(`{"platform":"youtube","cookies":"# sample"}`))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var verifyRes protocol.CookieVerifyResult
	if err := json.Unmarshal(rec.Body.Bytes(), &verifyRes); err != nil {
		t.Fatal(err)
	}
	if !verifyRes.Valid || verifyRes.Message != "Verification succeeded" {
		t.Fatalf("unexpected verify result: %+v", verifyRes)
	}

	// Test Update success
	req = httptest.NewRequest(http.MethodPost, "/api/v1/cookies/update", bytes.NewBufferString(`{"platform":"youtube"}`))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var updateRes protocol.CookieVerifyResult
	if err := json.Unmarshal(rec.Body.Bytes(), &updateRes); err != nil {
		t.Fatal(err)
	}
	if !updateRes.Valid || updateRes.Message != "Verification succeeded" {
		t.Fatalf("unexpected update result: %+v", updateRes)
	}

	// Test Save (overwrite) success
	req = httptest.NewRequest(http.MethodPost, "/api/v1/cookies/save", bytes.NewBufferString(`{"platform":"youtube","cookies":"# fresh cookies"}`))
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var saveRes protocol.CookieSaveResult
	if err := json.Unmarshal(rec.Body.Bytes(), &saveRes); err != nil {
		t.Fatal(err)
	}
	if !saveRes.Success {
		t.Fatalf("expected save success=true, got %+v", saveRes)
	}
}
