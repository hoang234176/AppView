package utils

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// EscapedMediaPath returns the wildcard portion of the original request URI.
// Fiber route params may already be decoded, so using PathOriginal avoids a
// second decode and keeps literal percent sequences distinguishable.
// Supports:
//   - /api/v1/thumbnails/:drive/* (e.g. /api/v1/thumbnails/SSD/path)
//   - /api/v1/:drive/thumbnails/* (e.g. /api/v1/SSD/thumbnails/path)
//   - /api/v1/thumbnails/* (e.g. /api/v1/thumbnails/path)
func EscapedMediaPath(c *fiber.Ctx, routePrefixes ...string) (string, error) {
	original := string(c.Context().URI().PathOriginal())
	var rel string
	found := false

	for _, prefix := range routePrefixes {
		if strings.HasPrefix(original, prefix) {
			rel = strings.TrimPrefix(original, prefix)
			found = true
			break
		}
		if idx := strings.Index(original, prefix); idx != -1 {
			rel = original[idx+len(prefix):]
			found = true
			break
		}
	}

	if !found {
		return "", fiber.NewError(fiber.StatusBadRequest, "invalid media request path")
	}

	// If route has a :drive param, and the remaining path starts with ":drive/", strip it.
	// E.g. /api/v1/thumbnails/SSD/Hoang/pic.jpg -> after /thumbnails/ is SSD/Hoang/pic.jpg -> strips SSD/ -> Hoang/pic.jpg
	if drive := c.Params("drive"); drive != "" {
		drivePrefix := drive + "/"
		if strings.HasPrefix(rel, drivePrefix) {
			rel = strings.TrimPrefix(rel, drivePrefix)
		}
	}

	return rel, nil
}
