package configs

import (
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/gofiber/fiber/v2"
)

type StorageDrive struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Path           string  `json:"path"`
	Available      bool    `json:"available"`
	TotalBytes     int64   `json:"totalBytes"`
	UsedBytes      int64   `json:"usedBytes"`
	AvailableBytes int64   `json:"availableBytes"`
	UsedPercent    float64 `json:"usedPercent"`
}

// ROOT_PATH is the Storage volume root. Public clients submit logical paths
// such as /Albums; archive_task safely resolves them beneath this root.
var DEFAULT_ROOT_PATH = "/Volumes/HDD"

var STORAGE_DRIVES = []StorageDrive{
	{ID: "HDD", Name: "HDD", Path: "/Volumes/HDD"},
	{ID: "SSD", Name: "SSD", Path: "/Volumes/SSD"},
}

// InitDefaultRootPath reloads DEFAULT_ROOT_PATH and STORAGE_DRIVES from environment variables.
// If neither is set, it defaults to "/Volumes/HDD" and "/Volumes/SSD".
func InitDefaultRootPath() {
	if root := strings.TrimSpace(os.Getenv("STORAGE_ROOT_PATH")); root != "" {
		DEFAULT_ROOT_PATH = filepath.Clean(root)
	} else if root := strings.TrimSpace(os.Getenv("ROOT_PATH")); root != "" {
		DEFAULT_ROOT_PATH = filepath.Clean(root)
	} else {
		DEFAULT_ROOT_PATH = "/Volumes/HDD"
	}

	drivesEnv := strings.TrimSpace(os.Getenv("STORAGE_DRIVES"))
	if drivesEnv != "" {
		var parsed []StorageDrive
		for _, part := range strings.Split(drivesEnv, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			id, path, ok := strings.Cut(part, ":")
			if !ok {
				path = id
				id = filepath.Base(path)
			}
			id = strings.TrimSpace(id)
			path = filepath.Clean(strings.TrimSpace(path))
			if id == "" {
				id = filepath.Base(path)
			}
			parsed = append(parsed, StorageDrive{
				ID:   id,
				Name: id,
				Path: path,
			})
		}
		if len(parsed) > 0 {
			STORAGE_DRIVES = parsed
		}
	} else {
		STORAGE_DRIVES = []StorageDrive{
			{ID: "HDD", Name: "HDD", Path: DEFAULT_ROOT_PATH},
			{ID: "SSD", Name: "SSD", Path: "/Volumes/SSD"},
		}
	}
}

func init() {
	InitDefaultRootPath()
}

// GetDrivesWithStats returns all configured drives with their current disk usage stats.
func GetDrivesWithStats() []StorageDrive {
	drives := make([]StorageDrive, len(STORAGE_DRIVES))
	copy(drives, STORAGE_DRIVES)

	for i := range drives {
		cleanPath := filepath.Clean(drives[i].Path)
		var stat syscall.Statfs_t
		if err := syscall.Statfs(cleanPath, &stat); err == nil && int64(stat.Blocks) > 0 {
			block := int64(stat.Bsize)
			total := int64(stat.Blocks) * block
			avail := int64(stat.Bavail) * block
			used := total - int64(stat.Bfree)*block
			var percent float64
			if total > 0 {
				percent = float64(used) / float64(total) * 100
			}
			drives[i].Available = true
			drives[i].TotalBytes = total
			drives[i].UsedBytes = used
			drives[i].AvailableBytes = avail
			drives[i].UsedPercent = percent
		} else {
			drives[i].Available = false
			drives[i].TotalBytes = 0
			drives[i].UsedBytes = 0
			drives[i].AvailableBytes = 0
			drives[i].UsedPercent = 0
		}
	}
	return drives
}

// FindDriveForPath determines which configured drive a given absolute path belongs to.
func FindDriveForPath(path string) StorageDrive {
	cleanPath := filepath.Clean(path)
	for _, drive := range STORAGE_DRIVES {
		rel, err := filepath.Rel(drive.Path, cleanPath)
		if err == nil && !strings.HasPrefix(rel, "..") {
			return drive
		}
	}
	return StorageDrive{ID: "DEFAULT", Name: "DEFAULT", Path: DEFAULT_ROOT_PATH}
}

// AppViewStateDir is Storage's local durable state root.  It intentionally
// belongs to the local Storage process: Coordinator can be remote and must
// never assume a path on this machine. APPVIEW_STATE_DIR is useful for tests,
// containers, and an alternate local SSD.
func AppViewStateDir() (string, error) {
	if configured := strings.TrimSpace(os.Getenv("STORAGE_STATE_DIR")); configured != "" {
		return filepath.Clean(configured), nil
	}
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
	// 0. Check drive route param (e.g. /api/v1/:drive/thumbnails/* or /api/v1/:drive/pictures/*)
	driveParam := strings.TrimSpace(c.Params("drive", ""))
	if driveParam == "" {
		// 1. Check drive query parameter or X-Drive header
		driveParam = strings.TrimSpace(c.Query("drive", ""))
	}
	if driveParam == "" {
		driveParam = strings.TrimSpace(c.Get("X-Drive", ""))
	}
	if driveParam != "" {
		for _, d := range STORAGE_DRIVES {
			if strings.EqualFold(d.ID, driveParam) || strings.EqualFold(d.Name, driveParam) {
				return d.Path
			}
		}
	}

	// 2. Check root_path query parameter or X-Root-Folder-Path header
	root := c.Query("root_path", "")
	if root == "" {
		root = c.Get("X-Root-Folder-Path", "")
	}
	if root != "" {
		if unescaped, err := url.QueryUnescape(root); err == nil && unescaped != "" {
			root = unescaped
		}
		root = strings.Trim(root, "\"' \t\r\n")
		for _, d := range STORAGE_DRIVES {
			if strings.EqualFold(d.ID, root) || strings.EqualFold(d.Name, root) {
				return d.Path
			}
		}
		if !strings.HasPrefix(root, "/") && !strings.Contains(root, ":") {
			root = "/" + root
		}
		return filepath.Clean(root)
	}

	// 3. Fallback to DEFAULT_ROOT_PATH
	return DEFAULT_ROOT_PATH
}

// ResolveDriveRoot resolves a drive identifier to its physical root path.
func ResolveDriveRoot(driveParam string) string {
	driveParam = strings.TrimSpace(driveParam)
	if driveParam != "" {
		for _, d := range STORAGE_DRIVES {
			if strings.EqualFold(d.ID, driveParam) || strings.EqualFold(d.Name, driveParam) {
				if strings.EqualFold(d.ID, "HDD") && DEFAULT_ROOT_PATH != "" {
					return DEFAULT_ROOT_PATH
				}
				return d.Path
			}
		}
	}
	return DEFAULT_ROOT_PATH
}
