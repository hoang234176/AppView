package cookies

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"backend/configs"
)

var platformRegex = regexp.MustCompile(`^[a-z0-9_-]+$`)

// SanitizePlatform ensures platform names are safe, lower-cased identifiers
// without path traversal characters or unexpected punctuation.
func SanitizePlatform(platform string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(platform))
	if trimmed == "" {
		return "", errors.New("platform cannot be empty")
	}
	if len(trimmed) > 64 {
		return "", errors.New("platform name is too long")
	}
	if !platformRegex.MatchString(trimmed) {
		return "", fmt.Errorf("invalid platform identifier: %q", platform)
	}
	return trimmed, nil
}

// GetCookiesDir returns the path to ~/.tmp-appview/cookies and ensures it exists
// with 0700 permissions.
func GetCookiesDir() (string, error) {
	stateDir, err := configs.AppViewStateDir()
	if err != nil {
		return "", fmt.Errorf("failed to get state dir: %w", err)
	}
	dir := filepath.Join(stateDir, "cookies")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", fmt.Errorf("failed to create cookies directory: %w", err)
	}
	if err := os.Chmod(dir, 0700); err != nil {
		return "", fmt.Errorf("failed to set 0700 permissions on cookies directory: %w", err)
	}
	return dir, nil
}

// GetCookieFilePath returns the verified file path for a platform cookie file.
func GetCookieFilePath(platform string) (string, error) {
	safePlatform, err := SanitizePlatform(platform)
	if err != nil {
		return "", err
	}
	dir, err := GetCookiesDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, safePlatform+".txt"), nil
}

// GetStatus checks whether a cookie file exists and returns its last modified time.
func GetStatus(platform string) (bool, *time.Time, error) {
	path, err := GetCookieFilePath(platform)
	if err != nil {
		return false, nil, err
	}
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil, nil
		}
		return false, nil, err
	}
	modTime := info.ModTime().UTC()
	return true, &modTime, nil
}

// Save writes cookie content to ~/.tmp-appview/cookies/<platform>.txt with 0600 permissions.
func Save(platform string, content string) (time.Time, error) {
	path, err := GetCookieFilePath(platform)
	if err != nil {
		return time.Time{}, err
	}
	// Write with 0600 permissions
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		return time.Time{}, fmt.Errorf("failed to write cookie file: %w", err)
	}
	// Explicitly enforce 0600 in case umask altered it
	if err := os.Chmod(path, 0600); err != nil {
		return time.Time{}, fmt.Errorf("failed to set 0600 permissions: %w", err)
	}
	info, err := os.Stat(path)
	if err != nil {
		return time.Now().UTC(), nil
	}
	return info.ModTime().UTC(), nil
}

// Read returns the raw cookie content from ~/.tmp-appview/cookies/<platform>.txt.
func Read(platform string) (string, bool, error) {
	path, err := GetCookieFilePath(platform)
	if err != nil {
		return "", false, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", false, nil
		}
		return "", false, err
	}
	return string(data), true, nil
}
