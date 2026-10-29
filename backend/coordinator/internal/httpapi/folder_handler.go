package httpapi

import (
	"net/http"
	"strings"

	"appview/coordinator/internal/service"
)

type FolderHandler struct {
	coordinator *service.Coordinator
}

func NewFolderHandler(coordinator *service.Coordinator) *FolderHandler {
	return &FolderHandler{coordinator: coordinator}
}

func (h *FolderHandler) GetTreeFolder(writer http.ResponseWriter, request *http.Request) {
	drive := strings.TrimSpace(request.URL.Query().Get("drive"))
	tree, err := h.coordinator.GetFolderTree(request.Context(), drive)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unavailable") {
			writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{
		"message": "Success",
		"data":    tree,
	})
}
