package httpapi

import (
	"context"
	"encoding/json"
	"errors"
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

// writeServiceError maps service errors to HTTP 503 (if unavailable) or HTTP 500.
func (h *CookieHandler) writeServiceError(writer http.ResponseWriter, err error) {
	if strings.Contains(strings.ToLower(err.Error()), "unavailable") {
		writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": err.Error()})
}

// parseCookieRequest decodes and validates common cookie request body.
func parseCookieRequest(request *http.Request) (protocol.CookieRequestPayload, error) {
	var body protocol.CookieRequestPayload
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
		return body, errors.New("invalid JSON body")
	}
	body.Platform = strings.TrimSpace(body.Platform)
	if body.Platform == "" {
		return body, errors.New("platform is required")
	}
	body.Cookies = strings.TrimSpace(body.Cookies)
	return body, nil
}

// getStoredCookies retrieves saved cookies from Storage and verifies presence.
func (h *CookieHandler) getStoredCookies(ctx context.Context, platform string) (string, bool, error) {
	saved, err := h.coordinator.GetCookieContent(ctx, platform)
	if err != nil {
		return "", false, err
	}
	cookies := strings.TrimSpace(saved.Cookies)
	if !saved.Exists || cookies == "" {
		return "", false, nil
	}
	return cookies, true, nil
}

// logAndRespondVerify logs verification results and sends HTTP 200 response.
func (h *CookieHandler) logAndRespondVerify(writer http.ResponseWriter, platform, action string, res protocol.CookieVerifyResult) {
	level := "INFO"
	if !res.Valid {
		level = "WARN"
	}
	logging.Event(level, action, map[string]any{
		"platform": platform,
		"valid":    res.Valid,
		"message":  res.Message,
	})
	writeJSON(writer, http.StatusOK, res)
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
		h.writeServiceError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, res)
}

func (h *CookieHandler) Save(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	body, err := parseCookieRequest(request)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if body.Cookies == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "cookies cannot be empty"})
		return
	}

	ctx, cancel := context.WithTimeout(request.Context(), 15*time.Second)
	defer cancel()

	// Overwrite = true: replaces old cookie file with new attributes completely
	res, err := h.coordinator.SaveCookies(ctx, body.Platform, body.Cookies, true)
	if err != nil {
		h.writeServiceError(writer, err)
		return
	}
	res.Message = "Cookies saved successfully."
	logging.Event("INFO", "cookie overwrite saved", map[string]any{
		"platform": body.Platform,
		"success":  res.Success,
	})
	writeJSON(writer, http.StatusOK, res)
}

func (h *CookieHandler) Update(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	body, err := parseCookieRequest(request)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(request.Context(), 60*time.Second)
	defer cancel()

	cookies, found, err := h.getStoredCookies(ctx, body.Platform)
	if err != nil {
		h.writeServiceError(writer, err)
		return
	}
	if !found {
		writeJSON(writer, http.StatusOK, protocol.CookieVerifyResult{
			Valid:   false,
			Message: fmt.Sprintf("No cookies configured for %s.", body.Platform),
		})
		return
	}

	res, err := h.coordinator.VerifyCookies(ctx, body.Platform, cookies, true)
	if err != nil {
		h.writeServiceError(writer, err)
		return
	}
	h.logAndRespondVerify(writer, body.Platform, "cookie update completed", res)
}

func (h *CookieHandler) Verify(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	body, err := parseCookieRequest(request)
	if err != nil {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(request.Context(), 60*time.Second)
	defer cancel()

	cookies := body.Cookies
	if cookies == "" {
		stored, found, err := h.getStoredCookies(ctx, body.Platform)
		if err != nil {
			h.writeServiceError(writer, err)
			return
		}
		if !found {
			writeJSON(writer, http.StatusOK, protocol.CookieVerifyResult{
				Valid:   false,
				Message: fmt.Sprintf("No cookies configured for %s.", body.Platform),
			})
			return
		}
		cookies = stored
	}

	res, err := h.coordinator.VerifyCookies(ctx, body.Platform, cookies, false)
	if err != nil {
		h.writeServiceError(writer, err)
		return
	}
	h.logAndRespondVerify(writer, body.Platform, "cookie verification completed", res)
}
