package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"appview/coordinator/internal/protocol"
	"appview/coordinator/internal/service"
)

type CookieHandler struct {
	coordinator *service.Coordinator
}

func NewCookieHandler(coordinator *service.Coordinator) *CookieHandler {
	return &CookieHandler{coordinator: coordinator}
}

func (h *CookieHandler) Status(writer http.ResponseWriter, request *http.Request) {
	platform := strings.TrimSpace(request.URL.Query().Get("platform"))
	if platform == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "platform query parameter is required"})
		return
	}
	res, err := h.coordinator.GetCookieStatus(request.Context(), platform)
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
	if strings.TrimSpace(body.Cookies) == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "cookies cannot be empty"})
		return
	}
	res, err := h.coordinator.VerifyCookies(request.Context(), platform, body.Cookies)
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

func (h *CookieHandler) Save(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
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
	if strings.TrimSpace(body.Cookies) == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "cookies cannot be empty"})
		return
	}
	res, err := h.coordinator.SaveCookies(request.Context(), platform, body.Cookies)
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
