# AppView Storage Service

`backend/storage` is the local media management, processing, and streaming engine built with **Go Fiber** (`:8080`).

---

## 🎯 Key Responsibilities

1. **Local Filesystem & Media Ownership**:
   - Sole owner of physical media files, storage directories, and disk operations on the host machine.
   - Provides folder tree browsing, creation, renaming, and batch moving/deleting.
2. **Media Streaming & Thumbnail Generation**:
   - High-performance, Range-supported video streaming (`/api/v1/videos/*`).
   - Picture serving (`/api/v1/pictures/*`) and lazy, cached thumbnail generation (`/api/v1/thumbnail/*`).
   - Unicode, emoji, `%`, and `#` safe path handling without double-URL decoding.
3. **Download Execution (`download_file` Worker)**:
   - Registers as an outbound WebSocket worker with Coordinator for the `download_file` capability.
   - Executes multi-stage archive processing (download → extract → scan → convert → commit) in a temporary SSD workspace.
   - Direct download and muxing of social media video/photo assets (YouTube, Facebook, TikTok, Instagram) using assigned unified filenames.
4. **Persistent Cookie File Store**:
   - Exclusively manages disk storage for authentication cookies under `~/.tmp-appview/cookies/<platform>.txt`.
   - Handles `cookie.get` and `cookie.save` RPC requests triggered by Coordinator.
5. **Video Compatibility & Conversion**:
   - Standalone and in-pipeline video format conversion using `ffmpeg` (e.g. converting non-standard codecs to web/mobile compatible MP4/WebM).

---

## 🔌 HTTP API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/folders` | Browse folder structure and media items |
| `POST` | `/api/v1/folders` | Create a new directory |
| `POST` | `/api/v1/folders/rename` | Rename an existing directory |
| `POST` | `/api/v1/folders/delete` | Delete a directory |
| `GET` | `/api/v1/videos/*` | Stream video file |
| `GET` | `/api/v1/pictures/*` | Serve image file |
| `GET` | `/api/v1/thumbnail/*` | Get lazy-cached media thumbnail |
| `POST` | `/api/v1/batch/move` | Move multiple files or folders |
| `POST` | `/api/v1/batch/delete` | Delete multiple files or folders |
| `POST` | `/api/v1/jobs/convert` | Submit a background video conversion job |
| `GET` | `/api/v1/jobs/{job_id}` | Check video conversion job status |
| `POST` | `/api/v1/jobs/archive...`| Manage archive job lifecycle & retries |

---

## ⚙️ Configuration & Environment

Settings can be specified via environment variables or a local `.env` file:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port for the Go Fiber HTTP server |
| `STORAGE_ROOT` | *(User home/Desktop)* | Root filesystem path to serve media files from |
| `APPVIEW_STATE_DIR` | `~/.tmp-appview` | Directory for staging downloads, job states, and cookies |
| `COORDINATOR_WS_URL` | `ws://localhost:8090/ws/workers` | Coordinator WebSocket worker endpoint |
| `COORDINATOR_WORKER_ID`| `storage-worker-1` | Unique ID when registering to Coordinator |
| `LOG_LEVEL` | `INFO` | JSON structured log level (`DEBUG`, `INFO`, `WARN`, `ERROR`) |

---

## 🚀 Getting Started

### Prerequisites
- Go 1.22 or higher
- `ffmpeg` installed and available in system `PATH` (for video conversion & audio muxing)

### Run Service
```bash
# Run Storage service
go run main.go

# Run tests
go test ./...
```
