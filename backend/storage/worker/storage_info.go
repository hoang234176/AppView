package worker

import (
	"backend/configs"
)

type DriveInfo struct {
	ID             string  `json:"id"`
	DisplayName    string  `json:"displayName"`
	Available      bool    `json:"available"`
	TotalBytes     int64   `json:"totalBytes"`
	UsedBytes      int64   `json:"usedBytes"`
	AvailableBytes int64   `json:"availableBytes"`
	UsedPercent    float64 `json:"usedPercent"`
}

// StorageInfo is filesystem metadata for Settings and Drive management.
type StorageInfo struct {
	Drives []DriveInfo `json:"drives"`
}

func CurrentStorageInfo() (StorageInfo, error) {
	drives := configs.GetDrivesWithStats()
	var driveInfos []DriveInfo
	for _, d := range drives {
		driveInfos = append(driveInfos, DriveInfo{
			ID:             d.ID,
			DisplayName:    d.Name,
			Available:      d.Available,
			TotalBytes:     d.TotalBytes,
			UsedBytes:      d.UsedBytes,
			AvailableBytes: d.AvailableBytes,
			UsedPercent:    d.UsedPercent,
		})
	}

	return StorageInfo{
		Drives: driveInfos,
	}, nil
}
