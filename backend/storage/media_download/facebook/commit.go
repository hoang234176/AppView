package facebook

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	pythonapi "backend/api/python"
	"backend/events"
	"backend/utils"
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

// commitFacebookMedia safely moves downloaded items to destination and emits folder invalidations.
func commitFacebookMedia(ctx context.Context, job *Job, workspace string) error {
	job.mu.RLock()
	destination := job.Destination
	filename := job.Filename
	items := job.items
	jobID := job.ID
	job.mu.RUnlock()

	destinationPath, err := pythonapi.SafeArchivePath(destination)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(destinationPath, 0755); err != nil {
		return fmt.Errorf("không thể tạo thư mục đích: %w", err)
	}

	cleanDest := strings.Trim(filepath.ToSlash(filepath.Clean(destination)), "/")
	if cleanDest == "." {
		cleanDest = ""
	}
	parentPath := cleanDest

	if len(items) == 0 {
		// Single file commit (video)
		sourceFile := filepath.Join(workspace, filename)
		_, err := commitVideoFile(ctx, sourceFile, destination, filename, jobID)
		return err
	}

	// Multiple items (photos): copy each photo directly into destinationPath without creating a subfolder
	for _, item := range items {
		sourceFile := filepath.Join(workspace, item.Filename)
		if _, err := os.Stat(sourceFile); err != nil {
			continue
		}
		finalPath := uniqueFile(destinationPath, item.Filename)
		partialPath := finalPath + ".appview-copying-" + jobID
		_ = os.Remove(partialPath)

		if err := copyFileWithContext(ctx, sourceFile, partialPath); err != nil {
			_ = os.Remove(partialPath)
			return err
		}
		if err := os.Rename(partialPath, finalPath); err != nil {
			_ = os.Remove(partialPath)
			return fmt.Errorf("không thể hoàn tất chuyển file phương tiện: %w", err)
		}

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
		utils.LogInfo("[STORAGE] Đã lưu tệp an toàn vào đích: %s", publicPath)
	}

	return nil
}

// commitVideoFile safely copies a video file directly to destination without creating a subfolder.
func commitVideoFile(ctx context.Context, sourceFile, destination, filename, jobID string) (string, error) {
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
	utils.LogInfo("[STORAGE] Đã lưu tệp an toàn vào đích: %s", publicPath)
	return finalPath, nil
}
