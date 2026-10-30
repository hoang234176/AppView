package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	"appview/coordinator/internal/protocol"
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

func (h *FolderHandler) GetFolder(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	drive := strings.TrimSpace(query.Get("drive"))
	path := strings.TrimSpace(query.Get("path"))

	parseInt := func(val string, def int) int {
		if val == "" {
			return def
		}
		if num, err := strconv.Atoi(val); err == nil {
			return num
		}
		return def
	}

	req := protocol.FolderContentsRequestPayload{
		Drive:        drive,
		Path:         path,
		Page:         parseInt(query.Get("page"), 1),
		Limit:        parseInt(query.Get("limit"), 0),
		FolderLimit:  parseInt(query.Get("folder_limit"), 0),
		PictureLimit: parseInt(query.Get("picture_limit"), 0),
		VideoLimit:   parseInt(query.Get("video_limit"), 0),
		FolderPage:   parseInt(query.Get("folder_page"), 1),
		PicturePage:  parseInt(query.Get("picture_page"), 1),
		VideoPage:    parseInt(query.Get("video_page"), 1),
	}

	contents, err := h.coordinator.GetFolderContents(request.Context(), req)
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
		"data":    contents,
	})
}
