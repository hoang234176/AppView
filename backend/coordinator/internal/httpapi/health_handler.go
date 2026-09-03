package httpapi

import (
	"appview/coordinator/internal/service"
	"net/http"
)

func Health(coordinator *service.Coordinator) http.HandlerFunc {
	return func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]any{"status": "ok", "workers": coordinator.WorkerCount()})
	}
}
