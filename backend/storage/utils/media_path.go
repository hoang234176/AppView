package utils

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// EscapedMediaPath returns the wildcard portion of the original request URI.
// Fiber route params may already be decoded, so using PathOriginal avoids a
// second decode and keeps literal percent sequences distinguishable.
func EscapedMediaPath(c *fiber.Ctx, routePrefix string) (string, error) {
	original := string(c.Context().URI().PathOriginal())
	if !strings.HasPrefix(original, routePrefix) {
		return "", fiber.NewError(fiber.StatusBadRequest, "invalid media request path")
	}
	return strings.TrimPrefix(original, routePrefix), nil
}
