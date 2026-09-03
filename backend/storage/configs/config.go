package configs

import (
	"net/url"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
)

var DEFAULT_ROOT_PATH = "/Volumes/HDD/Albums"

// APPVIEW_WORKSPACE_PATH là SSD workspace độc lập với thư mục thư viện cuối.
// Mỗi archive job có một thư mục con riêng ở đây để tải, giải nén và convert
// không tạo I/O ngẫu nhiên trực tiếp trên HDD.
var APPVIEW_WORKSPACE_PATH = "/Users/hoang/.tmp-appview"

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
