package utils

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ANSI Color Codes
const (
	colorReset     = "\033[0m"
	colorDim       = "\033[2m"
	colorBold      = "\033[1m"
	colorGray      = "\033[90m"
	colorRed       = "\033[31m"
	colorBoldRed   = "\033[1;31m"
	colorGreen     = "\033[32m"
	colorBoldGreen = "\033[1;32m"
	colorYellow    = "\033[33m"
	colorBlue      = "\033[34m"
	colorMagenta   = "\033[35m"
	colorCyan      = "\033[36m"
)

var (
	logFile     *os.File
	logFileOnce sync.Once
	logFileMu   sync.Mutex
	useColors   = true
)

func init() {
	if os.Getenv("NO_COLOR") != "" || os.Getenv("TERM") == "dumb" {
		useColors = false
	}
}

func getLogFilePath() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		home = "/tmp"
	}
	return filepath.Join(home, ".tmp-appview", "log", "storage.log")
}

func getLogFileWriter() io.Writer {
	logFileOnce.Do(func() {
		p := getLogFilePath()
		if err := os.MkdirAll(filepath.Dir(p), 0755); err == nil {
			f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
			if err == nil {
				logFile = f
			}
		}
	})
	return logFile
}

func LogInfo(format string, a ...interface{}) {
	LogEvent("INFO", fmt.Sprintf(format, a...), nil)
}

func LogError(format string, a ...interface{}) {
	LogEvent("ERROR", fmt.Sprintf(format, a...), nil)
}

func LogWarning(format string, a ...interface{}) {
	LogEvent("WARN", fmt.Sprintf(format, a...), nil)
}

func LogDebug(format string, a ...interface{}) {
	LogEvent("DEBUG", fmt.Sprintf(format, a...), nil)
}

// LogHTTP logs incoming HTTP requests with method, path, status, and latency
func LogHTTP(method, path string, status int, latency time.Duration, fields map[string]any) {
	if fields == nil {
		fields = make(map[string]any)
	}
	fields["status"] = status
	fields["latency"] = formatDuration(latency)

	level := "INFO"
	if status >= 500 {
		level = "ERROR"
	} else if status >= 400 {
		level = "WARN"
	}

	LogEvent(level, fmt.Sprintf("[HTTP] %s %s", method, path), fields)
}

func formatDuration(d time.Duration) string {
	if d < time.Millisecond {
		return fmt.Sprintf("%dµs", d.Microseconds())
	}
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Milliseconds())
	}
	return fmt.Sprintf("%.2fs", d.Seconds())
}

// LogEvent emits one clean human-readable log line to stdout and storage.log
func LogEvent(level, message string, fields map[string]any) {
	if !enabled(level) {
		return
	}

	plainLine := formatEvent(level, message, fields)

	if useColors {
		fmt.Println(formatColoredEvent(level, message, fields))
	} else {
		fmt.Println(plainLine)
	}

	w := getLogFileWriter()
	if w != nil {
		logFileMu.Lock()
		nowFull := time.Now().Format("2006-01-02 15:04:05")
		fmt.Fprintf(w, "%s %s\n", nowFull, plainLine[len("15:04:05 "):])
		logFileMu.Unlock()
	}
}

func formatEvent(level, message string, fields map[string]any) string {
	now := time.Now().Format("15:04:05")
	lvl := padLevel(level)

	msg := strings.TrimSpace(message)
	if strings.HasPrefix(strings.ToUpper(msg), "[STORAGE SERVICE]") {
		msg = strings.TrimSpace(msg[len("[STORAGE SERVICE]"):])
	} else if strings.HasPrefix(strings.ToUpper(msg), "[STORAGE]") {
		msg = strings.TrimSpace(msg[len("[STORAGE]"):])
	}

	formattedFields := formatFields(fields)
	if formattedFields != "" {
		return fmt.Sprintf("%s %s [STORAGE] %s | %s", now, lvl, msg, formattedFields)
	}
	return fmt.Sprintf("%s %s [STORAGE] %s", now, lvl, msg)
}

func formatColoredEvent(level, message string, fields map[string]any) string {
	now := time.Now().Format("15:04:05")
	timeStr := fmt.Sprintf("%s%s%s", colorGray, now, colorReset)

	var lvlColor string
	switch strings.ToUpper(strings.TrimSpace(level)) {
	case "INFO":
		lvlColor = colorGreen
	case "WARN", "WARNING":
		lvlColor = colorYellow
	case "ERROR":
		lvlColor = colorBoldRed
	case "DEBUG":
		lvlColor = colorGray
	default:
		lvlColor = colorReset
	}

	lvlStr := fmt.Sprintf("%s%s%s", lvlColor, padLevel(level), colorReset)
	serviceTag := fmt.Sprintf("%s[STORAGE]%s", colorBoldGreen, colorReset)

	msg := strings.TrimSpace(message)
	if strings.HasPrefix(strings.ToUpper(msg), "[STORAGE SERVICE]") {
		msg = strings.TrimSpace(msg[len("[STORAGE SERVICE]"):])
	} else if strings.HasPrefix(strings.ToUpper(msg), "[STORAGE]") {
		msg = strings.TrimSpace(msg[len("[STORAGE]"):])
	}

	// Colorize sub-tags like [HTTP], [SQLITE], [THUMBNAIL], [ARCHIVE], [BATCH], [COOKIE], [SESSION], [YOUTUBE]
	if strings.HasPrefix(msg, "[") && strings.Contains(msg, "]") {
		idx := strings.Index(msg, "]")
		tag := msg[:idx+1]
		rest := msg[idx+1:]
		msg = fmt.Sprintf("%s%s%s%s", colorCyan, tag, colorReset, rest)
	}

	formattedFields := formatFields(fields)
	if formattedFields != "" {
		fieldsStr := fmt.Sprintf("%s| %s%s", colorDim, formattedFields, colorReset)
		return fmt.Sprintf("%s %s %s %s %s", timeStr, lvlStr, serviceTag, msg, fieldsStr)
	}
	return fmt.Sprintf("%s %s %s %s", timeStr, lvlStr, serviceTag, msg)
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
