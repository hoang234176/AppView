package httpapi

import (
	"net/http"

	"appview/coordinator/internal/service"
)

func Register(mux *http.ServeMux, coordinator *service.Coordinator) {
	api := NewTaskHandler(coordinator)
	downloads := NewDownloadHandler(coordinator)
	mux.HandleFunc("POST /api/v1/tasks", api.Create)
	mux.HandleFunc("GET /api/v1/tasks/{id}", api.Get)
	mux.HandleFunc("POST /api/v1/download", downloads.Create)
	mux.HandleFunc("GET /api/v1/download/{id}", downloads.Get)
	mux.HandleFunc("GET /health", Health(coordinator))
}
