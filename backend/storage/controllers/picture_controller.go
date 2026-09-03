package controllers

import (
	"os"
	"path/filepath"

	"backend/configs"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

func ServePicture(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	escapedPath, err := utils.EscapedMediaPath(c, "/api/v1/pictures/")
	if err != nil {
		return err
	}
	fullPath, relPath, err := utils.ResolveFilePath(rootPath, escapedPath)
	if err != nil {
		utils.LogEvent("WARN", "picture path rejected", map[string]any{"action": "picture_open", "requestPath": c.Path(), "rawPath": escapedPath, "error": err.Error()})
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Đường dẫn ảnh không hợp lệ"})
	}
	utils.LogEvent("DEBUG", "picture path resolved", map[string]any{"action": "picture_open", "requestPath": c.Path(), "rawPath": escapedPath, "decodedRelativePath": relPath, "rootPath": rootPath, "resolvedFilesystemPath": fullPath})
	return utils.ServeFileSafely(c, fullPath)
}

func ServeThumbnail(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	escapedPath, err := utils.EscapedMediaPath(c, "/api/v1/thumbnails/")
	if err != nil {
		return err
	}
	fullPath, resolvedRelPath, err := utils.ResolveFilePath(rootPath, escapedPath)
	if err != nil {
		utils.LogEvent("WARN", "thumbnail path rejected", map[string]any{"action": "thumbnail_open", "requestPath": c.Path(), "rawPath": escapedPath, "error": err.Error()})
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Đường dẫn thumbnail không hợp lệ"})
	}
	utils.LogEvent("DEBUG", "thumbnail path resolved", map[string]any{"action": "thumbnail_open", "requestPath": c.Path(), "rawPath": escapedPath, "decodedRelativePath": resolvedRelPath, "rootPath": rootPath, "resolvedFilesystemPath": fullPath})

	thumbDir := filepath.Join(rootPath, ".thumbnails")
	thumbPath := filepath.Join(thumbDir, resolvedRelPath+".jpg")

	if _, err := os.Stat(thumbPath); err == nil {
		return utils.ServeFileSafely(c, thumbPath)
	}

	if err := utils.GenerateThumbnail(fullPath, thumbPath); err == nil {
		if _, statErr := os.Stat(thumbPath); statErr == nil {
			return utils.ServeFileSafely(c, thumbPath)
		}
	}

	if utils.IsImageFile(resolvedRelPath) || utils.IsVideoFile(resolvedRelPath) {
		if _, statErr := os.Stat(fullPath); statErr != nil {
			utils.LogEvent("WARN", "thumbnail source file not found", map[string]any{"action": "thumbnail_open", "decodedRelativePath": resolvedRelPath, "error": statErr.Error()})
		}
		return utils.ServeFileSafely(c, fullPath)
	}

	return c.Status(fiber.StatusNotFound).SendString("No thumbnail")
}
