package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"appview/coordinator/internal/logging"
	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/service"
)

type CookieHandler struct {
	coordinator *service.Coordinator
}

func NewCookieHandler(coordinator *service.Coordinator) *CookieHandler {
	return &CookieHandler{coordinator: coordinator}
}

func (h *CookieHandler) Content(writer http.ResponseWriter, request *http.Request) {
	platform := strings.TrimSpace(request.URL.Query().Get("platform"))
	if platform == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "platform query parameter is required"})
		return
	}
	ctx, cancel := context.WithTimeout(request.Context(), 10*time.Second)
	defer cancel()

	res, err := h.coordinator.GetCookieContent(ctx, platform)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unavailable") {
			writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(writer, http.StatusOK, res)
}

func (h *CookieHandler) Verify(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	ctx, cancel := context.WithTimeout(request.Context(), 60*time.Second)
	defer cancel()

	var body protocol.CookieRequestPayload
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	platform := strings.TrimSpace(body.Platform)
	if platform == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "platform is required"})
		return
	}
	cookies := strings.TrimSpace(body.Cookies)
	if cookies == "" {
		// Verify currently saved cookies from Storage
		saved, err := h.coordinator.GetCookieContent(ctx, platform)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "unavailable") {
				writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !saved.Exists || strings.TrimSpace(saved.Cookies) == "" {
			writeJSON(writer, http.StatusOK, protocol.CookieVerifyResult{
				Valid:   false,
				Message: fmt.Sprintf("File %s.txt hiện đang trống. Vui lòng dán cookie vào file để tiếp tục.", platform),
			})
			return
		}
		cookies = strings.TrimSpace(saved.Cookies)
	}
	res, err := h.coordinator.VerifyCookies(ctx, platform, cookies)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unavailable") {
			writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	level := "INFO"
	if !res.Valid {
		level = "WARN"
	}
	logging.Event(level, "cookie verification completed", map[string]any{
		"platform": platform,
		"valid":    res.Valid,
		"message":  res.Message,
	})
	writeJSON(writer, http.StatusOK, res)
}
