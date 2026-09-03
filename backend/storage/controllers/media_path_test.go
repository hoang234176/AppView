package controllers

import (
	"io"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

func TestMediaRoutesDecodeEscapedPathExactlyOnce(t *testing.T) {
	root := t.TempDir()
	filename := "space # % @ 糕哥 🎥 ｜ file%20name.webm"
	relativePath := "Cosplay/Facebook/" + filename
	fullPath := filepath.Join(root, filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(fullPath, []byte("0123456789"), 0o644); err != nil {
		t.Fatal(err)
	}
	thumbnailPath := filepath.Join(root, ".thumbnails", filepath.FromSlash(relativePath)+".jpg")
	if err := os.MkdirAll(filepath.Dir(thumbnailPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(thumbnailPath, []byte("thumbnail"), 0o644); err != nil {
		t.Fatal(err)
	}

	escapedPath := utils.EncodePathSegments(relativePath)
	if resolved, decoded, err := utils.ResolveFilePath(root, escapedPath); err != nil || resolved != fullPath || decoded != relativePath {
		t.Fatalf("direct resolve = %q, %q, %v; want %q, %q", resolved, decoded, err, fullPath, relativePath)
	}
	rootQuery := url.QueryEscape(root)
	app := fiber.New()
	app.Get("/api/v1/videos/*", StreamVideo)
	app.Get("/api/v1/thumbnails/*", ServeThumbnail)

	for _, endpoint := range []string{"videos", "thumbnails"} {
		request := httptest.NewRequest("GET", "/api/v1/"+endpoint+"/"+escapedPath+"?root_path="+rootQuery, nil)
		response, err := app.Test(request)
		if err != nil {
			t.Fatalf("%s request: %v", endpoint, err)
		}
		if response.StatusCode != fiber.StatusOK {
			t.Fatalf("%s status = %d, want %d (escaped=%q root=%q)", endpoint, response.StatusCode, fiber.StatusOK, escapedPath, root)
		}
	}

	assertVideoRange(t, app, escapedPath, rootQuery, "bytes=0-", fiber.StatusPartialContent, "0123456789", "bytes 0-9/10")
	assertVideoRange(t, app, escapedPath, rootQuery, "bytes=4-7", fiber.StatusPartialContent, "4567", "bytes 4-7/10")
	assertVideoRange(t, app, escapedPath, rootQuery, "bytes=50-", fiber.StatusRequestedRangeNotSatisfiable, "", "bytes */10")
}

func assertVideoRange(t *testing.T, app *fiber.App, escapedPath, rootQuery, byteRange string, expectedStatus int, expectedBody, expectedContentRange string) {
	t.Helper()
	request := httptest.NewRequest("GET", "/api/v1/videos/"+escapedPath+"?root_path="+rootQuery, nil)
	request.Header.Set("Range", byteRange)
	response, err := app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != expectedStatus || string(body) != expectedBody || response.Header.Get("Content-Range") != expectedContentRange {
		t.Fatalf("range %q: status=%d body=%q content-range=%q", byteRange, response.StatusCode, body, response.Header.Get("Content-Range"))
	}
	if expectedStatus == fiber.StatusPartialContent && response.Header.Get("Accept-Ranges") != "bytes" {
		t.Fatalf("range %q missing Accept-Ranges", byteRange)
	}
}

func TestDecodeRelativePathRejectsTraversalAndKeepsLiteralPercent(t *testing.T) {
	decoded, err := utils.DecodeRelativePath("folder/file%2520name.mp4")
	if err != nil || decoded != "folder/file%20name.mp4" {
		t.Fatalf("decoded = %q, err = %v", decoded, err)
	}
	for _, value := range []string{"../secret.mp4", "%2E%2E/secret.mp4", "folder/%2Fsecret.mp4"} {
		if _, err := utils.DecodeRelativePath(value); err == nil {
			t.Fatalf("DecodeRelativePath(%q) accepted traversal/separator", value)
		}
	}
}

func TestVideoRouteServesNormalFilename(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "test.webm"), []byte("normal"), 0o644); err != nil {
		t.Fatal(err)
	}
	app := fiber.New()
	app.Get("/api/v1/videos/*", StreamVideo)
	request := httptest.NewRequest("GET", "/api/v1/videos/test.webm?root_path="+url.QueryEscape(root), nil)
	response, err := app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode != fiber.StatusOK || string(body) != "normal" || response.Header.Get("Accept-Ranges") != "bytes" {
		t.Fatalf("normal video status=%d body=%q accept-ranges=%q", response.StatusCode, body, response.Header.Get("Accept-Ranges"))
	}
}
