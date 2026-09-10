package youtube

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	pythonapi "backend/api/python"
	"backend/events"
)

func copyFileWithContext(ctx context.Context, src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	buf := make([]byte, 1024*1024)
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		n, rErr := in.Read(buf)
		if n > 0 {
			if _, wErr := out.Write(buf[:n]); wErr != nil {
				return wErr
			}
		}
		if rErr == io.EOF {
			break
		}
		if rErr != nil {
			return rErr
		}
	}
	return out.Sync()
}

// commitMediaFile safely copies the completed media file directly to destination.
// It NEVER creates a title-named directory.
func commitMediaFile(ctx context.Context, sourceFile, destination, filename, jobID string) (string, error) {
	if _, err := os.Stat(sourceFile); err != nil {
		return "", fmt.Errorf("file phương tiện trong workspace không tồn tại: %w", err)
	}

	destinationPath, err := pythonapi.SafeArchivePath(destination)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(destinationPath, 0755); err != nil {
		return "", fmt.Errorf("không thể tạo thư mục đích: %w", err)
	}

	finalPath := uniqueFile(destinationPath, filename)
	partialPath := finalPath + ".appview-copying-" + jobID
	_ = os.Remove(partialPath)

	if err := copyFileWithContext(ctx, sourceFile, partialPath); err != nil {
		_ = os.Remove(partialPath)
		return "", err
	}
	if ctx.Err() != nil {
		_ = os.Remove(partialPath)
		return "", ctx.Err()
	}
	if err := os.Rename(partialPath, finalPath); err != nil {
		_ = os.Remove(partialPath)
		return "", fmt.Errorf("không thể hoàn tất chuyển file phương tiện: %w", err)
	}

	cleanDest := strings.Trim(filepath.ToSlash(filepath.Clean(destination)), "/")
	if cleanDest == "." {
		cleanDest = ""
	}
	parentPath := cleanDest
	publicPath := filepath.Base(finalPath)
	if parentPath != "" {
		publicPath = parentPath + "/" + filepath.Base(finalPath)
	}
	_ = events.Publish(events.FilesystemEvent{
		Type:       "folder_created",
		Path:       publicPath,
		NewPath:    publicPath,
		ParentPath: parentPath,
	})

	return finalPath, nil
}
