package cookies

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"backend/configs"
	"backend/utils"
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

type cookieEntry struct {
	rawLine    string
	isComment  bool
	domain     string
	flag       string
	path       string
	secure     string
	expiration string
	name       string
	value      string
}

func parseNetscapeLine(line string) *cookieEntry {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return nil
	}
	if strings.HasPrefix(trimmed, "#") {
		return &cookieEntry{rawLine: line, isComment: true}
	}
	parts := strings.Split(line, "\t")
	if len(parts) >= 7 {
		name := strings.TrimSpace(parts[5])
		val := strings.TrimSpace(parts[6])
		if name != "" {
			return &cookieEntry{
				rawLine:    line,
				isComment:  false,
				domain:     strings.TrimSpace(parts[0]),
				flag:       strings.TrimSpace(parts[1]),
				path:       strings.TrimSpace(parts[2]),
				secure:     strings.TrimSpace(parts[3]),
				expiration: strings.TrimSpace(parts[4]),
				name:       name,
				value:      val,
			}
		}
	}
	if strings.Contains(trimmed, "=") {
		kv := strings.SplitN(trimmed, "=", 2)
		k := strings.TrimSpace(kv[0])
		v := strings.TrimSpace(kv[1])
		if k != "" {
			return &cookieEntry{
				rawLine:   line,
				isComment: false,
				name:      k,
				value:     v,
			}
		}
	}
	return &cookieEntry{rawLine: line, isComment: true}
}

func defaultDomainForPlatform(platform string) string {
	p := strings.ToLower(strings.TrimSpace(platform))
	if p == "" {
		return ".example.com"
	}
	return "." + p + ".com"
}

func formatNetscapeCookies(content, defaultDomain string) string {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return ""
	}
	if strings.Contains(content, "# Netscape HTTP Cookie File") {
		return trimmed + "\n"
	}
	lines := strings.Split(content, "\n")
	var sb strings.Builder
	sb.WriteString("# Netscape HTTP Cookie File\n")
	for _, l := range lines {
		e := parseNetscapeLine(l)
		if e == nil {
			continue
		}
		if e.isComment {
			sb.WriteString(e.rawLine + "\n")
		} else {
			domain := e.domain
			if domain == "" {
				domain = defaultDomain
			}
			flag := e.flag
			if flag == "" {
				flag = "TRUE"
			}
			path := e.path
			if path == "" {
				path = "/"
			}
			secure := e.secure
			if secure == "" {
				secure = "TRUE"
			}
			expiration := e.expiration
			if expiration == "" {
				expiration = "2147483647"
			}
			sb.WriteString(fmt.Sprintf("%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
				domain, flag, path, secure, expiration, e.name, e.value))
		}
	}
	return sb.String()
}

func mergeNetscapeCookies(existingContent, newContent, defaultDomain string) string {
	if strings.TrimSpace(existingContent) == "" {
		return formatNetscapeCookies(newContent, defaultDomain)
	}
	if strings.TrimSpace(newContent) == "" {
		return formatNetscapeCookies(existingContent, defaultDomain)
	}

	cookieKey := func(domain, path, name string) string {
		d := strings.ToLower(strings.TrimSpace(domain))
		d = strings.TrimPrefix(d, ".")
		p := strings.TrimSpace(path)
		if p == "" {
			p = "/"
		}
		return fmt.Sprintf("%s|%s|%s", d, p, strings.TrimSpace(name))
	}

	existingLines := strings.Split(existingContent, "\n")
	var entries []*cookieEntry
	keyIndex := make(map[string]int)

	for _, line := range existingLines {
		e := parseNetscapeLine(line)
		if e == nil {
			continue
		}
		if !e.isComment && e.name != "" {
			domain := e.domain
			if domain == "" {
				domain = defaultDomain
			}
			path := e.path
			if path == "" {
				path = "/"
			}
			e.domain = domain
			e.path = path
			k := cookieKey(domain, path, e.name)
			if idx, found := keyIndex[k]; found {
				entries[idx] = e
			} else {
				keyIndex[k] = len(entries)
				entries = append(entries, e)
			}
		} else {
			entries = append(entries, e)
		}
	}

	newLines := strings.Split(newContent, "\n")
	for _, line := range newLines {
		e := parseNetscapeLine(line)
		if e == nil || e.isComment || e.name == "" {
			continue
		}

		domain := e.domain
		if domain == "" {
			domain = defaultDomain
		}
		path := e.path
		if path == "" {
			path = "/"
		}
		e.domain = domain
		e.path = path

		k := cookieKey(domain, path, e.name)
		if idx, found := keyIndex[k]; found {
			target := entries[idx]
			target.value = e.value
			if e.flag != "" {
				target.flag = e.flag
			}
			if e.secure != "" {
				target.secure = e.secure
			}
			if e.expiration != "" {
				target.expiration = e.expiration
			}
		} else {
			flag := e.flag
			if flag == "" {
				flag = "TRUE"
			}
			secure := e.secure
			if secure == "" {
				secure = "TRUE"
			}
			expiration := e.expiration
			if expiration == "" {
				expiration = "2147483647"
			}
			e.flag = flag
			e.secure = secure
			e.expiration = expiration

			keyIndex[k] = len(entries)
			entries = append(entries, e)
		}
	}

	var sb strings.Builder
	hasHeader := false
	for _, e := range entries {
		if strings.Contains(e.rawLine, "Netscape HTTP Cookie File") {
			hasHeader = true
			break
		}
	}
	if !hasHeader {
		sb.WriteString("# Netscape HTTP Cookie File\n")
	}
	for _, e := range entries {
		if e.isComment {
			sb.WriteString(e.rawLine + "\n")
		} else {
			domain := e.domain
			if domain == "" {
				domain = defaultDomain
			}
			flag := e.flag
			if flag == "" {
				flag = "TRUE"
			}
			path := e.path
			if path == "" {
				path = "/"
			}
			secure := e.secure
			if secure == "" {
				secure = "TRUE"
			}
			expiration := e.expiration
			if expiration == "" {
				expiration = "2147483647"
			}
			sb.WriteString(fmt.Sprintf("%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
				domain, flag, path, secure, expiration, e.name, e.value))
		}
	}

	return sb.String()
}

// extractCookieFieldNames extracts only the cookie key/names without any values.
func extractCookieFieldNames(content string) []string {
	var names []string
	seen := make(map[string]bool)
	scanner := bufio.NewScanner(strings.NewReader(content))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) >= 7 {
			name := strings.TrimSpace(parts[5])
			if name != "" && !seen[name] {
				seen[name] = true
				names = append(names, name)
			}
		} else if strings.Contains(line, "=") {
			for _, pair := range strings.Split(line, ";") {
				pair = strings.TrimSpace(pair)
				if kv := strings.SplitN(pair, "=", 2); len(kv) == 2 {
					name := strings.TrimSpace(kv[0])
					if name != "" && !seen[name] {
						seen[name] = true
						names = append(names, name)
					}
				}
			}
		}
	}
	sort.Strings(names)
	return names
}

// Save writes or merges cookie content to ~/.tmp-appview/cookies/<platform>.txt with 0600 permissions.
// Existing cookie attributes and lines are preserved; incoming cookies only add new keys or update existing values.
func Save(platform string, content string) (time.Time, error) {
	path, err := GetCookieFilePath(platform)
	if err != nil {
		return time.Time{}, err
	}
	safePlatform, _ := SanitizePlatform(platform)
	defaultDomain := defaultDomainForPlatform(safePlatform)

	finalContent := content
	if existingBytes, err := os.ReadFile(path); err == nil && len(existingBytes) > 0 {
		finalContent = mergeNetscapeCookies(string(existingBytes), content, defaultDomain)
	} else {
		finalContent = formatNetscapeCookies(content, defaultDomain)
	}

	// Log updated cookie field names (names only, each on its own line)
	updatedFields := extractCookieFieldNames(content)
	if len(updatedFields) > 0 {
		utils.LogInfo("[COOKIE] Đã lưu cập nhật cookie cho %s vào storage (%d trường):", safePlatform, len(updatedFields))
		for _, field := range updatedFields {
			utils.LogInfo("[COOKIE]   • %s", field)
		}
	}

	// Write with 0600 permissions
	if err := os.WriteFile(path, []byte(finalContent), 0600); err != nil {
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
