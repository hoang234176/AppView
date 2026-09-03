package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

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

// LogEvent emits one stdout-safe JSON line. Never pass request payloads,
// passwords, headers, or direct URLs that may contain signed query strings.
func LogEvent(level, message string, fields map[string]any) {
	if !enabled(level) {
		return
	}
	entry := map[string]any{
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		"level":     strings.ToUpper(level),
		"service":   "storage",
		"message":   message,
	}
	for key, value := range fields {
		entry[key] = value
	}
	encoded, err := json.Marshal(entry)
	if err != nil {
		fmt.Printf(`{"timestamp":%q,"level":"ERROR","service":"storage","message":"log marshal failed"}`+"\n", time.Now().UTC().Format(time.RFC3339Nano))
		return
	}
	fmt.Println(string(encoded))
}

func enabled(level string) bool {
	ranks := map[string]int{"DEBUG": 0, "INFO": 1, "WARN": 2, "WARNING": 2, "ERROR": 3}
	configured := strings.ToUpper(strings.TrimSpace(os.Getenv("LOG_LEVEL")))
	if configured == "" {
		configured = "INFO"
	}
	return ranks[strings.ToUpper(level)] >= ranks[configured]
}
