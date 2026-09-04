package worker

import (
	"path/filepath"
	"syscall"

	"backend/configs"
)

// StorageInfo is deliberately small filesystem metadata for Settings. It is
// derived from the configured Storage root, never from a hard-coded volume.
type StorageInfo struct {
	DisplayName    string  `json:"displayName"`
	TotalBytes     int64   `json:"totalBytes"`
	UsedBytes      int64   `json:"usedBytes"`
	AvailableBytes int64   `json:"availableBytes"`
	UsedPercent    float64 `json:"usedPercent"`
}

func CurrentStorageInfo() (StorageInfo, error) {
	root := filepath.Clean(configs.DEFAULT_ROOT_PATH)
	var stat syscall.Statfs_t
	if err := syscall.Statfs(root, &stat); err != nil {
		return StorageInfo{}, err
	}
	block := int64(stat.Bsize)
	total := int64(stat.Blocks) * block
	available := int64(stat.Bavail) * block
	used := total - int64(stat.Bfree)*block
	percent := float64(0)
	if total > 0 {
		percent = float64(used) / float64(total) * 100
	}
	return StorageInfo{DisplayName: filepath.Base(root), TotalBytes: total, UsedBytes: used, AvailableBytes: available, UsedPercent: percent}, nil
}
