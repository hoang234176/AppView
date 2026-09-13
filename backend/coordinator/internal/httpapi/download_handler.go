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
	URL                  string `json:"url"`
	Filename             string `json:"filename,omitempty"`
	Destination          string `json:"destination,omitempty"`
	Password             string `json:"password,omitempty"`
	Quality              *int   `json:"quality,omitempty"`
	SelectedIndices      []int  `json:"selectedIndices,omitempty"`
	SelectedIndicesSnake []int  `json:"selected_indices,omitempty"`
	MediaType            string `json:"mediaType,omitempty"`
	MediaTypeSnake       string `json:"media_type,omitempty"`
}

type extractDownloadRequest struct {
	Password string `json:"password"`
}
type videoDecisionRequest struct {
	Quality string `json:"quality"`
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
	quality := 0
	if body.Quality != nil {
		if *body.Quality <= 0 {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "Chất lượng tải xuống không hợp lệ."})
			return
		}
		quality = *body.Quality
	}
	selectedIndices := body.SelectedIndices
	if len(selectedIndices) == 0 && len(body.SelectedIndicesSnake) > 0 {
		selectedIndices = body.SelectedIndicesSnake
	}
	mediaType := strings.TrimSpace(body.MediaType)
	if mediaType == "" && strings.TrimSpace(body.MediaTypeSnake) != "" {
		mediaType = strings.TrimSpace(body.MediaTypeSnake)
	}
	job, err := h.coordinator.CreateDownload(service.DownloadRequest{
		URL: body.URL, Filename: body.Filename, Destination: body.Destination, Password: body.Password, Quality: quality,
		SelectedIndices: selectedIndices, MediaType: mediaType,
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

func (h *DownloadHandler) StorageInfo(writer http.ResponseWriter, _ *http.Request) {
	info, ok := h.coordinator.GetStorageInfo()
	if !ok {
		writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": "storage information unavailable"})
		return
	}
	writeJSON(writer, http.StatusOK, info)
}

// Retry delegates resumption to the local Storage worker that owns this
// durable archive. Storage resumes from the furthest local artifact.
func (h *DownloadHandler) Retry(writer http.ResponseWriter, request *http.Request) {
	if err := h.coordinator.RetryDownload(request.PathValue("id"), "", false); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writer.WriteHeader(http.StatusAccepted)
}

// Extract forwards a transient password for extraction-only retry. It is not
// persisted, logged, or returned by Coordinator APIs.
func (h *DownloadHandler) Extract(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	var body extractDownloadRequest
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if strings.TrimSpace(body.Password) == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "password is required"})
		return
	}
	if err := h.coordinator.RetryDownload(request.PathValue("id"), body.Password, true); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writer.WriteHeader(http.StatusAccepted)
}

func (h *DownloadHandler) Cancel(writer http.ResponseWriter, request *http.Request) {
	if err := h.coordinator.CancelDownload(request.PathValue("id")); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writer.WriteHeader(http.StatusAccepted)
}

func (h *DownloadHandler) Delete(writer http.ResponseWriter, request *http.Request) {
	if err := h.coordinator.DeleteDownload(request.PathValue("id")); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writer.WriteHeader(http.StatusOK)
}

func (h *DownloadHandler) DecideVideo(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	var body videoDecisionRequest
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil || strings.TrimSpace(body.Quality) == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "quality is required"})
		return
	}
	if err := h.coordinator.DecideVideo(request.PathValue("id"), request.PathValue("videoId"), body.Quality); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writer.WriteHeader(http.StatusAccepted)
}

type applyVideoDecisionsRequest struct {
	Decisions map[string]string `json:"decisions"`
}

func (h *DownloadHandler) ApplyVideoDecisions(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	var body applyVideoDecisionsRequest
	_ = json.NewDecoder(request.Body).Decode(&body)
	if err := h.coordinator.ApplyVideoDecisions(request.PathValue("id"), body.Decisions); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writer.WriteHeader(http.StatusAccepted)
}
