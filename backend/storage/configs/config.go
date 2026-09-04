package configs

import (
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// ROOT_PATH is the Storage volume root. Public clients submit logical paths
// such as /Albums; archive_task safely resolves them beneath this root.
var DEFAULT_ROOT_PATH = "/Volumes/HDD"

// AppViewStateDir is Storage's local durable state root.  It intentionally
// belongs to the local Storage process: Coordinator can be remote and must
// never assume a path on this machine. APPVIEW_STATE_DIR is useful for tests,
// containers, and an alternate local SSD.
func AppViewStateDir() (string, error) {
	if configured := strings.TrimSpace(os.Getenv("APPVIEW_STATE_DIR")); configured != "" {
		return filepath.Clean(configured), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".tmp-appview"), nil
}

func GetRootFolderPath(c *fiber.Ctx) string {
	root := c.Query("root_path", "")
	if root == "" {
		root = c.Get("X-Root-Folder-Path", "")
	}
	if root == "" {
		root = DEFAULT_ROOT_PATH
	}
	if unescaped, err := url.QueryUnescape(root); err == nil && unescaped != "" {
		root = unescaped
	}
	root = strings.Trim(root, "\"' \t\r\n")
	if root != "" && !strings.HasPrefix(root, "/") && !strings.Contains(root, ":") {
		root = "/" + root
	}
	return filepath.Clean(root)
}
