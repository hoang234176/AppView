package httpapi

import (
	"net/http"

	"appview/coordinator/internal/service"
)

func Register(mux *http.ServeMux, coordinator *service.Coordinator) {
	api := NewTaskHandler(coordinator)
	mux.HandleFunc("POST /api/tasks", api.Create)
	mux.HandleFunc("GET /api/tasks/{id}", api.Get)
	mux.HandleFunc("GET /health", Health(coordinator))
}
