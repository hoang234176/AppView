package worker

import (
	"path/filepath"
	"syscall"

	"backend/configs"
)

type DriveInfo struct {
	ID             string  `json:"id"`
	DisplayName    string  `json:"displayName"`
	Path           string  `json:"path"`
	Available      bool    `json:"available"`
	TotalBytes     int64   `json:"totalBytes"`
	UsedBytes      int64   `json:"usedBytes"`
	AvailableBytes int64   `json:"availableBytes"`
	UsedPercent    float64 `json:"usedPercent"`
}

// StorageInfo is deliberately small filesystem metadata for Settings. It is
// derived from the configured Storage root, never from a hard-coded volume.
type StorageInfo struct {
	DisplayName    string      `json:"displayName"`
	TotalBytes     int64       `json:"totalBytes"`
	UsedBytes      int64       `json:"usedBytes"`
	AvailableBytes int64       `json:"availableBytes"`
	UsedPercent    float64     `json:"usedPercent"`
	Drives         []DriveInfo `json:"drives,omitempty"`
}

func CurrentStorageInfo() (StorageInfo, error) {
	drives := configs.GetDrivesWithStats()
	var driveInfos []DriveInfo
	for _, d := range drives {
		driveInfos = append(driveInfos, DriveInfo{
			ID:             d.ID,
			DisplayName:    d.Name,
			Path:           d.Path,
			Available:      d.Available,
			TotalBytes:     d.TotalBytes,
			UsedBytes:      d.UsedBytes,
			AvailableBytes: d.AvailableBytes,
			UsedPercent:    d.UsedPercent,
		})
	}

	root := filepath.Clean(configs.DEFAULT_ROOT_PATH)
	var stat syscall.Statfs_t
	var total, used, available int64
	var percent float64

	if err := syscall.Statfs(root, &stat); err == nil {
		block := int64(stat.Bsize)
		total = int64(stat.Blocks) * block
		available = int64(stat.Bavail) * block
		used = total - int64(stat.Bfree)*block
		if total > 0 {
			percent = float64(used) / float64(total) * 100
		}
	} else {
		// Fallback to first available drive if primary root path stat failed
		found := false
		for _, di := range driveInfos {
			if di.Available {
				total = di.TotalBytes
				used = di.UsedBytes
				available = di.AvailableBytes
				percent = di.UsedPercent
				found = true
				break
			}
		}
		if !found {
			return StorageInfo{Drives: driveInfos}, err
		}
	}

	return StorageInfo{
		DisplayName:    filepath.Base(root),
		TotalBytes:     total,
		UsedBytes:      used,
		AvailableBytes: available,
		UsedPercent:    percent,
		Drives:         driveInfos,
	}, nil
}
