package utils

import (
	"context"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"
	"mime"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"backend/configs"
	"backend/models"

	"github.com/disintegration/imaging"
	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
	_ "golang.org/x/image/webp"
)

func ServeFileSafely(c *fiber.Ctx, fullPath string) error {
	// SendFile/FastHTTP FS internally re-parses the supplied filename as a URI.
	// A literal percent in a real filename is then mistaken for another escape
	// sequence. Stream the verified filesystem handle instead, so this function
	// never routes a local filename through URL parsing again.
	file, err := os.Open(fullPath)
	if err != nil {
		return err
	}
	info, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return err
	}
	if len(c.Response().Header.ContentType()) == 0 {
		if contentType := mime.TypeByExtension(filepath.Ext(fullPath)); contentType != "" {
			c.Set(fiber.HeaderContentType, contentType)
		}
	}
	size := info.Size()
	c.Set(fiber.HeaderAcceptRanges, "bytes")
	c.Set(fiber.HeaderContentLength, strconv.FormatInt(size, 10))
	if c.Method() == fiber.MethodHead {
		_ = file.Close()
		return nil
	}
	if byteRange := c.Get(fiber.HeaderRange); byteRange != "" {
		start, end, rangeErr := fasthttp.ParseByteRange([]byte(byteRange), int(size))
		if rangeErr != nil {
			_ = file.Close()
			c.Status(fiber.StatusRequestedRangeNotSatisfiable)
			c.Set(fiber.HeaderContentRange, fmt.Sprintf("bytes */%d", size))
			c.Set(fiber.HeaderContentLength, "0")
			return nil
		}
		length := int64(end - start + 1)
		c.Status(fiber.StatusPartialContent)
		c.Response().Header.SetContentRange(start, end, int(size))
		c.Set(fiber.HeaderContentLength, strconv.FormatInt(length, 10))
		c.Context().Response.SetBodyStream(fileSection{Reader: io.NewSectionReader(file, int64(start), length), Closer: file}, int(length))
		return nil
	}
	c.Context().Response.SetBodyStream(file, int(size))
	return nil
}

// fileSection closes the verified source file after fasthttp sends a range.
type fileSection struct {
	io.Reader
	io.Closer
}

func EncodePathSegments(rawPath string) string {
	cleanPath := strings.TrimPrefix(rawPath, "/")
	parts := strings.Split(cleanPath, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}

func sanitizeName(s string) string {
	s = strings.ReplaceAll(s, "+", " ")
	s = strings.ReplaceAll(s, "\u00a0", " ")
	s = strings.ToLower(strings.TrimSpace(s))
	var sb strings.Builder
	for _, r := range s {
		if r > 32 && r != 127 {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

// ResolveFilePath decodes an escaped URL path exactly once, segment by
// segment. Callers must pass the request's original escaped wildcard, not a
// framework-decoded route parameter. This preserves literal "%20" filenames
// (sent as %2520) while rejecting decoded traversal/separator segments.
func ResolveFilePath(rootPath string, escapedRelPath string) (string, string, error) {
	decodedRel, err := DecodeRelativePath(escapedRelPath)
	if err != nil {
		return "", "", err
	}

	fullPath := filepath.Join(rootPath, filepath.FromSlash(decodedRel))
	if _, err := os.Stat(fullPath); err == nil {
		return fullPath, decodedRel, nil
	}

	dirRel := filepath.Dir(decodedRel)
	fileName := filepath.Base(decodedRel)
	dirFull := filepath.Join(rootPath, dirRel)
	if entries, err := os.ReadDir(dirFull); err == nil {
		ext := filepath.Ext(fileName)
		baseWithoutExt := strings.TrimSuffix(fileName, ext)

		// 1. EqualFold match
		for _, entry := range entries {
			if strings.EqualFold(entry.Name(), fileName) {
				matchedRel := filepath.ToSlash(filepath.Join(dirRel, entry.Name()))
				return filepath.Join(rootPath, matchedRel), matchedRel, nil
			}
		}

		// 2. Sanitized match (handles spaces, +, CJK characters, emojis, special symbols)
		sanitizedTarget := sanitizeName(fileName)
		for _, entry := range entries {
			if !entry.IsDir() && sanitizeName(entry.Name()) == sanitizedTarget {
				matchedRel := filepath.ToSlash(filepath.Join(dirRel, entry.Name()))
				return filepath.Join(rootPath, matchedRel), matchedRel, nil
			}
		}

		// 3. Substring prefix match
		prefix := baseWithoutExt
		if len(prefix) > 20 {
			prefix = prefix[:20]
		}
		for _, entry := range entries {
			if !entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), strings.ToLower(ext)) {
				if strings.Contains(strings.ToLower(entry.Name()), strings.ToLower(prefix)) {
					matchedRel := filepath.ToSlash(filepath.Join(dirRel, entry.Name()))
					return filepath.Join(rootPath, matchedRel), matchedRel, nil
				}
			}
		}
	}

	return fullPath, decodedRel, nil
}

func DecodeRelativePath(escapedRelPath string) (string, error) {
	escapedRelPath = strings.TrimPrefix(escapedRelPath, "/")
	if escapedRelPath == "" {
		return "", fmt.Errorf("media path is required")
	}
	parts := strings.Split(escapedRelPath, "/")
	decodedParts := make([]string, 0, len(parts))
	for _, part := range parts {
		decoded, err := url.PathUnescape(part)
		if err != nil {
			return "", fmt.Errorf("invalid escaped path segment")
		}
		if decoded == "" || decoded == "." || decoded == ".." || strings.Contains(decoded, "/") {
			return "", fmt.Errorf("invalid media path segment")
		}
		decodedParts = append(decodedParts, decoded)
	}
	decoded := strings.Join(decodedParts, "/")
	clean := filepath.ToSlash(filepath.Clean(decoded))
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") || filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid media path")
	}
	return clean, nil
}

var (
	pictureMetaCache = make(map[string]struct {
		Width   int
		Height  int
		ModTime time.Time
	})
	pictureMetaMu sync.RWMutex

	videoMetaCache = make(map[string]struct {
		Width   int
		Height  int
		ModTime time.Time
	})
	videoMetaMu sync.RWMutex
)

func IsImageFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".webp" || ext == ".heic"
}

func IsVideoFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".mp4" || ext == ".mkv" || ext == ".mov" || ext == ".avi" || ext == ".webm" || ext == ".m4v" || ext == ".flv" || ext == ".ts"
}

func GetImageDimensions(fullPath string, modTime time.Time) (int, int) {
	pictureMetaMu.RLock()
	if cached, ok := pictureMetaCache[fullPath]; ok && cached.ModTime.Equal(modTime) {
		pictureMetaMu.RUnlock()
		return cached.Width, cached.Height
	}
	pictureMetaMu.RUnlock()

	file, err := os.Open(fullPath)
	if err != nil {
		return 0, 0
	}
	defer file.Close()

	cfg, _, err := image.DecodeConfig(file)
	if err != nil {
		return 0, 0
	}

	pictureMetaMu.Lock()
	pictureMetaCache[fullPath] = struct {
		Width   int
		Height  int
		ModTime time.Time
	}{Width: cfg.Width, Height: cfg.Height, ModTime: modTime}
	pictureMetaMu.Unlock()

	return cfg.Width, cfg.Height
}

var ffmpegSemaphore = make(chan struct{}, 2)

func EnsureFaststartMP4(fullPath string) string {
	ext := strings.ToLower(filepath.Ext(fullPath))
	if ext != ".mp4" && ext != ".mov" && ext != ".m4v" {
		return fullPath
	}

	dir := filepath.Dir(fullPath)
	relDir, err := filepath.Rel(configs.DEFAULT_ROOT_PATH, dir)
	if err != nil {
		relDir = ""
	}
	cacheDir := filepath.Join(configs.DEFAULT_ROOT_PATH, ".thumbnails", relDir)
	base := filepath.Base(fullPath)
	faststartPath := filepath.Join(cacheDir, base+".faststart.mp4")

	if fi, err := os.Stat(faststartPath); err == nil && fi.Size() > 0 {
		return faststartPath
	}

	go func() {
		select {
		case ffmpegSemaphore <- struct{}{}:
			defer func() { <-ffmpegSemaphore }()
		default:
			return
		}

		if fi, err := os.Stat(faststartPath); err == nil && fi.Size() > 0 {
			return
		}

		_ = os.MkdirAll(cacheDir, 0755)
		tempPath := faststartPath + ".tmp"

		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		cmd := exec.CommandContext(ctx, "ffmpeg", "-y", "-i", fullPath, "-c", "copy", "-movflags", "+faststart", tempPath)
		if err := cmd.Run(); err == nil {
			if fi, statErr := os.Stat(tempPath); statErr == nil && fi.Size() > 0 {
				_ = os.Rename(tempPath, faststartPath)
				LogInfo("[FASTSTART] Đã tối ưu MP4 Faststart ở nền thành công: %s", faststartPath)
			}
		}
		_ = os.Remove(tempPath)
	}()

	return fullPath
}

func GetVideoDimensions(fullPath string, modTime time.Time) (int, int) {
	if modTime.IsZero() {
		if fi, err := os.Stat(fullPath); err == nil {
			modTime = fi.ModTime()
		}
	}

	videoMetaMu.RLock()
	if cached, ok := videoMetaCache[fullPath]; ok && cached.ModTime.Equal(modTime) {
		videoMetaMu.RUnlock()
		return cached.Width, cached.Height
	}
	videoMetaMu.RUnlock()

	ffmpegSemaphore <- struct{}{}
	defer func() { <-ffmpegSemaphore }()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", fullPath)
	out, err := cmd.Output()
	if err == nil {
		str := strings.TrimSpace(string(out))
		parts := strings.Split(str, "x")
		if len(parts) == 2 {
			w, errW := strconv.Atoi(parts[0])
			h, errH := strconv.Atoi(parts[1])
			if errW == nil && errH == nil && w > 0 && h > 0 {
				videoMetaMu.Lock()
				videoMetaCache[fullPath] = struct {
					Width   int
					Height  int
					ModTime time.Time
				}{Width: w, Height: h, ModTime: modTime}
				videoMetaMu.Unlock()

				return w, h
			}
		}
	}

	return 0, 0
}

func GenerateVideoThumbnail(srcPath string, thumbPath string) error {
	_ = os.MkdirAll(filepath.Dir(thumbPath), 0755)

	ffmpegSemaphore <- struct{}{}
	defer func() { <-ffmpegSemaphore }()

	if fi, statErr := os.Stat(thumbPath); statErr == nil && fi.Size() > 0 {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffmpeg", "-y", "-ss", "00:00:01", "-i", srcPath, "-vframes", "1", "-q:v", "3", "-vf", "scale='min(400,iw)':-1", thumbPath)
	if err := cmd.Run(); err == nil {
		if fi, statErr := os.Stat(thumbPath); statErr == nil && fi.Size() > 0 {
			LogInfo("[THUMBNAIL] Đã tạo video thumbnail thành công: %s", thumbPath)
			return nil
		}
	}

	ctx0, cancel0 := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel0()

	cmd0 := exec.CommandContext(ctx0, "ffmpeg", "-y", "-ss", "00:00:00", "-i", srcPath, "-vframes", "1", "-q:v", "3", "-vf", "scale='min(400,iw)':-1", thumbPath)
	if err := cmd0.Run(); err == nil {
		if fi, statErr := os.Stat(thumbPath); statErr == nil && fi.Size() > 0 {
			LogInfo("[THUMBNAIL] Đã tạo video thumbnail tại frame 0 thành công: %s", thumbPath)
			return nil
		}
	}

	LogError("[THUMBNAIL] Lỗi tạo video thumbnail cho: %s", srcPath)
	return os.ErrNotExist
}

func GenerateThumbnail(srcPath string, thumbPath string) error {
	_ = os.MkdirAll(filepath.Dir(thumbPath), 0755)

	if IsVideoFile(srcPath) {
		return GenerateVideoThumbnail(srcPath, thumbPath)
	}

	srcImg, err := imaging.Open(srcPath)
	if err != nil {
		LogError("[THUMBNAIL] Không thể mở ảnh: %s (%v)", srcPath, err)
		return err
	}

	thumbImg := imaging.Fit(srcImg, 400, 400, imaging.Lanczos)

	out, err := os.Create(thumbPath)
	if err != nil {
		LogError("[THUMBNAIL] Không thể tạo tệp thumbnail: %s (%v)", thumbPath, err)
		return err
	}
	defer out.Close()

	if err := jpeg.Encode(out, thumbImg, &jpeg.Options{Quality: 75}); err != nil {
		LogError("[THUMBNAIL] Lỗi encode JPEG: %s (%v)", thumbPath, err)
		return err
	}

	LogInfo("[THUMBNAIL] Đã tạo thumbnail ảnh thành công: %s", thumbPath)
	return nil
}

func GetSubFolders(baseDir string, targetRelPath string) ([]*models.FolderItem, error) {
	fullPath := filepath.Join(baseDir, targetRelPath)
	LogInfo("[STORAGE SERVICE] Đọc danh sách thư mục con tại: %s", fullPath)
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		LogError("[STORAGE SERVICE] Lỗi đọc thư mục %s: %v", fullPath, err)
		return nil, err
	}

	var folders []*models.FolderItem
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") || strings.HasPrefix(entry.Name(), "$") {
			continue
		}
		itemRelPath := filepath.ToSlash(filepath.Join(targetRelPath, entry.Name()))
		folders = append(folders, &models.FolderItem{
			Name: entry.Name(),
			Path: itemRelPath,
			Type: "folder",
		})
	}
	LogInfo("[STORAGE SERVICE] Tìm thấy %d thư mục con tại %s", len(folders), targetRelPath)
	return folders, nil
}

func CreateSubFolder(baseDir string, targetRelPath string, newFolderName string) (*models.FolderItem, error) {
	parentPath := filepath.Join(baseDir, targetRelPath)
	fullPath := filepath.Join(parentPath, newFolderName)

	rel, err := filepath.Rel(baseDir, fullPath)
	if err != nil || strings.HasPrefix(rel, "..") {
		LogError("[STORAGE SERVICE] Đường dẫn không hợp lệ để tạo thư mục: %s", fullPath)
		return nil, os.ErrPermission
	}

	if _, err := os.Stat(fullPath); err == nil {
		LogWarning("[STORAGE SERVICE] Thư mục đã tồn tại: %s", fullPath)
		return nil, os.ErrExist
	}

	if err := os.MkdirAll(fullPath, 0755); err != nil {
		LogError("[STORAGE SERVICE] Không thể tạo thư mục %s: %v", fullPath, err)
		return nil, err
	}

	LogInfo("[STORAGE SERVICE] Đã tạo thư mục thành công: %s", rel)
	return &models.FolderItem{
		Name: newFolderName,
		Path: filepath.ToSlash(rel),
		Type: "folder",
	}, nil
}

func RenameSubFolder(baseDir string, targetRelPath string, newName string) (*models.FolderItem, error) {
	oldFullPath := filepath.Join(baseDir, targetRelPath)
	parentDir := filepath.Dir(oldFullPath)
	newFullPath := filepath.Join(parentDir, newName)

	LogInfo("[STORAGE SERVICE] Đổi tên thư mục từ %s -> %s", oldFullPath, newFullPath)
	if err := os.Rename(oldFullPath, newFullPath); err != nil {
		LogError("[STORAGE SERVICE] Lỗi đổi tên thư mục: %v", err)
		return nil, err
	}

	newRelPath, _ := filepath.Rel(baseDir, newFullPath)
	return &models.FolderItem{
		Name: newName,
		Path: filepath.ToSlash(newRelPath),
		Type: "folder",
	}, nil
}

func DeleteSubFolder(baseDir string, targetRelPath string) error {
	fullPath := filepath.Join(baseDir, targetRelPath)
	rel, err := filepath.Rel(baseDir, fullPath)
	if err != nil || strings.HasPrefix(rel, "..") || rel == "." || rel == "" {
		LogError("[STORAGE SERVICE] Từ chối xóa thư mục gốc hoặc ngoài phạm vi: %s", fullPath)
		return os.ErrPermission
	}

	LogInfo("[STORAGE SERVICE] Đang xóa thư mục: %s (Đường dẫn tuyệt đối: %s)", targetRelPath, fullPath)
	if err := os.RemoveAll(fullPath); err != nil {
		LogError("[STORAGE SERVICE] Lỗi xóa thư mục %s: %v", fullPath, err)
		return err
	}

	// Also delete any associated thumbnail cache folders
	_ = os.RemoveAll(filepath.Join(baseDir, ".thumbnails", targetRelPath))
	_ = os.RemoveAll(filepath.Join(baseDir, ".cache_thumbnail", targetRelPath))
	_ = os.RemoveAll(filepath.Join(baseDir, ".thumbnail", targetRelPath))

	LogInfo("[STORAGE SERVICE] Đã xóa thư mục thành công: %s", targetRelPath)
	return nil
}

func DeleteFile(baseDir string, targetRelPath string) error {
	fullPath := filepath.Join(baseDir, targetRelPath)
	rel, err := filepath.Rel(baseDir, fullPath)
	if err != nil || strings.HasPrefix(rel, "..") || rel == "." || rel == "" {
		LogError("[STORAGE SERVICE] Từ chối xóa tệp ngoài phạm vi: %s", fullPath)
		return os.ErrPermission
	}

	LogInfo("[STORAGE SERVICE] Đang xóa tệp: %s (Đường dẫn tuyệt đối: %s)", targetRelPath, fullPath)
	if err := os.Remove(fullPath); err != nil {
		LogError("[STORAGE SERVICE] Lỗi xóa tệp %s: %v", fullPath, err)
		return err
	}

	// Also delete cached thumbnails from all possible thumbnail cache locations
	_ = os.Remove(filepath.Join(baseDir, ".thumbnails", targetRelPath+".jpg"))
	_ = os.Remove(filepath.Join(baseDir, ".cache_thumbnail", targetRelPath+".jpg"))
	_ = os.Remove(filepath.Join(baseDir, ".thumbnail", targetRelPath+".jpg"))

	dirPath := filepath.Dir(fullPath)
	fileName := filepath.Base(fullPath)
	_ = os.Remove(filepath.Join(dirPath, ".cache_thumbnail", fileName+".jpg"))
	_ = os.Remove(filepath.Join(dirPath, ".thumbnail", fileName+".jpg"))
	_ = os.Remove(filepath.Join(dirPath, ".thumbnails", fileName+".jpg"))

	LogInfo("[STORAGE SERVICE] Đã xóa tệp thành công: %s", targetRelPath)
	return nil
}

func GetFolderTree(currentFullPath string, relPath string) ([]*models.FolderNode, error) {
	return GetFolderTreeWithDepth(currentFullPath, relPath, 0, 4)
}

func GetFolderTreeWithDepth(currentFullPath string, relPath string, currentDepth int, maxDepth int) ([]*models.FolderNode, error) {
	if currentDepth >= maxDepth {
		return nil, nil
	}

	entries, err := os.ReadDir(currentFullPath)
	if err != nil {
		return nil, err
	}

	sort.Slice(entries, func(i, j int) bool {
		return strings.ToLower(entries[i].Name()) < strings.ToLower(entries[j].Name())
	})

	var nodes []*models.FolderNode

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		nameLower := strings.ToLower(name)
		if strings.HasPrefix(name, ".") || strings.HasPrefix(name, "$") ||
			nameLower == "node_modules" || nameLower == ".cache" ||
			nameLower == ".thumbnails" || nameLower == ".git" ||
			nameLower == "$recycle.bin" {
			continue
		}

		itemRelPath := filepath.ToSlash(filepath.Join(relPath, name))
		itemFullPath := filepath.Join(currentFullPath, name)

		children, _ := GetFolderTreeWithDepth(itemFullPath, itemRelPath, currentDepth+1, maxDepth)

		nodes = append(nodes, &models.FolderNode{
			Type:     "folder",
			Name:     name,
			Path:     itemRelPath,
			Children: children,
		})
	}

	return nodes, nil
}

func GetPicturesInFolder(baseDir string, targetRelPath string) ([]*models.PictureItem, error) {
	fullPath := filepath.Join(baseDir, targetRelPath)
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return nil, err
	}

	var pictures []*models.PictureItem
	for _, entry := range entries {
		if entry.IsDir() || strings.HasPrefix(entry.Name(), ".") || !IsImageFile(entry.Name()) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		itemRelPath := filepath.ToSlash(filepath.Join(targetRelPath, entry.Name()))
		itemFullPath := filepath.Join(baseDir, itemRelPath)
		w, h := GetImageDimensions(itemFullPath, info.ModTime())

		pictures = append(pictures, &models.PictureItem{
			Type:      "picture",
			Name:      entry.Name(),
			Path:      itemRelPath,
			Size:      info.Size(),
			ModTime:   info.ModTime(),
			Width:     w,
			Height:    h,
			Extension: strings.TrimPrefix(filepath.Ext(entry.Name()), "."),
		})
	}
	LogInfo("[STORAGE SERVICE] Tìm thấy %d ảnh tại %s", len(pictures), targetRelPath)
	return pictures, nil
}

func GetVideosInFolder(baseDir string, targetRelPath string) ([]*models.VideoItem, error) {
	fullPath := filepath.Join(baseDir, targetRelPath)
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return nil, err
	}

	var videos []*models.VideoItem
	for _, entry := range entries {
		if entry.IsDir() || strings.HasPrefix(entry.Name(), ".") || !IsVideoFile(entry.Name()) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		itemRelPath := filepath.ToSlash(filepath.Join(targetRelPath, entry.Name()))
		itemFullPath := filepath.Join(baseDir, itemRelPath)
		w, h := GetVideoDimensions(itemFullPath, info.ModTime())
		resolution := ""
		if w > 0 && h > 0 {
			resolution = fmt.Sprintf("%dx%d", w, h)
		}

		videos = append(videos, &models.VideoItem{
			Type:       "video",
			Name:       entry.Name(),
			Path:       itemRelPath,
			Size:       info.Size(),
			ModTime:    info.ModTime(),
			Width:      w,
			Height:     h,
			Resolution: resolution,
			Extension:  strings.TrimPrefix(filepath.Ext(entry.Name()), "."),
		})
	}
	LogInfo("[STORAGE SERVICE] Tìm thấy %d video tại %s", len(videos), targetRelPath)
	return videos, nil
}

func MoveItem(rootPath string, srcRel string, destRel string) error {
	srcClean := filepath.Clean(srcRel)
	destClean := filepath.Clean(destRel)

	srcFull := filepath.Join(rootPath, srcClean)

	destFolder := filepath.Join(rootPath, destClean)
	if destClean == "." || destClean == "/" || destClean == "" {
		destFolder = filepath.Clean(rootPath)
	}

	fileName := filepath.Base(srcFull)
	destFull := filepath.Join(destFolder, fileName)

	if srcFull == destFull {
		return nil
	}

	LogInfo("[STORAGE SERVICE] Di chuyển phần tử: %s -> %s", srcFull, destFull)
	if err := os.MkdirAll(destFolder, 0755); err != nil {
		LogError("[STORAGE SERVICE] Không thể tạo thư mục đích %s: %v", destFolder, err)
		return err
	}

	if err := os.Rename(srcFull, destFull); err != nil {
		LogError("[STORAGE SERVICE] Lỗi di chuyển %s -> %s: %v", srcFull, destFull, err)
		return err
	}

	LogInfo("[STORAGE SERVICE] Đã di chuyển thành công %s đến %s", srcRel, destRel)
	return nil
}
