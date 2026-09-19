package utils

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type BatchItem struct {
	Type string `json:"type"` // "folder", "picture", "video", "file"
	Path string `json:"path"` // relative path within source root
}

type ProgressCallback func(copiedBytes int64, currentFile string)

// CalculateTotalBytes computes the total size in bytes of all items in srcRoot.
func CalculateTotalBytes(srcRoot string, items []BatchItem) int64 {
	var total int64
	for _, item := range items {
		clean := filepath.Clean(item.Path)
		if clean == "." || clean == "/" || clean == "" {
			continue
		}
		full := filepath.Join(srcRoot, clean)
		info, err := os.Stat(full)
		if err != nil {
			continue
		}
		if info.IsDir() {
			_ = filepath.Walk(full, func(path string, fi os.FileInfo, err error) error {
				if err == nil && !fi.IsDir() {
					total += fi.Size()
				}
				return nil
			})
		} else {
			total += info.Size()
		}
	}
	return total
}

func copyFileWithProgress(srcFull, destFull string, onProgress ProgressCallback, copiedAccumulator *int64) error {
	destDir := filepath.Dir(destFull)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("không thể tạo thư mục đích %s: %w", destDir, err)
	}

	srcFile, err := os.Open(srcFull)
	if err != nil {
		return fmt.Errorf("không thể mở file nguồn %s: %w", srcFull, err)
	}
	defer srcFile.Close()

	destFileName := filepath.Base(destFull)
	tempDestFull := filepath.Join(destDir, fmt.Sprintf(".tmp_copy_%d_%s", time.Now().UnixNano(), destFileName))

	destFile, err := os.Create(tempDestFull)
	if err != nil {
		return fmt.Errorf("không thể tạo file tạm đích %s: %w", tempDestFull, err)
	}

	buf := make([]byte, 128*1024) // 128KB buffer for smooth I/O
	fileName := filepath.Base(srcFull)

	writeErr := func() error {
		defer destFile.Close()
		for {
			nr, rerr := srcFile.Read(buf)
			if nr > 0 {
				nw, werr := destFile.Write(buf[0:nr])
				if nw > 0 {
					*copiedAccumulator += int64(nw)
					if onProgress != nil {
						onProgress(*copiedAccumulator, fileName)
					}
				}
				if werr != nil {
					return fmt.Errorf("lỗi ghi file %s: %w", tempDestFull, werr)
				}
				if nr != nw {
					return io.ErrShortWrite
				}
			}
			if rerr != nil {
				if rerr == io.EOF {
					break
				}
				return fmt.Errorf("lỗi đọc file %s: %w", srcFull, rerr)
			}
		}
		_ = destFile.Sync()
		return nil
	}()

	if writeErr != nil {
		_ = os.Remove(tempDestFull)
		return writeErr
	}

	// Atomically move the completed file into place
	if err := os.Rename(tempDestFull, destFull); err != nil {
		_ = os.Remove(tempDestFull)
		return fmt.Errorf("không thể hoàn tất tệp đích %s: %w", destFull, err)
	}

	// Preserve modification time
	if srcInfo, err := srcFile.Stat(); err == nil {
		_ = os.Chtimes(destFull, srcInfo.ModTime(), srcInfo.ModTime())
	}

	return nil
}

func copyDirWithProgress(srcFull, destFull string, onProgress ProgressCallback, copiedAccumulator *int64) error {
	if err := os.MkdirAll(destFull, 0755); err != nil {
		return fmt.Errorf("không thể tạo thư mục đích %s: %w", destFull, err)
	}

	return filepath.Walk(srcFull, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(srcFull, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}

		targetPath := filepath.Join(destFull, rel)
		if info.IsDir() {
			return os.MkdirAll(targetPath, 0755)
		}

		return copyFileWithProgress(path, targetPath, onProgress, copiedAccumulator)
	})
}

func getAvailableCopyPath(destFolder, fileName string) string {
	target := filepath.Join(destFolder, fmt.Sprintf("Copy_%s", fileName))
	if _, err := os.Stat(target); os.IsNotExist(err) {
		return target
	}
	ext := filepath.Ext(fileName)
	nameWithoutExt := strings.TrimSuffix(fileName, ext)
	for i := 2; i <= 1000; i++ {
		candidate := filepath.Join(destFolder, fmt.Sprintf("Copy (%d)_%s%s", i, nameWithoutExt, ext))
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate
		}
	}
	return target
}

// ---------------------------------------------------------------------------
// HÀM 1: ExecuteBatchSameDrive — Xử lý các tác vụ TRONG CÙNG MỘT Ổ CỨNG
// ---------------------------------------------------------------------------
func ExecuteBatchSameDrive(rootPath string, items []BatchItem, destRelFolder string, action string, onProgress ProgressCallback) error {
	cleanDest := filepath.Clean(destRelFolder)
	if cleanDest == "." || cleanDest == "/" {
		cleanDest = ""
	}
	destFolder := filepath.Join(rootPath, cleanDest)

	var copiedBytes int64

	for _, item := range items {
		cleanSrc := filepath.Clean(item.Path)
		if cleanSrc == "." || cleanSrc == "/" || cleanSrc == "" {
			continue
		}
		srcFull := filepath.Join(rootPath, cleanSrc)
		fileName := filepath.Base(srcFull)
		destFull := filepath.Join(destFolder, fileName)

		info, err := os.Stat(srcFull)
		if err != nil {
			LogError("[BATCH SAME-DRIVE] Không tìm thấy phần tử nguồn: %s (%v)", srcFull, err)
			continue
		}

		switch action {
		case "move":
			if srcFull == destFull {
				continue
			}
			if err := os.MkdirAll(destFolder, 0755); err != nil {
				return fmt.Errorf("không thể tạo thư mục đích: %w", err)
			}
			if err := os.Rename(srcFull, destFull); err != nil {
				LogError("[BATCH SAME-DRIVE] Lỗi di chuyển %s -> %s: %v", srcFull, destFull, err)
				return err
			}
			if !info.IsDir() {
				copiedBytes += info.Size()
			}
			if onProgress != nil {
				onProgress(copiedBytes, fileName)
			}
			LogInfo("[BATCH SAME-DRIVE] Đã di chuyển: %s -> %s", cleanSrc, filepath.Join(cleanDest, fileName))

		case "copy":
			if srcFull == destFull {
				destFull = getAvailableCopyPath(destFolder, fileName)
			}
			if info.IsDir() {
				if err := copyDirWithProgress(srcFull, destFull, onProgress, &copiedBytes); err != nil {
					return err
				}
			} else {
				if err := copyFileWithProgress(srcFull, destFull, onProgress, &copiedBytes); err != nil {
					return err
				}
			}
			LogInfo("[BATCH SAME-DRIVE] Đã sao chép: %s -> %s", cleanSrc, destFull)

		case "delete":
			if err := os.RemoveAll(srcFull); err != nil {
				LogError("[BATCH SAME-DRIVE] Lỗi xóa %s: %v", srcFull, err)
				return err
			}
			LogInfo("[BATCH SAME-DRIVE] Đã xóa: %s", cleanSrc)
		}
	}

	return nil
}

// ---------------------------------------------------------------------------
// HÀM 2: ExecuteBatchCrossDrive — Xử lý các tác vụ NGOÀI Ổ CỨNG (GIỮA CÁC Ổ KHÁC NHAU)
// ---------------------------------------------------------------------------
func ExecuteBatchCrossDrive(srcRoot string, destRoot string, items []BatchItem, destRelFolder string, action string, onProgress ProgressCallback) error {
	cleanDest := filepath.Clean(destRelFolder)
	if cleanDest == "." || cleanDest == "/" {
		cleanDest = ""
	}
	destFolder := filepath.Join(destRoot, cleanDest)

	var copiedBytes int64

	for _, item := range items {
		cleanSrc := filepath.Clean(item.Path)
		if cleanSrc == "." || cleanSrc == "/" || cleanSrc == "" {
			continue
		}
		srcFull := filepath.Join(srcRoot, cleanSrc)
		fileName := filepath.Base(srcFull)
		destFull := filepath.Join(destFolder, fileName)

		info, err := os.Stat(srcFull)
		if err != nil {
			LogError("[BATCH CROSS-DRIVE] Không tìm thấy phần tử nguồn: %s (%v)", srcFull, err)
			continue
		}

		switch action {
		case "copy":
			if info.IsDir() {
				if err := copyDirWithProgress(srcFull, destFull, onProgress, &copiedBytes); err != nil {
					return fmt.Errorf("lỗi sao chép thư mục %s sang %s: %w", srcFull, destFull, err)
				}
			} else {
				if err := copyFileWithProgress(srcFull, destFull, onProgress, &copiedBytes); err != nil {
					return fmt.Errorf("lỗi sao chép file %s sang %s: %w", srcFull, destFull, err)
				}
			}
			LogInfo("[BATCH CROSS-DRIVE] Đã sao chép liên ổ đĩa: %s -> %s", srcFull, destFull)

		case "move":
			// Di chuyển liên ổ: Sao chép hoàn tất 100% sang ổ đích trước, sau đó xóa nguồn
			if info.IsDir() {
				if err := copyDirWithProgress(srcFull, destFull, onProgress, &copiedBytes); err != nil {
					return fmt.Errorf("lỗi di chuyển thư mục (giai đoạn sao chép) %s sang %s: %w", srcFull, destFull, err)
				}
				if err := os.RemoveAll(srcFull); err != nil {
					LogError("[BATCH CROSS-DRIVE] Đã sao chép xong nhưng lỗi xóa thư mục nguồn %s: %v", srcFull, err)
				}
			} else {
				if err := copyFileWithProgress(srcFull, destFull, onProgress, &copiedBytes); err != nil {
					return fmt.Errorf("lỗi di chuyển file (giai đoạn sao chép) %s sang %s: %w", srcFull, destFull, err)
				}
				if err := os.Remove(srcFull); err != nil {
					LogError("[BATCH CROSS-DRIVE] Đã sao chép xong nhưng lỗi xóa file nguồn %s: %v", srcFull, err)
				}
			}
			LogInfo("[BATCH CROSS-DRIVE] Đã di chuyển liên ổ đĩa: %s -> %s", srcFull, destFull)

		case "delete":
			// Xóa vẫn thực thi tại ổ nguồn
			if err := os.RemoveAll(srcFull); err != nil {
				LogError("[BATCH CROSS-DRIVE] Lỗi xóa %s: %v", srcFull, err)
				return err
			}
		}
	}

	return nil
}
