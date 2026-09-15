package configs

import (
	"bufio"
	"os"
	"strings"
)

// LoadEnvironment loads this service's optional local .env file. Values from
// the OS (including deployment tooling) are never overwritten.
func LoadEnvironment() {
	for _, envPath := range []string{".env", "../.env", "../../.env"} {
		loadEnvFile(envPath)
	}
}

func loadEnvFile(path string) {
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
		_ = os.Setenv(key, strings.Trim(strings.TrimSpace(value), "\"'"))
	}
}
