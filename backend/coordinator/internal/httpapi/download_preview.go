package httpapi

import (
	"encoding/json"
	"net/http"

	"appview/coordinator/internal/protocol"
)

func (h *DownloadHandler) Preview(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	var body struct {
		URL string `json:"url"`
	}
	if json.NewDecoder(http.MaxBytesReader(writer, request.Body, 8192)).Decode(&body) != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]any{"error": protocol.ErrorPayload{Code: "INVALID_URL", Message: "Liên kết không hợp lệ."}})
		return
	}
	preview, failure := h.coordinator.PreviewDownload(request.Context(), body.URL)
	if failure != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]any{"error": failure})
		return
	}
	writeJSON(writer, http.StatusOK, preview)
}
