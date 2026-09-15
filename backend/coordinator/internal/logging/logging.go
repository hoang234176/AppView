package logging

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
)

func init() {
	// Disable default log flags (date/time) because Event provides its own HH:mm:ss timestamp.
	log.SetFlags(0)
}

// Event writes a single clean human-readable log line without accepting request payloads.
// Callers must not include passwords, signed URLs, headers, or tokens.
func Event(level, message string, fields map[string]any) {
	if !enabled(level) {
		return
	}
	log.Print(formatEvent(level, message, fields))
}

func formatEvent(level, message string, fields map[string]any) string {
	now := time.Now().Format("15:04:05")
	lvl := padLevel(level)

	msg := strings.TrimSpace(message)
	// Strip redundant coordinator prefix if present
	if strings.HasPrefix(strings.ToUpper(msg), "[COORDINATOR]") {
		msg = strings.TrimSpace(msg[len("[COORDINATOR]"):])
	}

	formattedFields := formatFields(fields)
	if formattedFields != "" {
		return fmt.Sprintf("%s %s [COORDINATOR] %s | %s", now, lvl, msg, formattedFields)
	}
	return fmt.Sprintf("%s %s [COORDINATOR] %s", now, lvl, msg)
}

func padLevel(level string) string {
	switch strings.ToUpper(strings.TrimSpace(level)) {
	case "INFO":
		return "INFO "
	case "WARN", "WARNING":
		return "WARN "
	case "ERROR":
		return "ERROR"
	case "DEBUG":
		return "DEBUG"
	default:
		lvl := strings.ToUpper(strings.TrimSpace(level))
		if len(lvl) < 5 {
			return lvl + strings.Repeat(" ", 5-len(lvl))
		}
		return lvl
	}
}

func formatFields(fields map[string]any) string {
	if len(fields) == 0 {
		return ""
	}

	// Check if this is an error structure with errorCode and error/message
	errorCode, hasErrorCode := fields["errorCode"].(string)
	errMsg, hasErrMsg := fields["error"].(string)
	if !hasErrMsg {
		errMsg, hasErrMsg = fields["message"].(string)
	}

	keys := make([]string, 0, len(fields))
	for k := range fields {
		if hasErrorCode && (k == "errorCode" || k == "error" || (k == "message" && hasErrMsg)) {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var parts []string
	if hasErrorCode && errorCode != "" {
		if hasErrMsg && errMsg != "" {
			parts = append(parts, fmt.Sprintf("[%s] %s", errorCode, errMsg))
		} else {
			parts = append(parts, fmt.Sprintf("[%s]", errorCode))
		}
	}

	for _, k := range keys {
		v := fields[k]
		if v == nil {
			continue
		}
		switch val := v.(type) {
		case string:
			if val != "" {
				parts = append(parts, fmt.Sprintf("%s=%s", k, val))
			}
		case []any:
			var strItems []string
			for _, item := range val {
				strItems = append(strItems, fmt.Sprint(item))
			}
			parts = append(parts, fmt.Sprintf("%s=[%s]", k, strings.Join(strItems, ", ")))
		default:
			parts = append(parts, fmt.Sprintf("%s=%v", k, val))
		}
	}

	return strings.Join(parts, " ")
}

func enabled(level string) bool {
	ranks := map[string]int{"DEBUG": 0, "INFO": 1, "WARN": 2, "WARNING": 2, "ERROR": 3}
	configured := strings.ToUpper(strings.TrimSpace(os.Getenv("LOG_LEVEL")))
	if configured == "" {
		configured = "INFO"
	}
	return ranks[strings.ToUpper(level)] >= ranks[configured]
}

// SafeURL removes query parameters and userinfo to prevent logging sensitive tokens.
func SafeURL(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	return fmt.Sprintf("%s://%s%s", parsed.Scheme, parsed.Host, parsed.Path)
}
