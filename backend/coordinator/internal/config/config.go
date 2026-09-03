package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddress            string
	WorkerWebSocketPath    string
	HeartbeatTimeout       time.Duration
	HeartbeatCheckInterval time.Duration
	DefaultMaxAttempts     int
}

func Load() Config {
	processAddress, processAddressSet := os.LookupEnv("COORDINATOR_HTTP_ADDR")
	processPort, processPortSet := os.LookupEnv("PORT")
	loadLocalEnv(".env")
	return Config{
		HTTPAddress:            httpAddress(processAddress, processAddressSet, processPort, processPortSet),
		WorkerWebSocketPath:    stringEnv("COORDINATOR_WORKER_WS_PATH", "/ws/workers"),
		HeartbeatTimeout:       durationEnv("COORDINATOR_HEARTBEAT_TIMEOUT", 30*time.Second),
		HeartbeatCheckInterval: durationEnv("COORDINATOR_HEARTBEAT_CHECK_INTERVAL", 5*time.Second),
		DefaultMaxAttempts:     intEnv("COORDINATOR_DEFAULT_MAX_ATTEMPTS", 2),
	}
}

// httpAddress keeps the established service-specific setting first. Render
// supplies PORT, so use it when no explicit address was configured and bind on
// every interface rather than localhost.
func httpAddress(processAddress string, processAddressSet bool, processPort string, processPortSet bool) string {
	if processAddressSet && processAddress != "" {
		return processAddress
	}
	if processPortSet && processPort != "" {
		return "0.0.0.0:" + processPort
	}
	if value := os.Getenv("COORDINATOR_HTTP_ADDR"); value != "" {
		return value
	}
	if port := os.Getenv("PORT"); port != "" {
		return "0.0.0.0:" + port
	}
	return ":8090"
}

// loadLocalEnv is deliberately small to avoid a configuration dependency.
// Values already supplied by the OS/Render always win over a developer's
// service-local .env file. Malformed lines are ignored like common dotenv
// loaders; this file is optional in deployed environments.
func loadLocalEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if !ok || key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		value = strings.Trim(strings.TrimSpace(value), "\"'")
		_ = os.Setenv(key, value)
	}
}
func stringEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func durationEnv(key string, fallback time.Duration) time.Duration {
	if value, err := time.ParseDuration(os.Getenv(key)); err == nil && value > 0 {
		return value
	}
	return fallback
}
func intEnv(key string, fallback int) int {
	if value, err := strconv.Atoi(os.Getenv(key)); err == nil && value > 0 {
		return value
	}
	return fallback
}
