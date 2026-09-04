package httpapi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"appview/coordinator/internal/scheduler"
	"appview/coordinator/internal/service"
	"appview/coordinator/internal/task"
	"appview/coordinator/internal/worker"
)

func TestVersionedCoordinatorRoutes(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	mux := http.NewServeMux()
	Register(mux, coordinator)

	tests := []struct {
		name   string
		method string
		path   string
		body   string
		status int
	}{
		{name: "generic task", method: http.MethodPost, path: "/api/v1/tasks", body: `{"action":"test"}`, status: http.StatusAccepted},
		{name: "download job", method: http.MethodPost, path: "/api/v1/download", body: `{"url":"https://example.test/file"}`, status: http.StatusAccepted},
		{name: "legacy generic path removed", method: http.MethodPost, path: "/api/tasks", body: `{"action":"test"}`, status: http.StatusNotFound},
		{name: "legacy plural download path removed", method: http.MethodPost, path: "/api/downloads", body: `{"url":"https://example.test/file"}`, status: http.StatusNotFound},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(test.method, test.path, bytes.NewBufferString(test.body))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			mux.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d; body=%s", response.Code, test.status, response.Body.String())
			}
		})
	}
}

func TestCoordinatorCORS(t *testing.T) {
	coordinator := service.New(worker.NewRegistry(), task.NewRegistry(), scheduler.New(), 2)
	mux := http.NewServeMux()
	Register(mux, coordinator)
	handler := WithCORS(mux, []string{"https://web.appview.test"})
	allowedOrigin := "http://192.168.1.252:5173"

	t.Run("preflight download", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodOptions, "/api/v1/download", nil)
		request.Header.Set("Origin", allowedOrigin)
		request.Header.Set("Access-Control-Request-Method", http.MethodPost)
		request.Header.Set("Access-Control-Request-Headers", "Content-Type, Authorization")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
		}
		assertCORSHeaders(t, response, allowedOrigin)
	})

	t.Run("allowed post", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodPost, "/api/v1/download", bytes.NewBufferString(`{"url":"https://example.test/file"}`))
		request.Header.Set("Origin", allowedOrigin)
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusAccepted {
			t.Fatalf("status = %d, want %d", response.Code, http.StatusAccepted)
		}
		assertCORSHeaders(t, response, allowedOrigin)
	})

	t.Run("disallowed origin", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodOptions, "/api/v1/download", nil)
		request.Header.Set("Origin", "https://untrusted.example")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusForbidden || response.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Fatalf("unexpected disallowed response: status=%d origin=%q", response.Code, response.Header().Get("Access-Control-Allow-Origin"))
		}
	})
}

func assertCORSHeaders(t *testing.T, response *httptest.ResponseRecorder, origin string) {
	t.Helper()
	if response.Header().Get("Access-Control-Allow-Origin") != origin || response.Header().Get("Access-Control-Allow-Methods") != "GET, POST, PUT, DELETE, OPTIONS" || response.Header().Get("Access-Control-Allow-Headers") != "Content-Type, Authorization" {
		t.Fatalf("missing CORS headers: %#v", response.Header())
	}
}
