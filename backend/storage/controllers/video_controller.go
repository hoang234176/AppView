package controllers

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"backend/configs"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

func GetVideos(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	targetRelPath := c.Query("path", "")
	videos, err := utils.GetVideosInFolder(rootPath, targetRelPath)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	for _, vid := range videos {
		encodedPath := utils.EncodePathSegments(vid.Path)
		vid.URL = fmt.Sprintf("%s/api/v1/videos/%s?root_path=%s", c.BaseURL(), encodedPath, url.QueryEscape(rootPath))
		vid.ThumbnailURL = fmt.Sprintf("%s/api/v1/thumbnails/%s?root_path=%s", c.BaseURL(), encodedPath, url.QueryEscape(rootPath))
	}
	return c.JSON(fiber.Map{"message": "Success", "data": videos})
}

// StreamVideo is the main entry point dispatching video requests to format-specific handlers
func StreamVideo(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	escapedPath, err := utils.EscapedMediaPath(c, "/api/v1/videos/")
	if err != nil {
		return err
	}
	fullPath, relPath, err := utils.ResolveFilePath(rootPath, escapedPath)
	if err != nil {
		utils.LogEvent("WARN", "video path rejected", map[string]any{"action": "video_open", "requestPath": c.Path(), "rawPath": escapedPath, "error": err.Error()})
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Đường dẫn tệp video không hợp lệ"})
	}
	utils.LogEvent("DEBUG", "video path resolved", map[string]any{"action": "video_open", "requestPath": c.Path(), "rawPath": escapedPath, "decodedRelativePath": relPath, "rootPath": rootPath, "resolvedFilesystemPath": fullPath})

	info, err := os.Stat(fullPath)
	if err != nil || info.IsDir() {
		fields := map[string]any{"action": "video_open", "requestPath": c.Path(), "decodedRelativePath": relPath, "rootPath": rootPath}
		if err != nil {
			fields["error"] = err.Error()
		}
		utils.LogEvent("WARN", "video file not found", fields)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Tệp video không tồn tại hoặc đường dẫn không hợp lệ",
		})
	}

	if info.Size() == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Định dạng tệp video không hợp lệ (dung lượng 0 bytes)",
		})
	}

	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(fullPath), "."))

	switch ext {
	case "mp4", "m4v", "mov":
		return StreamMP4Video(c, fullPath)
	case "mkv":
		return StreamMKVVideo(c, fullPath)
	case "webm":
		return StreamWEBMVideo(c, fullPath)
	case "ts", "flv", "avi", "3gp":
		return StreamTSVideo(c, fullPath)
	default:
		return StreamGenericVideo(c, fullPath)
	}
}

// StreamMP4Video handles standard MP4 / MOV / M4V container files
func StreamMP4Video(c *fiber.Ctx, fullPath string) error {
	c.Set("Content-Type", "video/mp4")
	streamPath := utils.EnsureFaststartMP4(fullPath)
	return utils.ServeFileSafely(c, streamPath)
}

// StreamMKVVideo handles Matroska MKV container files
func StreamMKVVideo(c *fiber.Ctx, fullPath string) error {
	c.Set("Content-Type", "video/x-matroska")
	return utils.ServeFileSafely(c, fullPath)
}

// StreamWEBMVideo handles WebM container files
func StreamWEBMVideo(c *fiber.Ctx, fullPath string) error {
	c.Set("Content-Type", "video/webm")
	return utils.ServeFileSafely(c, fullPath)
}

// StreamTSVideo handles Transport Stream / FLV / AVI video files
func StreamTSVideo(c *fiber.Ctx, fullPath string) error {
	c.Set("Content-Type", "video/mp2t")
	return utils.ServeFileSafely(c, fullPath)
}

// StreamGenericVideo is a fallback handler for unrecognized video formats
func StreamGenericVideo(c *fiber.Ctx, fullPath string) error {
	return utils.ServeFileSafely(c, fullPath)
}
