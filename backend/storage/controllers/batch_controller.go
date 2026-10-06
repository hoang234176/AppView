package controllers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"backend/configs"
	"backend/events"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type BatchJob struct {
	ID          string    `json:"id"`
	Action      string    `json:"action"` // "copy", "move", "delete"
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
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

var (
	batchJobsMu sync.RWMutex
	batchJobs   = make(map[string]*BatchJob)
)

type BatchRequest struct {
	Action      string            `json:"action"` // "copy", "move", "delete"
	Items       []utils.BatchItem `json:"items"`
	DestFolder  string            `json:"dest_folder"`
	SrcDrive    string            `json:"src_drive"`
	DestDrive   string            `json:"dest_drive"`
	Resolutions map[string]string `json:"resolutions,omitempty"` // item.Path -> "keep_both" | "overwrite" | "skip"
}

// HandleBatchItems handles batch copy, move, and delete.
// POST /api/v1/items/batch
func HandleBatchItems(c *fiber.Ctx) error {
	var req BatchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Dữ liệu yêu cầu không hợp lệ"})
	}

	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	if req.Action != "copy" && req.Action != "move" && req.Action != "delete" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Hành động không hợp lệ (hỗ trợ: copy, move, delete)"})
	}

	if len(req.Items) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Danh sách phần tử cần xử lý trống"})
	}

	// Apply resolutions map if provided
	if req.Resolutions != nil {
		for i := range req.Items {
			if req.Items[i].Resolution == "" {
				cleanP := filepath.ToSlash(filepath.Clean(req.Items[i].Path))
				baseN := filepath.Base(cleanP)
				if r, ok := req.Resolutions[cleanP]; ok {
					req.Items[i].Resolution = r
				} else if r, ok := req.Resolutions[baseN]; ok {
					req.Items[i].Resolution = r
				}
			}
		}
	}

	// Resolve srcRoot and destRoot
	srcDrive := req.SrcDrive
	if srcDrive == "" {
		srcDrive = c.Query("drive", c.Get("X-Drive", ""))
	}
	srcRoot := configs.ResolveDriveRoot(srcDrive)

	destDrive := req.DestDrive
	if destDrive == "" {
		destDrive = srcDrive
	}
	destRoot := configs.ResolveDriveRoot(destDrive)
	isSameDrive := (filepath.Clean(srcRoot) == filepath.Clean(destRoot))

	jobID := fmt.Sprintf("batch_%d", time.Now().UnixNano())
	totalBytes := utils.CalculateTotalBytes(srcRoot, req.Items)
	if totalBytes <= 0 {
		totalBytes = 1 // Prevent division by zero
	}

	destFolderReq := strings.TrimSpace(req.DestFolder)
	if !isSameDrive && destFolderReq != "" {
		// Strip leading drive identifiers if inadvertently passed from client path history
		clean := filepath.ToSlash(filepath.Clean(destFolderReq))
		clean = strings.TrimPrefix(clean, "/")
		for _, d := range configs.STORAGE_DRIVES {
			if strings.EqualFold(clean, d.ID) || strings.EqualFold(clean, d.Name) {
				clean = ""
				break
			}
			pfx := strings.ToLower(d.ID) + "/"
			if strings.HasPrefix(strings.ToLower(clean), pfx) {
				clean = clean[len(pfx):]
				break
			}
			pfxName := strings.ToLower(d.Name) + "/"
			if strings.HasPrefix(strings.ToLower(clean), pfxName) {
				clean = clean[len(pfxName):]
				break
			}
		}
		req.DestFolder = clean
	}

	destDisplayName := req.DestFolder
	if destDisplayName == "" || destDisplayName == "." {
		destDisplayName = "thư mục gốc"
	}

	job := &BatchJob{
		ID:          jobID,
		Action:      req.Action,
		SrcDrive:    srcDrive,
		DestDrive:   destDrive,
		DestFolder:  req.DestFolder,
		Status:      "running",
		Percent:     0,
		TotalBytes:  totalBytes,
		CopiedBytes: 0,
		CurrentFile: "",
		Message:     fmt.Sprintf("Bắt đầu %s...", req.Action),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	batchJobsMu.Lock()
	batchJobs[jobID] = job
	batchJobsMu.Unlock()

	itemPaths := make([]string, len(req.Items))
	for i, it := range req.Items {
		itemPaths[i] = filepath.ToSlash(filepath.Clean(it.Path))
	}

	publishJobProgress := func(j *BatchJob) {
		_ = events.PublishBatchProgress(events.BatchJobProgressEvent{
			ID:          j.ID,
			Action:      j.Action,
			SrcDrive:    j.SrcDrive,
			DestDrive:   j.DestDrive,
			DestFolder:  j.DestFolder,
			Status:      j.Status,
			Percent:     j.Percent,
			TotalBytes:  j.TotalBytes,
			CopiedBytes: j.CopiedBytes,
			CurrentFile: j.CurrentFile,
			Message:     j.Message,
			Error:       j.Error,
			UpdatedAt:   j.UpdatedAt,
		})
	}

	// 1. TRƯỜNG HỢP CÙNG Ổ ĐĨA VÀ LÀ THAO TÁC MOVE / DELETE NHANH:
	if isSameDrive && (req.Action == "move" || req.Action == "delete") {
		err := utils.ExecuteBatchSameDrive(srcRoot, req.Items, req.DestFolder, req.Action, func(copied int64, file string) {
			batchJobsMu.Lock()
			job.CopiedBytes = copied
			job.CurrentFile = file
			job.Percent = 100
			job.UpdatedAt = time.Now()
			batchJobsMu.Unlock()
		})

		batchJobsMu.Lock()
		if err != nil {
			job.Status = "failed"
			job.Error = err.Error()
			job.Message = fmt.Sprintf("Thất bại: %v", err)
			publishJobProgress(job)
			batchJobsMu.Unlock()
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error(), "job": job})
		}

		job.Status = "completed"
		job.Percent = 100
		if req.Action == "move" {
			job.Message = fmt.Sprintf("Đã di chuyển thành công %d mục", len(req.Items))
		} else {
			job.Message = fmt.Sprintf("Đã xóa thành công %d mục", len(req.Items))
		}
		publishJobProgress(job)
		batchJobsMu.Unlock()

		// Publish granular filesystem event
		if req.Action == "delete" {
			publishFolderEvent(events.FilesystemEvent{
				Type:       "items_deleted",
				Drive:      srcDrive,
				Paths:      itemPaths,
				ParentPath: folderParent(itemPaths[0]),
			})
			publishFolderEvent(events.FilesystemEvent{
				Type:       "folder_deleted",
				Drive:      srcDrive,
				Path:       itemPaths[0],
				OldPath:    itemPaths[0],
				ParentPath: folderParent(itemPaths[0]),
			})
		} else {
			publishFolderEvent(events.FilesystemEvent{
				Type:       "items_moved",
				Drive:      destDrive,
				Paths:      itemPaths,
				Path:       req.DestFolder,
				NewPath:    req.DestFolder,
				ParentPath: folderParent(req.DestFolder),
			})
			publishFolderEvent(events.FilesystemEvent{
				Type:       "folder_moved",
				Drive:      destDrive,
				Path:       req.DestFolder,
				NewPath:    req.DestFolder,
				ParentPath: folderParent(req.DestFolder),
			})
		}

		return c.JSON(fiber.Map{"success": true, "job": job})
	}

	// Initial progress notification for async operations
	publishJobProgress(job)

	// 2. TRƯỜNG HỢP CẦN TIẾN TRÌNH % (COPY HOẶC MOVE KHÁC Ổ ĐĨA):
	go func() {
		onProgress := func(copied int64, file string) {
			batchJobsMu.Lock()
			job.CopiedBytes = copied
			job.CurrentFile = file
			pct := int((copied * 100) / totalBytes)
			if pct > 99 {
				pct = 99 // Wait until full finish to show 100%
			}
			job.Percent = pct
			if req.Action == "copy" {
				job.Message = fmt.Sprintf("Đang sao chép đến %s (%d%%)", destDisplayName, pct)
			} else {
				job.Message = fmt.Sprintf("Đang di chuyển đến %s (%d%%)", destDisplayName, pct)
			}
			job.UpdatedAt = time.Now()
			publishJobProgress(job)
			batchJobsMu.Unlock()
		}

		var execErr error
		if isSameDrive {
			execErr = utils.ExecuteBatchSameDrive(srcRoot, req.Items, req.DestFolder, req.Action, onProgress)
		} else {
			execErr = utils.ExecuteBatchCrossDrive(srcRoot, destRoot, req.Items, req.DestFolder, req.Action, onProgress)
		}

		batchJobsMu.Lock()
		if execErr != nil {
			job.Status = "failed"
			job.Error = execErr.Error()
			job.Message = fmt.Sprintf("Thao tác thất bại: %v", execErr)
		} else {
			job.Status = "completed"
			job.Percent = 100
			job.CopiedBytes = totalBytes
			if req.Action == "copy" {
				job.Message = fmt.Sprintf("Đã sao chép thành công %d mục đến %s", len(req.Items), destDisplayName)
			} else {
				job.Message = fmt.Sprintf("Đã di chuyển thành công %d mục đến %s", len(req.Items), destDisplayName)
			}
		}
		job.UpdatedAt = time.Now()
		publishJobProgress(job)
		batchJobsMu.Unlock()

		// Publish filesystem event so connected clients update
		if execErr == nil {
			if req.Action == "copy" {
				publishFolderEvent(events.FilesystemEvent{
					Type:       "items_copied",
					Drive:      destDrive,
					Paths:      itemPaths,
					Path:       req.DestFolder,
					NewPath:    req.DestFolder,
					ParentPath: folderParent(req.DestFolder),
				})
			} else {
				publishFolderEvent(events.FilesystemEvent{
					Type:       "items_moved",
					Drive:      destDrive,
					Paths:      itemPaths,
					Path:       req.DestFolder,
					NewPath:    req.DestFolder,
					ParentPath: folderParent(req.DestFolder),
				})
			}
			publishFolderEvent(events.FilesystemEvent{
				Type:       "folder_moved",
				Drive:      destDrive,
				Path:       req.DestFolder,
				NewPath:    req.DestFolder,
				ParentPath: folderParent(req.DestFolder),
			})
		}
	}()

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"success": true,
		"job":     job,
	})
}

// GetBatchJobStatus gets the current progress of a batch job.
// GET /api/v1/jobs/batch/:job_id
func GetBatchJobStatus(c *fiber.Ctx) error {
	jobID := c.Params("job_id")
	if jobID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Thiếu job_id"})
	}

	batchJobsMu.RLock()
	job, exists := batchJobs[jobID]
	batchJobsMu.RUnlock()

	if !exists {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Không tìm thấy job"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"job":     job,
	})
}

type ConflictSide struct {
	Drive        string `json:"drive"`
	Path         string `json:"path"`
	Name         string `json:"name"`
	Size         int64  `json:"size"`
	ModTime      string `json:"mod_time"`
	IsDir        bool   `json:"is_dir"`
	ThumbnailURL string `json:"thumbnail_url,omitempty"`
}

type ConflictItem struct {
	FileName string       `json:"file_name"`
	Type     string       `json:"type"` // "video", "picture", "folder", "archive", "file"
	Src      ConflictSide `json:"src"`
	Dest     ConflictSide `json:"dest"`
}

// HandleCheckBatchConflicts checks which items collide in destination folder.
// POST /api/v1/items/batch/check-conflicts
func HandleCheckBatchConflicts(c *fiber.Ctx) error {
	var req BatchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Dữ liệu yêu cầu không hợp lệ"})
	}

	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	if req.Action == "" {
		req.Action = "copy"
	}
	if req.Action != "copy" && req.Action != "move" {
		return c.JSON(fiber.Map{"has_conflicts": false, "conflicts": []ConflictItem{}})
	}

	if len(req.Items) == 0 {
		return c.JSON(fiber.Map{"has_conflicts": false, "conflicts": []ConflictItem{}})
	}

	srcDrive := req.SrcDrive
	if srcDrive == "" {
		srcDrive = c.Query("drive", c.Get("X-Drive", ""))
	}
	srcRoot := configs.ResolveDriveRoot(srcDrive)

	destDrive := req.DestDrive
	if destDrive == "" {
		destDrive = srcDrive
	}
	destRoot := configs.ResolveDriveRoot(destDrive)
	isSameDrive := (filepath.Clean(srcRoot) == filepath.Clean(destRoot))

	cleanDest := filepath.Clean(req.DestFolder)
	if cleanDest == "." || cleanDest == "/" {
		cleanDest = ""
	}
	destFolderPath := filepath.Join(destRoot, cleanDest)

	conflicts := make([]ConflictItem, 0)

	for _, item := range req.Items {
		cleanSrc := filepath.Clean(item.Path)
		if cleanSrc == "." || cleanSrc == "/" || cleanSrc == "" {
			continue
		}
		srcFull := filepath.Join(srcRoot, cleanSrc)
		fileName := filepath.Base(srcFull)
		destFull := filepath.Join(destFolderPath, fileName)
		destRelPath := filepath.ToSlash(filepath.Join(cleanDest, fileName))

		destStat, err := os.Stat(destFull)
		if err != nil {
			// Không tồn tại ở thư mục đích -> không xung đột
			continue
		}

		// Nếu cùng ổ đĩa, di chuyển lên chính nó -> bỏ qua
		if isSameDrive && req.Action == "move" && filepath.Clean(srcFull) == filepath.Clean(destFull) {
			continue
		}

		srcStat, srcErr := os.Stat(srcFull)
		srcSize := int64(0)
		srcModTime := ""
		srcIsDir := false
		if srcErr == nil {
			srcSize = srcStat.Size()
			srcModTime = srcStat.ModTime().Format("2006-01-02 15:04:05")
			srcIsDir = srcStat.IsDir()
		}

		itemType := "file"
		lowerName := strings.ToLower(fileName)
		if destStat.IsDir() || srcIsDir {
			itemType = "folder"
		} else if utils.IsVideoFile(fileName) {
			itemType = "video"
		} else if utils.IsImageFile(fileName) {
			itemType = "picture"
		} else if strings.HasSuffix(lowerName, ".zip") || strings.HasSuffix(lowerName, ".rar") || strings.HasSuffix(lowerName, ".7z") || strings.HasSuffix(lowerName, ".tar") || strings.HasSuffix(lowerName, ".gz") {
			itemType = "archive"
		}

		srcThumbUrl := ""
		destThumbUrl := ""
		if itemType == "video" || itemType == "picture" {
			srcThumbUrl = fmt.Sprintf("/api/v1/thumbnails/%s/%s", srcDrive, filepath.ToSlash(cleanSrc))
			destThumbUrl = fmt.Sprintf("/api/v1/thumbnails/%s/%s", destDrive, destRelPath)
		}

		conflicts = append(conflicts, ConflictItem{
			FileName: fileName,
			Type:     itemType,
			Src: ConflictSide{
				Drive:        srcDrive,
				Path:         filepath.ToSlash(cleanSrc),
				Name:         fileName,
				Size:         srcSize,
				ModTime:      srcModTime,
				IsDir:        srcIsDir,
				ThumbnailURL: srcThumbUrl,
			},
			Dest: ConflictSide{
				Drive:        destDrive,
				Path:         destRelPath,
				Name:         fileName,
				Size:         destStat.Size(),
				ModTime:      destStat.ModTime().Format("2006-01-02 15:04:05"),
				IsDir:        destStat.IsDir(),
				ThumbnailURL: destThumbUrl,
			},
		})
	}

	return c.JSON(fiber.Map{
		"has_conflicts": len(conflicts) > 0,
		"conflicts":     conflicts,
	})
}
