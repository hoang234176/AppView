package protocol

import (
	"encoding/json"
	"time"
)

type MessageType string

const (
	WorkerRegister         MessageType = "worker.register"
	WorkerRegistered       MessageType = "worker.registered"
	WorkerHeartbeat        MessageType = "worker.heartbeat"
	TaskAssign             MessageType = "task.assign"
	TaskCancel             MessageType = "task.cancel"
	TaskAccepted           MessageType = "task.accepted"
	TaskProgress           MessageType = "task.progress"
	TaskCompleted          MessageType = "task.completed"
	TaskFailed             MessageType = "task.failed"
	FilesystemEventMessage MessageType = "filesystem_event"
	StorageHistory         MessageType = "storage.history"
	StorageInfoMessage     MessageType = "storage.info"
	DownloadEventMessage   MessageType = "download_event"
	CookieSave             MessageType = "cookie.save"
	CookieGet              MessageType = "cookie.get"
	CookieVerify           MessageType = "cookie.verify"
	SessionStatus          MessageType = "session.status"
	SessionSave            MessageType = "session.save"
	SessionGet             MessageType = "session.get"
	FolderTreeGet          MessageType = "folder.tree"
	FolderContentsGet      MessageType = "folder.contents"
	FolderStatsGet         MessageType = "folder.stats"
	FolderCreate           MessageType = "folder.create"
	FolderRename           MessageType = "folder.rename"
	FolderDelete           MessageType = "folder.delete"
	BatchJobProgressMessage MessageType = "batch_job_progress"
	Error                  MessageType = "error"
)

// Message is the single JSON envelope used on worker WebSockets. Payload and
// Result intentionally retain raw JSON: the coordinator routes opaque worker
// data and must not learn scraping or filesystem-specific schemas.
type Message struct {
	Type             MessageType            `json:"type"`
	TaskID           string                 `json:"taskId,omitempty"`
	WorkerID         string                 `json:"workerId,omitempty"`
	Action           string                 `json:"action,omitempty"`
	Capabilities     []Capability           `json:"capabilities,omitempty"`
	Payload          json.RawMessage        `json:"payload,omitempty"`
	Result           json.RawMessage        `json:"result,omitempty"`
	Progress         json.RawMessage        `json:"progress,omitempty"`
	Error            *ErrorPayload          `json:"error,omitempty"`
	Event            *FilesystemEvent       `json:"event,omitempty"`
	StorageHistory   *StorageHistoryPayload `json:"storageHistory,omitempty"`
	StorageInfo      *StorageInfo           `json:"storageInfo,omitempty"`
	DownloadEvent    *DownloadEvent         `json:"download,omitempty"`
	BatchJobProgress *BatchJobProgress      `json:"batchJob,omitempty"`
}

type DriveInfo struct {
	ID             string  `json:"id"`
	DisplayName    string  `json:"displayName"`
	Available      bool    `json:"available"`
	TotalBytes     int64   `json:"totalBytes"`
	UsedBytes      int64   `json:"usedBytes"`
	AvailableBytes int64   `json:"availableBytes"`
	UsedPercent    float64 `json:"usedPercent"`
}

type StorageInfo struct {
	Drives []DriveInfo `json:"drives"`
}

// StorageHistoryPayload is metadata-only durable state sent by one identified
// local Storage worker. It never contains local paths, passwords, or files.
type StorageHistoryPayload struct {
	Jobs []StorageJobSnapshot `json:"jobs"`
}

type StorageJobSnapshot struct {
	ID                    string              `json:"id"`
	CanonicalID           string              `json:"canonicalJobId,omitempty"`
	Source                string              `json:"source,omitempty"`
	SourceURL             string              `json:"sourceUrl,omitempty"`
	Filename              string              `json:"filename"`
	Destination           string              `json:"destination,omitempty"`
	State                 string              `json:"state"`
	DownloadedBytes       int64               `json:"downloadedBytes,omitempty"`
	TotalBytes            int64               `json:"totalBytes,omitempty"`
	SpeedBytes            int64               `json:"speedBytes,omitempty"`
	ExtractedPercent      float64             `json:"extractedPercent,omitempty"`
	ConversionTotal       int                 `json:"conversionTotal,omitempty"`
	ConversionCurrent     int                 `json:"conversionCurrent,omitempty"`
	ConversionFailed      int                 `json:"conversionFailed,omitempty"`
	ErrorCode             string              `json:"errorCode,omitempty"`
	Error                 string              `json:"error,omitempty"`
	PasswordRequired      bool                `json:"passwordRequired"`
	ArchiveDownloaded     bool                `json:"archiveDownloaded"`
	ArchiveExtracted      bool                `json:"archiveExtracted"`
	VideoScanState        string              `json:"videoScanState,omitempty"`
	TotalVideoCount       int                 `json:"totalVideoCount,omitempty"`
	InvalidVideoCount     int                 `json:"invalidVideoCount,omitempty"`
	OptimizationCancelled bool                `json:"optimizationCancelled,omitempty"`
	UnoptimizedVideoCount int                 `json:"unoptimizedVideoCount,omitempty"`
	CancelledFromStage    string              `json:"cancelledFromStage,omitempty"`
	Videos                []VideoOptimization `json:"videos,omitempty"`
	IsMultipart           bool                `json:"isMultipart,omitempty"`
	TotalParts            int                 `json:"totalParts,omitempty"`
	CurrentPart           int                 `json:"currentPart,omitempty"`
	PartName              string              `json:"partName,omitempty"`
	CreatedAt             time.Time           `json:"createdAt"`
	UpdatedAt             time.Time           `json:"updatedAt"`
}

// VideoOptimization is small, persisted media metadata projected by Storage.
// It intentionally carries a relative display path only; no workspace paths,
// passwords, or file contents cross the worker boundary.
type VideoOptimization struct {
	ID                 string   `json:"id"`
	RelativePath       string   `json:"relativePath"`
	DisplayName        string   `json:"displayName"`
	Width              int      `json:"width"`
	Height             int      `json:"height"`
	ResolutionClass    string   `json:"resolutionClass"`
	SourceSizeBytes    int64    `json:"sourceSizeBytes"`
	ContainerOK        bool     `json:"containerCompatible"`
	MetadataOK         bool     `json:"metadataCompatible"`
	VideoOK            bool     `json:"videoCompatible"`
	AudioOK            bool     `json:"audioCompatible"`
	OptimizationNeeded bool     `json:"optimizationRequired"`
	AllowedQualities   []string `json:"allowedQualities,omitempty"`
	SelectedQuality    string   `json:"selectedQuality,omitempty"`
	State              string   `json:"state"`
	Error              string   `json:"error,omitempty"`
}

// DownloadEvent is a deliberately small invalidation notification. Clients
// refetch GET /api/v1/download for the canonical snapshot.
type DownloadEvent struct {
	JobID string `json:"jobId"`
	Kind  string `json:"kind"`
}

type BatchJobProgress struct {
	ID          string    `json:"id"`
	Action      string    `json:"action"`
	SrcDrive    string    `json:"src_drive"`
	DestDrive   string    `json:"dest_drive"`
	DestFolder  string    `json:"dest_folder"`
	Status      string    `json:"status"` // "running", "completed", "failed"
	Percent     int       `json:"percent"`
	TotalBytes  int64     `json:"total_bytes"`
	CopiedBytes int64     `json:"copied_bytes"`
	CurrentFile string    `json:"current_file"`
	Message     string    `json:"message"`
	Error       string    `json:"error,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type FilesystemEvent struct {
	Type          string          `json:"type"`
	Drive         string          `json:"drive,omitempty"`
	Path          string          `json:"path,omitempty"`
	OldPath       string          `json:"oldPath,omitempty"`
	NewPath       string          `json:"newPath,omitempty"`
	ParentPath    string          `json:"parentPath,omitempty"`
	OldParentPath string          `json:"oldParentPath,omitempty"`
	NewParentPath string          `json:"newParentPath,omitempty"`
	Paths         []string        `json:"paths,omitempty"`
	Previews      []string        `json:"previews,omitempty"`
	Item          json.RawMessage `json:"item,omitempty"`
	Items         json.RawMessage `json:"items,omitempty"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func NewError(code, message string) Message {
	return Message{Type: Error, Error: &ErrorPayload{Code: code, Message: message}}
}

type CookieRequestPayload struct {
	Platform  string            `json:"platform"`
	Cookies   string            `json:"cookies,omitempty"`
	AutoSave  bool              `json:"autoSave,omitempty"`
	Overwrite bool              `json:"overwrite,omitempty"`
	Fields    map[string]string `json:"fields,omitempty"`
}

type CookieSaveResult struct {
	Success   bool      `json:"success"`
	Message   string    `json:"message,omitempty"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CookieGetResult struct {
	Platform string `json:"platform"`
	Exists   bool   `json:"exists"`
	Cookies  string `json:"cookies,omitempty"`
}

type CookieVerifyResult struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message"`
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

type FolderNode struct {
	Type     string        `json:"type"`
	Name     string        `json:"name"`
	Path     string        `json:"path"`
	Children []*FolderNode `json:"children,omitempty"`
}

type FolderTreeResult struct {
	Data []*FolderNode `json:"data"`
}

type FolderCreateRequestPayload struct {
	Drive string `json:"drive,omitempty"`
	Path  string `json:"path"`
	Name  string `json:"name"`
}

type FolderCreateResult struct {
	Message string      `json:"message"`
	Data    *FolderItem `json:"data,omitempty"`
}

type FolderRenameRequestPayload struct {
	Drive   string `json:"drive,omitempty"`
	Path    string `json:"path"`
	NewName string `json:"new_name"`
}

type FolderRenameResult struct {
	Message string      `json:"message"`
	Data    *FolderItem `json:"data,omitempty"`
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

type FolderItem struct {
	ID        string   `json:"id,omitempty"`
	Name      string   `json:"name"`
	Path      string   `json:"path"`
	Parent    string   `json:"parent,omitempty"`
	Drive     string   `json:"drive,omitempty"`
	Type      string   `json:"type,omitempty"`
	ItemCount int      `json:"item_count,omitempty"`
	Previews  []string `json:"previews,omitempty"`
	ModTime   string   `json:"mod_time,omitempty"`
}

type PictureItem struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Path         string `json:"path"`
	Drive        string `json:"drive"`
	URL          string `json:"url"`
	ThumbnailURL string `json:"thumbnail_url"`
	Size         int64  `json:"size"`
	ModTime      string `json:"mod_time"`
}

type VideoItem struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Path         string `json:"path"`
	Drive        string `json:"drive"`
	URL          string `json:"url"`
	ThumbnailURL string `json:"thumbnail_url"`
	Size         int64  `json:"size"`
	Duration     string `json:"duration,omitempty"`
	ModTime      string `json:"mod_time"`
}

type FolderContentsResult struct {
	CurrentPath   string         `json:"current_path"`
	Folders       []*FolderItem  `json:"folders"`
	Pictures      []*PictureItem `json:"pictures"`
	Videos        []*VideoItem   `json:"videos"`
	TotalFolders  int            `json:"total_folders"`
	TotalPictures int            `json:"total_pictures"`
	TotalVideos   int            `json:"total_videos"`
	Page          int            `json:"page"`
	Limit         int            `json:"limit"`
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
