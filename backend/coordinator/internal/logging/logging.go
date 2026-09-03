package logging

import (
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"
)

// Event writes a single structured line without accepting request payloads.
// Callers must not include passwords, signed URLs, headers, or tokens.
func Event(level, message string, fields map[string]any) {
	if !enabled(level) {
		return
	}
	entry := map[string]any{"timestamp": time.Now().UTC().Format(time.RFC3339Nano), "level": strings.ToUpper(level), "service": "coordinator", "message": message}
	for key, value := range fields {
		entry[key] = value
	}
	if encoded, err := json.Marshal(entry); err == nil {
		log.Print(string(encoded))
	} else {
		log.Printf(`{"level":"ERROR","service":"coordinator","message":"log marshal failed"}`)
	}
}

func enabled(level string) bool {
	ranks := map[string]int{"DEBUG": 0, "INFO": 1, "WARN": 2, "WARNING": 2, "ERROR": 3}
	configured := strings.ToUpper(strings.TrimSpace(os.Getenv("LOG_LEVEL")))
	if configured == "" {
		configured = "INFO"
	}
	return ranks[strings.ToUpper(level)] >= ranks[configured]
}
