package metadata

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type MediaMeta struct {
	Drive     string    `json:"drive"`
	Path      string    `json:"path"`
	Folder    string    `json:"folder"`
	MediaType string    `json:"media_type"`
	Width     int       `json:"width"`
	Height    int       `json:"height"`
	Size      int64     `json:"size"`
	ModTime   int64     `json:"mod_time"`
	HasThumb  bool      `json:"has_thumb"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

var (
	db     *sql.DB
	dbOnce sync.Once
	dbErr  error
	dbMu   sync.RWMutex
)

// GetDBPath returns the absolute path to the SQLite metadata database
func GetDBPath() string {
	if custom := strings.TrimSpace(os.Getenv("METADATA_DB_PATH")); custom != "" {
		return custom
	}
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		home = "/tmp"
	}
	return filepath.Join(home, ".tmp-appview", "thumbnail", "metadata.db")
}

// InitDB initializes the SQLite metadata database with WAL mode and high performance pragmas
func InitDB() error {
	dbOnce.Do(func() {
		dbPath := GetDBPath()
		if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
			dbErr = fmt.Errorf("failed to create metadata db directory: %w", err)
			return
		}

		// Connect using modernc sqlite driver with optimized pragmas
		connStr := fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=busy_timeout(5000)&_pragma=cache_size(-64000)", dbPath)
		conn, err := sql.Open("sqlite", connStr)
		if err != nil {
			dbErr = fmt.Errorf("failed to open metadata sqlite db: %w", err)
			return
		}

		conn.SetMaxOpenConns(10)
		conn.SetMaxIdleConns(5)
		conn.SetConnMaxLifetime(time.Hour)

		schema := `
		CREATE TABLE IF NOT EXISTS media_meta (
			drive TEXT NOT NULL,
			path TEXT NOT NULL,
			folder TEXT NOT NULL,
			media_type TEXT NOT NULL,
			width INTEGER DEFAULT 0,
			height INTEGER DEFAULT 0,
			size INTEGER DEFAULT 0,
			mod_time INTEGER DEFAULT 0,
			has_thumb INTEGER DEFAULT 0,
			created_at INTEGER DEFAULT 0,
			updated_at INTEGER DEFAULT 0,
			PRIMARY KEY (drive, path)
		);
		CREATE INDEX IF NOT EXISTS idx_media_lookup ON media_meta(drive, folder);
		`

		if _, err := conn.Exec(schema); err != nil {
			conn.Close()
			dbErr = fmt.Errorf("failed to initialize metadata schema: %w", err)
			return
		}

		db = conn
	})

	return dbErr
}

// GetFolderMetadata retrieves all cached metadata records for a given drive and folder
func GetFolderMetadata(drive, folder string) (map[string]*MediaMeta, error) {
	if err := InitDB(); err != nil {
		return nil, err
	}

	cleanFolder := filepath.ToSlash(filepath.Clean(folder))
	if cleanFolder == "." {
		cleanFolder = ""
	}

	query := `SELECT drive, path, folder, media_type, width, height, size, mod_time, has_thumb, created_at, updated_at 
	          FROM media_meta WHERE drive = ? AND folder = ?`

	rows, err := db.Query(query, drive, cleanFolder)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]*MediaMeta)
	for rows.Next() {
		var m MediaMeta
		var hasThumbInt int
		var createdUnix, updatedUnix int64

		if err := rows.Scan(
			&m.Drive, &m.Path, &m.Folder, &m.MediaType,
			&m.Width, &m.Height, &m.Size, &m.ModTime,
			&hasThumbInt, &createdUnix, &updatedUnix,
		); err != nil {
			continue
		}

		m.HasThumb = (hasThumbInt == 1)
		m.CreatedAt = time.Unix(createdUnix, 0)
		m.UpdatedAt = time.Unix(updatedUnix, 0)

		result[m.Path] = &m
	}

	return result, rows.Err()
}

// GetItemMetadata retrieves metadata for a single item
func GetItemMetadata(drive, path string) (*MediaMeta, error) {
	if err := InitDB(); err != nil {
		return nil, err
	}

	cleanPath := filepath.ToSlash(filepath.Clean(path))
	query := `SELECT drive, path, folder, media_type, width, height, size, mod_time, has_thumb, created_at, updated_at 
	          FROM media_meta WHERE drive = ? AND path = ?`

	var m MediaMeta
	var hasThumbInt int
	var createdUnix, updatedUnix int64

	err := db.QueryRow(query, drive, cleanPath).Scan(
		&m.Drive, &m.Path, &m.Folder, &m.MediaType,
		&m.Width, &m.Height, &m.Size, &m.ModTime,
		&hasThumbInt, &createdUnix, &updatedUnix,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	m.HasThumb = (hasThumbInt == 1)
	m.CreatedAt = time.Unix(createdUnix, 0)
	m.UpdatedAt = time.Unix(updatedUnix, 0)

	return &m, nil
}

// UpsertMetadata inserts or updates a single media metadata entry
func UpsertMetadata(meta *MediaMeta) error {
	if err := InitDB(); err != nil {
		return err
	}
	if meta == nil || meta.Path == "" {
		return nil
	}

	cleanPath := filepath.ToSlash(filepath.Clean(meta.Path))
	cleanFolder := filepath.ToSlash(filepath.Clean(meta.Folder))
	if cleanFolder == "." {
		cleanFolder = ""
	}

	now := time.Now().Unix()
	hasThumbInt := 0
	if meta.HasThumb {
		hasThumbInt = 1
	}

	query := `
	INSERT INTO media_meta (drive, path, folder, media_type, width, height, size, mod_time, has_thumb, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(drive, path) DO UPDATE SET
		folder = excluded.folder,
		media_type = excluded.media_type,
		width = CASE WHEN excluded.width > 0 THEN excluded.width ELSE media_meta.width END,
		height = CASE WHEN excluded.height > 0 THEN excluded.height ELSE media_meta.height END,
		size = excluded.size,
		mod_time = excluded.mod_time,
		has_thumb = CASE WHEN excluded.has_thumb = 1 THEN 1 ELSE media_meta.has_thumb END,
		updated_at = excluded.updated_at
	`

	_, err := db.Exec(query,
		meta.Drive, cleanPath, cleanFolder, meta.MediaType,
		meta.Width, meta.Height, meta.Size, meta.ModTime,
		hasThumbInt, now, now,
	)
	return err
}

// UpdateThumbStatus updates thumbnail status and dimensions when thumbnail is generated
func UpdateThumbStatus(drive, path string, hasThumb bool, width, height int) error {
	if err := InitDB(); err != nil {
		return err
	}

	cleanPath := filepath.ToSlash(filepath.Clean(path))
	hasThumbInt := 0
	if hasThumb {
		hasThumbInt = 1
	}
	now := time.Now().Unix()

	query := `
	UPDATE media_meta 
	SET has_thumb = ?, 
	    width = CASE WHEN ? > 0 THEN ? ELSE width END, 
	    height = CASE WHEN ? > 0 THEN ? ELSE height END, 
	    updated_at = ?
	WHERE drive = ? AND path = ?
	`

	_, err := db.Exec(query, hasThumbInt, width, width, height, height, now, drive, cleanPath)
	return err
}

// DeleteItemMetadata removes a single item from the metadata database
func DeleteItemMetadata(drive, path string) error {
	if err := InitDB(); err != nil {
		return err
	}
	cleanPath := filepath.ToSlash(filepath.Clean(path))
	_, err := db.Exec(`DELETE FROM media_meta WHERE drive = ? AND path = ?`, drive, cleanPath)
	return err
}

// DeleteFolderMetadata removes all metadata inside a folder
func DeleteFolderMetadata(drive, folder string) error {
	if err := InitDB(); err != nil {
		return err
	}
	cleanFolder := filepath.ToSlash(filepath.Clean(folder))
	if cleanFolder == "." {
		cleanFolder = ""
	}

	_, err := db.Exec(`DELETE FROM media_meta WHERE drive = ? AND (folder = ? OR folder LIKE ?)`,
		drive, cleanFolder, cleanFolder+"/%")
	return err
}

// RenameFolderMetadata updates folder prefixes when a folder is renamed
func RenameFolderMetadata(drive, oldFolder, newFolder string) error {
	if err := InitDB(); err != nil {
		return err
	}
	oldClean := filepath.ToSlash(filepath.Clean(oldFolder))
	newClean := filepath.ToSlash(filepath.Clean(newFolder))
	if oldClean == "." {
		oldClean = ""
	}
	if newClean == "." {
		newClean = ""
	}

	oldPrefix := oldClean + "/"
	newPrefix := newClean + "/"
	now := time.Now().Unix()

	// 1. Direct children whose folder == oldClean
	_, err := db.Exec(`
		UPDATE media_meta 
		SET folder = ?,
		    path = ? || substr(path, ?),
		    updated_at = ?
		WHERE drive = ? AND folder = ?`,
		newClean, newPrefix, len(oldPrefix)+1, now, drive, oldClean)
	if err != nil {
		return err
	}

	// 2. Subfolder children whose folder starts with oldClean + "/"
	_, err = db.Exec(`
		UPDATE media_meta 
		SET folder = ? || substr(folder, ?),
		    path = ? || substr(path, ?),
		    updated_at = ?
		WHERE drive = ? AND folder LIKE ?`,
		newPrefix, len(oldPrefix)+1, newPrefix, len(oldPrefix)+1, now, drive, oldClean+"/%")
	return err
}

// MoveItemMetadata updates the path and folder when an item is moved
func MoveItemMetadata(drive, oldPath, newPath, newFolder string) error {
	if err := InitDB(); err != nil {
		return err
	}
	oldClean := filepath.ToSlash(filepath.Clean(oldPath))
	newClean := filepath.ToSlash(filepath.Clean(newPath))
	folderClean := filepath.ToSlash(filepath.Clean(newFolder))
	if folderClean == "." {
		folderClean = ""
	}

	now := time.Now().Unix()
	query := `UPDATE media_meta SET path = ?, folder = ?, updated_at = ? WHERE drive = ? AND path = ?`
	_, err := db.Exec(query, newClean, folderClean, now, drive, oldClean)
	return err
}
