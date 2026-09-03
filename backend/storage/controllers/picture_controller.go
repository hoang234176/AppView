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
	relPath := c.Params("*")
	fullPath, _ := utils.ResolveFilePath(rootPath, relPath)
	return utils.ServeFileSafely(c, fullPath)
}

func ServeThumbnail(c *fiber.Ctx) error {
	rootPath := configs.GetRootFolderPath(c)
	relPath := c.Params("*")
	fullPath, resolvedRelPath := utils.ResolveFilePath(rootPath, relPath)

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
		return utils.ServeFileSafely(c, fullPath)
	}

	return c.Status(fiber.StatusNotFound).SendString("No thumbnail")
}
