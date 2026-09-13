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
	mux.HandleFunc("POST /api/v1/download/preview", downloads.Preview)
	mux.HandleFunc("GET /api/v1/download", downloads.List)
	mux.HandleFunc("GET /api/v1/storage", downloads.StorageInfo)
	mux.HandleFunc("GET /api/v1/download/{id}", downloads.Get)
	mux.HandleFunc("POST /api/v1/download/{id}/retry", downloads.Retry)
	mux.HandleFunc("POST /api/v1/download/{id}/extract", downloads.Extract)
	mux.HandleFunc("POST /api/v1/download/{id}/cancel", downloads.Cancel)
	mux.HandleFunc("DELETE /api/v1/download/{id}", downloads.Delete)
	mux.HandleFunc("POST /api/v1/download/{id}/delete", downloads.Delete)
	mux.HandleFunc("POST /api/v1/download/{id}/videos/{videoId}/decision", downloads.DecideVideo)
	mux.HandleFunc("POST /api/v1/download/{id}/videos/apply", downloads.ApplyVideoDecisions)
	mux.HandleFunc("GET /api/v1/download/proxy-image", downloads.ProxyImage)
	cookies := NewCookieHandler(coordinator)
	mux.HandleFunc("GET /api/v1/cookies/status", cookies.Status)
	mux.HandleFunc("GET /api/v1/cookies/content", cookies.Content)
	mux.HandleFunc("POST /api/v1/cookies/verify", cookies.Verify)
	mux.HandleFunc("POST /api/v1/cookies/save", cookies.Save)
	mux.HandleFunc("GET /health", Health(coordinator))
}
