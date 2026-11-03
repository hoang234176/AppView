package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	defer func() {
		if r := recover(); r != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("Internal server error: %v", r),
			})
		}
	}()

	drive := strings.TrimSpace(request.URL.Query().Get("drive"))

	ctx, cancel := context.WithTimeout(request.Context(), 10*time.Second)
	defer cancel()

	tree, err := h.coordinator.GetFolderTree(ctx, drive)
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
	defer func() {
		if r := recover(); r != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("Internal server error: %v", r),
			})
		}
	}()

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

	ctx, cancel := context.WithTimeout(request.Context(), 15*time.Second)
	defer cancel()

	contents, err := h.coordinator.GetFolderContents(ctx, req)
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

func (h *FolderHandler) GetFolderStats(writer http.ResponseWriter, request *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("Internal server error: %v", r),
			})
		}
	}()

	query := request.URL.Query()
	drive := strings.TrimSpace(query.Get("drive"))
	path := strings.TrimSpace(query.Get("path"))

	req := protocol.FolderStatsRequestPayload{
		Drive: drive,
		Path:  path,
	}

	ctx, cancel := context.WithTimeout(request.Context(), 15*time.Second)
	defer cancel()

	stats, err := h.coordinator.GetFolderStats(ctx, req)
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
		"data":    stats,
	})
}

func (h *FolderHandler) CreateFolder(writer http.ResponseWriter, request *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("Internal server error: %v", r),
			})
		}
	}()

	if request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req protocol.FolderCreateRequestPayload
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid request payload"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "Folder name cannot be empty"})
		return
	}

	ctx, cancel := context.WithTimeout(request.Context(), 8*time.Second)
	defer cancel()

	res, err := h.coordinator.CreateFolder(ctx, req)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(strings.ToLower(errStr), "unavailable") {
			writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": errStr})
			return
		}
		if strings.Contains(errStr, "FOLDER_ALREADY_EXISTS") || strings.Contains(errStr, "already exists") || strings.Contains(errStr, "file exists") {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "Folder already exists"})
			return
		}
		if strings.Contains(errStr, "INVALID_FOLDER_NAME") {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": errStr})
			return
		}
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": errStr})
		return
	}

	writeJSON(writer, http.StatusCreated, res)
}

func (h *FolderHandler) RenameFolder(writer http.ResponseWriter, request *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("Internal server error: %v", r),
			})
		}
	}()

	if request.Method != http.MethodPatch && request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req protocol.FolderRenameRequestPayload
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid request payload"})
		return
	}

	req.NewName = strings.TrimSpace(req.NewName)
	if req.NewName == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "Folder name cannot be empty"})
		return
	}

	req.Path = strings.TrimSpace(req.Path)
	if req.Path == "" || req.Path == "/" || req.Path == "." {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "Cannot rename root drive folder"})
		return
	}

	ctx, cancel := context.WithTimeout(request.Context(), 8*time.Second)
	defer cancel()

	res, err := h.coordinator.RenameFolder(ctx, req)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(strings.ToLower(errStr), "unavailable") {
			writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": errStr})
			return
		}
		if strings.Contains(errStr, "FOLDER_ALREADY_EXISTS") || strings.Contains(errStr, "already exists") || strings.Contains(errStr, "file exists") {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "Folder already exists"})
			return
		}
		if strings.Contains(errStr, "INVALID_FOLDER_NAME") {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": errStr})
			return
		}
		if strings.Contains(errStr, "FOLDER_NOT_FOUND") || strings.Contains(errStr, "not exist") {
			writeJSON(writer, http.StatusNotFound, map[string]string{"error": "Folder not found"})
			return
		}
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": errStr})
		return
	}

	writeJSON(writer, http.StatusOK, res)
}

func (h *FolderHandler) DeleteFolder(writer http.ResponseWriter, request *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			writeJSON(writer, http.StatusInternalServerError, map[string]string{
				"error": fmt.Sprintf("Internal server error: %v", r),
			})
		}
	}()

	if request.Method != http.MethodDelete && request.Method != http.MethodPost {
		writeJSON(writer, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var req protocol.FolderDeleteRequestPayload
	query := request.URL.Query()
	req.Drive = strings.TrimSpace(query.Get("drive"))
	req.Path = strings.TrimSpace(query.Get("path"))

	if request.Body != nil && request.ContentLength > 0 {
		var bodyReq protocol.FolderDeleteRequestPayload
		if err := json.NewDecoder(request.Body).Decode(&bodyReq); err == nil {
			if bodyReq.Drive != "" {
				req.Drive = strings.TrimSpace(bodyReq.Drive)
			}
			if bodyReq.Path != "" {
				req.Path = strings.TrimSpace(bodyReq.Path)
			}
		}
	}

	if req.Drive == "" {
		req.Drive = "HDD"
	}
	req.Path = strings.TrimSpace(req.Path)
	if req.Path == "" || req.Path == "/" || req.Path == "." {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "Cannot delete root drive folder"})
		return
	}

	ctx, cancel := context.WithTimeout(request.Context(), 10*time.Second)
	defer cancel()

	res, err := h.coordinator.DeleteFolder(ctx, req)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(strings.ToLower(errStr), "unavailable") {
			writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": errStr})
			return
		}
		if strings.Contains(errStr, "PERMISSION_DENIED") || strings.Contains(errStr, "permission") {
			writeJSON(writer, http.StatusForbidden, map[string]string{"error": "Permission denied"})
			return
		}
		if strings.Contains(errStr, "FOLDER_NOT_FOUND") || strings.Contains(errStr, "not exist") {
			writeJSON(writer, http.StatusNotFound, map[string]string{"error": "Folder not found"})
			return
		}
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": errStr})
		return
	}

	writeJSON(writer, http.StatusOK, map[string]any{
		"message": "Folder deleted successfully",
		"data":    res,
	})
}
