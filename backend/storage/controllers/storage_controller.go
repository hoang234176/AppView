package controllers

import (
	"fmt"
	"os"
	pathpkg "path"
	"path/filepath"
	"strings"

	"backend/configs"
	"backend/events"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

func Ping(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "pong"})
}

func GetDrives(c *fiber.Ctx) error {
	drives := configs.GetDrivesWithStats()
	defaultDrive := "HDD"
	if len(drives) > 0 {
		defaultDrive = drives[0].ID
	}
	return c.JSON(fiber.Map{
		"drives":       drives,
		"defaultDrive": defaultDrive,
	})
}


func GetFolders(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	targetRelPath := c.Query("path", "")

	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 0)

	folderLimit := c.QueryInt("folder_limit", limit)
	pictureLimit := c.QueryInt("picture_limit", limit)
	videoLimit := c.QueryInt("video_limit", limit)

	folderPage := c.QueryInt("folder_page", page)
	picturePage := c.QueryInt("picture_page", page)
	videoPage := c.QueryInt("video_page", page)

	folders, err := utils.GetSubFolders(rootPath, targetRelPath)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	pictures, _ := utils.GetPicturesInFolder(rootPath, targetRelPath)
	videos, _ := utils.GetVideosInFolder(rootPath, targetRelPath)

	totalFolders := len(folders)
	totalPictures := len(pictures)
	totalVideos := len(videos)

	if folderLimit > 0 {
		start := (folderPage - 1) * folderLimit
		if start < 0 {
			start = 0
		}
		if start >= totalFolders {
			folders = folders[:0]
		} else {
			end := start + folderLimit
			if end > totalFolders {
				end = totalFolders
			}
			folders = folders[start:end]
		}
	}

	if pictureLimit > 0 {
		start := (picturePage - 1) * pictureLimit
		if start < 0 {
			start = 0
		}
		if start >= totalPictures {
			pictures = pictures[:0]
		} else {
			end := start + pictureLimit
			if end > totalPictures {
				end = totalPictures
			}
			pictures = pictures[start:end]
		}
	}

	if videoLimit > 0 {
		start := (videoPage - 1) * videoLimit
		if start < 0 {
			start = 0
		}
		if start >= totalVideos {
			videos = videos[:0]
		} else {
			end := start + videoLimit
			if end > totalVideos {
				end = totalVideos
			}
			videos = videos[start:end]
		}
	}

	driveParam := strings.TrimSpace(c.Params("drive", ""))
	if driveParam == "" {
		driveParam = strings.TrimSpace(c.Query("drive", c.Get("X-Drive", "")))
	}
	if driveParam == "" {
		d := configs.FindDriveForPath(rootPath)
		driveParam = d.ID
	}
	if driveParam == "" {
		driveParam = "HDD"
	}

	for i := range pictures {
		encodedPath := utils.EncodePathSegments(pictures[i].Path)
		pictures[i].URL = fmt.Sprintf("%s/api/v1/pictures/%s/%s", c.BaseURL(), driveParam, encodedPath)
		pictures[i].ThumbnailURL = fmt.Sprintf("%s/api/v1/thumbnails/%s/%s", c.BaseURL(), driveParam, encodedPath)
	}

	for i := range videos {
		encodedPath := utils.EncodePathSegments(videos[i].Path)
		videos[i].URL = fmt.Sprintf("%s/api/v1/videos/%s/%s", c.BaseURL(), driveParam, encodedPath)
		videos[i].ThumbnailURL = fmt.Sprintf("%s/api/v1/thumbnails/%s/%s", c.BaseURL(), driveParam, encodedPath)
	}

	return c.JSON(fiber.Map{
		"message": "Success",
		"data": fiber.Map{
			"current_path":   targetRelPath,
			"folders":        folders,
			"pictures":       pictures,
			"videos":         videos,
			"total_folders":  totalFolders,
			"total_pictures": totalPictures,
			"total_videos":   totalVideos,
			"page":           page,
			"limit":          limit,
		},
	})
}

func resolveDriveParam(c *fiber.Ctx, rootPath string) string {
	driveParam := strings.TrimSpace(c.Params("drive", ""))
	if driveParam == "" {
		driveParam = strings.TrimSpace(c.Query("drive", c.Get("X-Drive", "")))
	}
	if driveParam == "" {
		d := configs.FindDriveForPath(rootPath)
		driveParam = d.ID
	}
	if driveParam == "" {
		driveParam = "HDD"
	}
	return driveParam
}

func CreateFolder(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	var req struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Tên thư mục không được để trống"})
	}

	folder, err := utils.CreateSubFolder(rootPath, req.Path, req.Name)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	drive := resolveDriveParam(c, rootPath)
	publishFolderEvent(events.FilesystemEvent{
		Type:       "folder_created",
		Drive:      drive,
		Path:       folder.Path,
		NewPath:    folder.Path,
		ParentPath: folderParent(folder.Path),
		Item:       folder,
	})

	return c.JSON(fiber.Map{"message": "Đã tạo thư mục thành công", "data": folder})
}

func RenameFolder(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	var req struct {
		Path    string `json:"path"`
		NewName string `json:"new_name"`
	}
	if err := c.BodyParser(&req); err != nil || req.Path == "" || req.NewName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Dữ liệu đổi tên không hợp lệ"})
	}

	folder, err := utils.RenameSubFolder(rootPath, req.Path, req.NewName)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	oldPath := filepath.ToSlash(filepath.Clean(req.Path))
	drive := resolveDriveParam(c, rootPath)
	publishFolderEvent(events.FilesystemEvent{
		Type:          "folder_renamed",
		Drive:         drive,
		OldPath:       oldPath,
		NewPath:       folder.Path,
		OldParentPath: folderParent(oldPath),
		NewParentPath: folderParent(folder.Path),
		ParentPath:    folderParent(folder.Path),
		Item:          folder,
	})

	return c.JSON(fiber.Map{"message": "Đổi tên thành công", "data": folder})
}

func DeleteFolder(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	path := c.Query("path", "")
	if path == "" {
		var req struct {
			Path string `json:"path"`
		}
		_ = c.BodyParser(&req)
		path = req.Path
	}
	if path == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Đường dẫn thư mục không được để trống"})
	}

	if err := utils.DeleteSubFolder(rootPath, path); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	cleanPath := filepath.ToSlash(filepath.Clean(path))
	drive := resolveDriveParam(c, rootPath)
	publishFolderEvent(events.FilesystemEvent{
		Type:          "folder_deleted",
		Drive:         drive,
		Path:          cleanPath,
		OldPath:       cleanPath,
		ParentPath:    folderParent(cleanPath),
		OldParentPath: folderParent(cleanPath),
	})

	return c.JSON(fiber.Map{"message": "Đã xóa thư mục thành công"})
}

func DeleteFile(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	path := c.Query("path", "")
	if path == "" {
		var req struct {
			Path string `json:"path"`
		}
		_ = c.BodyParser(&req)
		path = req.Path
	}
	if path == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Đường dẫn tệp không được để trống"})
	}

	if err := utils.DeleteFile(rootPath, path); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	cleanPath := filepath.ToSlash(filepath.Clean(path))
	drive := resolveDriveParam(c, rootPath)
	publishFolderEvent(events.FilesystemEvent{
		Type:          "file_deleted",
		Drive:         drive,
		Path:          cleanPath,
		OldPath:       cleanPath,
		ParentPath:    folderParent(cleanPath),
		OldParentPath: folderParent(cleanPath),
	})

	return c.JSON(fiber.Map{"message": "Đã xóa tệp thành công"})
}

func HandleGetTreeFolder(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	tree, err := utils.GetFolderTree(rootPath, "")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"message": "Success",
		"data":    tree,
	})
}

func HandleMoveItem(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	var req struct {
		Src            string `json:"src"`
		Dest           string `json:"dest"`
		SrcPath        string `json:"src_path"`
		DestFolderPath string `json:"dest_folder_path"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Dữ liệu di chuyển không hợp lệ"})
	}

	src := req.Src
	if src == "" {
		src = req.SrcPath
	}
	dest := req.Dest
	if dest == "" {
		dest = req.DestFolderPath
	}

	if src == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Đường dẫn nguồn không được để trống"})
	}

	info, statErr := os.Stat(filepath.Join(rootPath, filepath.Clean(src)))
	if err := utils.MoveItem(rootPath, src, dest); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	oldPath := filepath.ToSlash(filepath.Clean(src))
	newPath := filepath.ToSlash(filepath.Join(dest, filepath.Base(src)))
	drive := resolveDriveParam(c, rootPath)

	if statErr == nil && info.IsDir() {
		publishFolderEvent(events.FilesystemEvent{
			Type:          "folder_moved",
			Drive:         drive,
			OldPath:       oldPath,
			NewPath:       newPath,
			OldParentPath: folderParent(oldPath),
			NewParentPath: folderParent(newPath),
			ParentPath:    folderParent(newPath),
		})
	} else {
		item := utils.GetFileItem(rootPath, newPath, drive)
		publishFolderEvent(events.FilesystemEvent{
			Type:          "file_moved",
			Drive:         drive,
			OldPath:       oldPath,
			NewPath:       newPath,
			OldParentPath: folderParent(oldPath),
			NewParentPath: folderParent(newPath),
			ParentPath:    folderParent(newPath),
			Item:          item,
		})
	}

	return c.JSON(fiber.Map{"message": "Di chuyển thành công"})
}

func folderParent(folderPath string) string {
	parent := pathpkg.Dir(folderPath)
	if parent == "." {
		return ""
	}
	return parent
}

func publishFolderEvent(event events.FilesystemEvent) {
	if err := events.Publish(event); err != nil {
		utils.LogEvent("WARN", "filesystem event publish failed", map[string]any{
			"eventType": event.Type,
			"path":      event.Path,
			"oldPath":   event.OldPath,
			"newPath":   event.NewPath,
			"error":     err.Error(),
		})
	}
}
