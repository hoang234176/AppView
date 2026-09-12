package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

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

func assembleNetscapeCookies(platform string, fields map[string]string) string {
	if len(fields) == 0 {
		return ""
	}
	var sb strings.Builder
	sb.WriteString("# Netscape HTTP Cookie File\n")
	domain := ".youtube.com"
	if platform != "" && platform != "youtube" {
		domain = "." + platform + ".com"
	}
	orderedKeys := []string{
		"LOGIN_INFO",
		"SID",
		"HSID",
		"SSID",
		"SAPISID",
		"__Secure-1PSID",
		"__Secure-3PSID",
	}
	if platform == "facebook" {
		orderedKeys = []string{
			"c_user",
			"xs",
			"datr",
			"fr",
			"sb",
			"presence",
			"spin",
			"wd",
		}
	} else if platform == "tiktok" {
		orderedKeys = []string{
			"sessionid",
			"sessionid_ss",
			"sid_guard",
			"tt_chain_token",
		}
	}
	used := make(map[string]bool)
	cleanValue := func(v string) string {
		v = strings.ReplaceAll(v, "\r", "")
		v = strings.ReplaceAll(v, "\n", "")
		v = strings.ReplaceAll(v, "\t", "")
		return strings.TrimSpace(v)
	}
	hasAny := false
	for _, key := range orderedKeys {
		if val, ok := fields[key]; ok {
			cleaned := cleanValue(val)
			if cleaned != "" {
				sb.WriteString(fmt.Sprintf("%s\tTRUE\t/\tTRUE\t2147483647\t%s\t%s\n", domain, key, cleaned))
				used[key] = true
				hasAny = true
			}
		}
	}
	for key, val := range fields {
		if !used[key] {
			cleaned := cleanValue(val)
			if cleaned != "" {
				cleanKey := cleanValue(key)
				if cleanKey != "" {
					sb.WriteString(fmt.Sprintf("%s\tTRUE\t/\tTRUE\t2147483647\t%s\t%s\n", domain, cleanKey, cleaned))
					hasAny = true
				}
			}
		}
	}
	if !hasAny {
		return ""
	}
	return sb.String()
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
	cookies := strings.TrimSpace(body.Cookies)
	if cookies == "" && len(body.Fields) > 0 {
		cookies = assembleNetscapeCookies(platform, body.Fields)
		if cookies == "" {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "all fields are empty"})
			return
		}
	}
	if cookies == "" {
		// Attempt to verify currently saved cookies from Storage
		saved, err := h.coordinator.GetCookieContent(request.Context(), platform)
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
				Message: "Chưa có cookie nào được lưu.",
			})
			return
		}
		cookies = strings.TrimSpace(saved.Cookies)
	}
	res, err := h.coordinator.VerifyCookies(request.Context(), platform, cookies)
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
	cookies := strings.TrimSpace(body.Cookies)
	if cookies == "" && len(body.Fields) > 0 {
		cookies = assembleNetscapeCookies(platform, body.Fields)
	}
	if cookies == "" {
		writeJSON(writer, http.StatusBadRequest, map[string]string{"error": "cookies or fields cannot be empty"})
		return
	}
	res, err := h.coordinator.SaveCookies(request.Context(), platform, cookies)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unavailable") {
			writeJSON(writer, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(writer, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saveLevel := "INFO"
	if !res.Success {
		saveLevel = "WARN"
	}
	logging.Event(saveLevel, "cookie save completed", map[string]any{
		"platform":  platform,
		"success":   res.Success,
		"updatedAt": res.UpdatedAt,
	})
	writeJSON(writer, http.StatusOK, res)
}
