// Package worker is the Storage-side adapter for the shared Coordinator
// worker protocol. It never owns filesystem or archive implementation.
package worker

import (
	pythonapi "backend/api/python"
	"backend/events"
	"backend/models"
	"encoding/json"
	"time"
)

const (
	WorkerRegister     = "worker.register"
	WorkerRegistered   = "worker.registered"
	WorkerHeartbeat    = "worker.heartbeat"
	TaskAssign         = "task.assign"
	TaskAccepted       = "task.accepted"
	TaskProgress       = "task.progress"
	TaskCompleted      = "task.completed"
	TaskFailed         = "task.failed"
	ProtocolError      = "error"
	FilesystemEvent    = "filesystem_event"
	StorageHistory     = "storage.history"
	StorageInfoMessage = "storage.info"
	CookieSave         = "cookie.save"
	CookieGet          = "cookie.get"
	SessionStatus      = "session.status"
	SessionSave        = "session.save"
	SessionGet         = "session.get"
	FolderTreeGet      = "folder.tree"
	FolderContentsGet  = "folder.contents"
	FolderStatsGet     = "folder.stats"
	FolderCreate       = "folder.create"
	FolderRename       = "folder.rename"
	FolderDelete       = "folder.delete"
	BatchJobProgressMessage = "batch_job_progress"

	CapabilityDownloadFile = "download_file"
)

type Message struct {
	Type             string                        `json:"type"`
	TaskID           string                        `json:"taskId,omitempty"`
	WorkerID         string                        `json:"workerId,omitempty"`
	Action           string                        `json:"action,omitempty"`
	Capabilities     []string                      `json:"capabilities,omitempty"`
	Payload          json.RawMessage               `json:"payload,omitempty"`
	Result           any                           `json:"result,omitempty"`
	Progress         any                           `json:"progress,omitempty"`
	Error            *ErrorPayload                 `json:"error,omitempty"`
	Event            *events.FilesystemEvent       `json:"event,omitempty"`
	StorageHistory   *StorageHistoryPayload        `json:"storageHistory,omitempty"`
	StorageInfo      *StorageInfo                  `json:"storageInfo,omitempty"`
	BatchJobProgress *events.BatchJobProgressEvent `json:"batchJob,omitempty"`
}

// StorageHistoryPayload contains safe durable metadata only. Workspace paths,
// local artifacts and passwords never leave the Storage process.
type StorageHistoryPayload struct {
	Jobs []StorageJobSnapshot `json:"jobs"`
}

type StorageJobSnapshot struct {
	ID                string                        `json:"id"`
	CanonicalID       string                        `json:"canonicalJobId,omitempty"`
	Source            string                        `json:"source,omitempty"`
	SourceURL         string                        `json:"sourceUrl,omitempty"`
	Filename          string                        `json:"filename"`
	Destination       string                        `json:"destination,omitempty"`
	State             string                        `json:"state"`
	DownloadedBytes   int64                         `json:"downloadedBytes,omitempty"`
	TotalBytes        int64                         `json:"totalBytes,omitempty"`
	SpeedBytes        int64                         `json:"speedBytes,omitempty"`
	ExtractedPercent  float64                       `json:"extractedPercent,omitempty"`
	ConversionTotal   int                           `json:"conversionTotal,omitempty"`
	ConversionCurrent int                           `json:"conversionCurrent,omitempty"`
	ConversionFailed  int                           `json:"conversionFailed,omitempty"`
	ErrorCode         string                        `json:"errorCode,omitempty"`
	Error             string                        `json:"error,omitempty"`
	PasswordRequired  bool                          `json:"passwordRequired"`
	ArchiveDownloaded bool                          `json:"archiveDownloaded"`
	ArchiveExtracted  bool                          `json:"archiveExtracted"`
	VideoScanState        string                        `json:"videoScanState,omitempty"`
	TotalVideoCount       int                           `json:"totalVideoCount,omitempty"`
	InvalidVideoCount     int                           `json:"invalidVideoCount,omitempty"`
	OptimizationCancelled bool                          `json:"optimizationCancelled,omitempty"`
	UnoptimizedVideoCount int                           `json:"unoptimizedVideoCount,omitempty"`
	CancelledFromStage    string                        `json:"cancelledFromStage,omitempty"`
	Videos                []pythonapi.VideoOptimization `json:"videos,omitempty"`
	IsMultipart           bool                          `json:"isMultipart,omitempty"`
	TotalParts            int                           `json:"totalParts,omitempty"`
	CurrentPart           int                           `json:"currentPart,omitempty"`
	PartName              string                        `json:"partName,omitempty"`
	CreatedAt             time.Time                     `json:"createdAt"`
	UpdatedAt             time.Time                     `json:"updatedAt"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type CookieRequestPayload struct {
	Platform  string `json:"platform"`
	Cookies   string `json:"cookies,omitempty"`
	Overwrite bool   `json:"overwrite,omitempty"`
}

type CookieSaveResult struct {
	Success   bool      `json:"success"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CookieGetResult struct {
	Platform string `json:"platform"`
	Exists   bool   `json:"exists"`
	Cookies  string `json:"cookies,omitempty"`
}

type SessionRequestPayload struct {
	Platform string `json:"platform"`
	Session  string `json:"session,omitempty"`
}

type SessionStatusResult struct {
	Platform  string     `json:"platform"`
	Exists    bool       `json:"exists"`
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}

type SessionSaveResult struct {
	Success   bool      `json:"success"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SessionGetResult struct {
	Platform string `json:"platform"`
	Exists   bool   `json:"exists"`
	Session  string `json:"session,omitempty"`
}

type FolderTreeRequestPayload struct {
	Drive string `json:"drive,omitempty"`
}

type FolderTreeResult struct {
	Data []*models.FolderNode `json:"data"`
}

type FolderCreateRequestPayload struct {
	Drive string `json:"drive,omitempty"`
	Path  string `json:"path"`
	Name  string `json:"name"`
}

type FolderCreateResult struct {
	Message string             `json:"message"`
	Data    *models.FolderItem `json:"data,omitempty"`
}

type FolderRenameRequestPayload struct {
	Drive   string `json:"drive,omitempty"`
	Path    string `json:"path"`
	NewName string `json:"new_name"`
}

type FolderRenameResult struct {
	Message string             `json:"message"`
	Data    *models.FolderItem `json:"data,omitempty"`
}

type FolderContentsRequestPayload struct {
	Drive        string `json:"drive,omitempty"`
	Path         string `json:"path,omitempty"`
	Page         int    `json:"page,omitempty"`
	Limit        int    `json:"limit,omitempty"`
	FolderLimit  int    `json:"folder_limit,omitempty"`
	PictureLimit int    `json:"picture_limit,omitempty"`
	VideoLimit   int    `json:"video_limit,omitempty"`
	FolderPage   int    `json:"folder_page,omitempty"`
	PicturePage  int    `json:"picture_page,omitempty"`
	VideoPage    int    `json:"video_page,omitempty"`
}

type FolderContentsResult struct {
	CurrentPath   string               `json:"current_path"`
	Folders       []*models.FolderItem `json:"folders"`
	Pictures      []*models.PictureItem `json:"pictures"`
	Videos        []*models.VideoItem  `json:"videos"`
	TotalFolders  int                  `json:"total_folders"`
	TotalPictures int                  `json:"total_pictures"`
	TotalVideos   int                  `json:"total_videos"`
	Page          int                  `json:"page"`
	Limit         int                  `json:"limit"`
}

type FolderStatsRequestPayload struct {
	Drive string `json:"drive,omitempty"`
	Path  string `json:"path,omitempty"`
}

type FolderStatsResult struct {
	Drive          string `json:"drive"`
	Path           string `json:"path"`
	TotalSize      int64  `json:"total_size"`
	TotalFiles     int    `json:"total_files"`
	TotalPictures  int    `json:"total_pictures"`
	TotalVideos    int    `json:"total_videos"`
	TotalFolders   int    `json:"total_folders"`
	LatestMod      int64  `json:"latest_mod"`
	DirectFolders  int    `json:"direct_folders"`
	DirectPictures int    `json:"direct_pictures"`
	DirectVideos   int    `json:"direct_videos"`
	DirectTotal    int    `json:"direct_total"`
}

type FolderDeleteRequestPayload struct {
	Drive string `json:"drive,omitempty"`
	Path  string `json:"path,omitempty"`
}

type FolderDeleteResult struct {
	Drive   string `json:"drive"`
	Path    string `json:"path"`
	Deleted bool   `json:"deleted"`
}
