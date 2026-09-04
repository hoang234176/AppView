package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"appview/coordinator/internal/logging"
	"appview/coordinator/internal/service"
)

type DownloadHandler struct{ coordinator *service.Coordinator }

type createDownloadRequest struct {
	URL         string `json:"url"`
	Filename    string `json:"filename,omitempty"`
	Destination string `json:"destination,omitempty"`
	Password    string `json:"password,omitempty"`
}

func NewDownloadHandler(coordinator *service.Coordinator) *DownloadHandler {
	return &DownloadHandler{coordinator: coordinator}
}

func (h *DownloadHandler) Create(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	var body createDownloadRequest
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
		logging.Event("WARN", "download request rejected", map[string]any{"error": "invalid JSON body"})
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if strings.TrimSpace(body.URL) == "" {
		logging.Event("WARN", "download request rejected", map[string]any{"error": "url is required"})
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "url is required"})
		return
	}
	job, err := h.coordinator.CreateDownload(service.DownloadRequest{
		URL: body.URL, Filename: body.Filename, Destination: body.Destination, Password: body.Password,
	})
	if err != nil {
		logging.Event("WARN", "download request rejected", map[string]any{"error": err.Error()})
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(writer, http.StatusAccepted, job)
}

func (h *DownloadHandler) Get(writer http.ResponseWriter, request *http.Request) {
	job, ok := h.coordinator.GetDownload(request.PathValue("id"))
	if !ok {
		logging.Event("WARN", "download job not found", map[string]any{"jobId": request.PathValue("id")})
		writeJSON(writer, http.StatusNotFound, map[string]string{"error": "download job not found"})
		return
	}
	writeJSON(writer, http.StatusOK, job)
}

func (h *DownloadHandler) List(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, map[string]any{"jobs": h.coordinator.ListDownloads()})
}
