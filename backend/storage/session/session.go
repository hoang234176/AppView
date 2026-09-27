package session

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

// GetSessionDir returns the path to ~/.tmp-appview/session and ensures it exists
// with 0700 permissions.
func GetSessionDir() (string, error) {
	stateDir, err := configs.AppViewStateDir()
	if err != nil {
		return "", fmt.Errorf("failed to get state dir: %w", err)
	}
	dir := filepath.Join(stateDir, "session")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", fmt.Errorf("failed to create session directory: %w", err)
	}
	if err := os.Chmod(dir, 0700); err != nil {
		return "", fmt.Errorf("failed to set 0700 permissions on session directory: %w", err)
	}
	return dir, nil
}

// GetSessionFilePath returns the verified file path for a platform session file.
func GetSessionFilePath(platform string) (string, error) {
	safePlatform, err := SanitizePlatform(platform)
	if err != nil {
		return "", err
	}
	dir, err := GetSessionDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, safePlatform+".session"), nil
}

// GetStatus checks whether a session file exists and returns its last modified time.
func GetStatus(platform string) (bool, *time.Time, error) {
	path, err := GetSessionFilePath(platform)
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

// Save writes session content to ~/.tmp-appview/session/<platform>.session with 0600 permissions.
func Save(platform string, content string) (time.Time, error) {
	path, err := GetSessionFilePath(platform)
	if err != nil {
		return time.Time{}, err
	}
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return time.Time{}, errors.New("session content cannot be empty")
	}

	if err := os.WriteFile(path, []byte(trimmed), 0600); err != nil {
		return time.Time{}, fmt.Errorf("failed to write session file: %w", err)
	}
	if err := os.Chmod(path, 0600); err != nil {
		return time.Time{}, fmt.Errorf("failed to set 0600 permissions: %w", err)
	}
	info, err := os.Stat(path)
	if err != nil {
		return time.Now().UTC(), nil
	}
	return info.ModTime().UTC(), nil
}

// Read returns the raw session content from ~/.tmp-appview/session/<platform>.session.
func Read(platform string) (string, bool, error) {
	path, err := GetSessionFilePath(platform)
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
