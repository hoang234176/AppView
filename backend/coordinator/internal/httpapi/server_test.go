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
