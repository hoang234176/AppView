# AppView Architecture

Repository navigation index. It documents verified implementation separately from planned work so future sessions can inspect targeted files instead of recursively scanning the repository.

## Repository Overview

**Verified:** AppView is a LAN media-library application. Web (React/Vite) and Mobile (Flutter) browse folders, pictures and videos served by Go Storage. A Python Download service resolves MediaFire URLs and orchestrates archive work through Go Storage. Go Storage owns file paths, download/extract/convert processing, and media streaming.

**Verified:** `backend/coordinator` is an independent Go service for generic worker/task orchestration. Python Download and local Go Storage register over outbound WebSockets as `resolve_download` and `download_file` workers respectively. Coordinator also owns an in-memory two-stage download-job orchestration between them.

## Directory Tree

```text
AppView/
├── frontend/
│   ├── web/                         # React 19 + Vite + Tailwind UI
│   │   └── src/{App.jsx,api,components,styles,utils}
│   └── mobile/                      # Flutter application
│       └── lib/{main.dart,api,models,providers,screens,services,widgets}
├── backend/
│   ├── storage/                     # Go Fiber local media/storage service
│   │   ├── main.go, routes/, controllers/, api/python/, worker/, utils/, configs/
│   │   └── go.mod
│   ├── download/                    # FastAPI URL resolver + task/WebSocket service
│   │   ├── main.py, archive/, services/, models/, worker/, config.py
│   │   └── requirements.txt
│   ├── coordinator/                 # Go generic worker/task coordinator
│   │   ├── cmd/coordinator/main.go
│   │   ├── internal/{config,protocol,worker,task,downloadjob,scheduler,service,websocket,httpapi}
│   │   └── AGENTS.md, ARCHITECTURE.md, docs/PROTOCOL.md
│   └── bruno-api/                   # API collection files
├── README.md
└── ARCHITECTURE.md
```

## Frontend Architecture

### Web

Path: `frontend/web/src/main.jsx`  
Responsibility: React root and StrictMode entry.

Path: `frontend/web/src/App.jsx`  
Responsibility: top-level UI state, folder/media loading, Coordinator download-job polling, and modal composition.
Usually changed with: `api/folderApi.js`, `api/downloadApi.js`, relevant component.

Path: `frontend/web/src/api/axiosConfig.js`  
Responsibility: Storage and Python Download base URL derivation from browser localStorage, with public Vite environment fallbacks.  
Inspect when: LAN host, ports, root folder configuration, WebSocket base URL, or deployment URLs change.

Path: `frontend/web/src/api/folderApi.js`, `downloadApi.js`  
Responsibility: Storage REST calls; Coordinator parent download-job REST calls. Legacy Python Download REST/WebSocket helpers remain for compatibility only.
Inspect when: backend response or endpoint contract changes.

Path: `frontend/web/src/components/VideoPlayerModal.jsx`, `LightboxModal.jsx`  
Responsibility: video and image viewing UI.  
Inspect when: playback, controls, rotation, fullscreen, or image viewing changes.

Path: `frontend/web/src/components/DownloadPanelModal.jsx`, `DownloadSnackbar.jsx`, `DownloadMediafireModal.jsx`  
Responsibility: download creation, task manager UI, and active-task display.  
Inspect when: Download task stages, status fields, or download UI behavior changes.

Path: `frontend/web/src/styles/index.css`  
Responsibility: Tahoe-like styling, UI transitions, spinner and snackbar animation classes.

### Mobile

Path: `frontend/mobile/lib/main.dart`  
Responsibility: Flutter entry, provider construction, theme and home screen startup.

Path: `frontend/mobile/lib/api/api_config.dart`  
Responsibility: shared-preference backed Storage configuration plus public `--dart-define` Download/Coordinator URL configuration.
Usually changed with: `widgets/config_api_dialog.dart`.

Path: `frontend/mobile/lib/providers/app_state_provider.dart`, `download_provider.dart`  
Responsibility: application navigation/cache state and retained/polled Coordinator DownloadJob state respectively.

Path: `frontend/mobile/lib/services/download_websocket_service.dart`  
Responsibility: reconnecting client for Python Download WebSocket.

Path: `frontend/mobile/lib/screens/home_screen.dart`, `download_screen.dart`, `video_player_screen.dart`, `lightbox_screen.dart`  
Responsibility: primary browsing, task management, video and image views.

Path: `frontend/mobile/lib/api/{folder_api,download_api,cache_api}.dart`  
Responsibility: typed Storage/Download HTTP boundaries.

## Backend Architecture

### `backend/storage`

**Verified language/server:** Go, Fiber, entry point `backend/storage/main.go`.

It owns local media filesystem operations, folder CRUD, thumbnails/media streaming, archive job lifecycle, SSD workspace download/extract/convert, final result transfer, and video compatibility conversion.

Important files:

- `routes/routes.go`: verified `/api/v1` route map.
- `controllers/storage_controller.go`: folders/files/move/ping handlers.
- `controllers/picture_controller.go`, `video_controller.go`: image and video serving/streaming.
- `controllers/archive_job_controller.go`: archive start/status/list/retry/cancel/delete HTTP boundary.
- `controllers/convert_controller.go`: standalone conversion job API.
- `api/python/archive_task.go`: Go-owned archive job, SSD workspace and final HDD commit flow.
- `api/python/convert_task.go`: incompatible-video scan, ffmpeg operation and global one-archive convert queue.
- `utils/storage_utils.go`: filesystem listing, thumbnail, path and media helpers.
- `configs/config.go`: Storage root and SSD workspace configuration.
- `configs/env.go`: optional service-local `.env` loader; OS/process values retain precedence.
- `worker/client.go`, `worker/handler.go`, `worker/protocol.go`: outbound Coordinator lifecycle and the `download_file` adapter. It reuses `pythonapi.StartArchiveJob` and archive snapshots; it does not implement a separate downloader or filesystem pipeline.
- `events/filesystem.go`: lightweight structural folder invalidations, emitted after successful mutations through the existing Storage worker connection.
- `utils/logger.go`: JSON-line structured logging controlled by `LOG_LEVEL` (default `INFO`); worker and media-path events omit passwords, payloads and signed URLs.
- Media routes use the original escaped wildcard and decode URL path segments exactly once before filesystem resolution. They stream the verified file handle rather than re-parsing a filesystem filename as a URI, preserving `%`, `#`, Unicode and emoji names.
- Folder listings do not generate thumbnails. Thumbnails are lazy at `/api/v1/thumbnails/*`, while original picture/video routes remain independent of thumbnail cache state.

### `backend/download`

**Verified language/server:** Python FastAPI, entry point `backend/download/main.py`.

It owns URL resolution, Download task presentation state, frontend WebSocket broadcasts, and orchestration calls to Go Storage. It deliberately does not own filesystem paths or archive/file mutations.

Important files:

- `main.py`: lifespan recovery, REST task API and `/api/v1/download/ws` WebSocket.
- `archive/mediafire.py`: MediaFire page resolver.
- `archive/service.py`: resolves URL then drives Go archive job monitoring/recovery.
- `archive/go_archive_client.py`: only HTTP boundary from Python to Go Storage archive API.
- `services/task_manager.py`, `progress_manager.py`, `websocket_manager.py`: in-memory task lifecycle, summary and broadcasts.
- `models/download_task.py`: Download task and stage contract.
- `worker/client.py`, `worker/handler.py`, `worker/protocol.py`: outbound Coordinator WebSocket lifecycle, `resolve_download` task adaptation, and protocol helpers. The handler reuses `archive_service.resolver` and does not start archive jobs.
- `config.py`: service-local `.env` loader (OS values win), `GO_STORAGE_BASE_URL`, `PYTHON_DOWNLOAD_PORT`, `PYTHON_DOWNLOAD_HOST`, `COORDINATOR_WS_URL`, `COORDINATOR_WORKER_ID`. Render's `PORT` is used when `PYTHON_DOWNLOAD_PORT` is absent.
- `logger.py`: JSON-line structured logger controlled by `LOG_LEVEL` (default `INFO`); HTTP query strings and worker payload secrets are not logged.

### `backend/coordinator`

**Verified:** implemented Go service. It owns generic worker WebSockets, capability routing, in-memory task lifecycle, disconnect requeue behavior, generic task status, and in-memory two-stage download jobs. Read `backend/coordinator/ARCHITECTURE.md` for its detailed Change Map.

**Verified workers:** Python Download resolves URLs and Go Storage processes existing archive jobs through their independent outbound Coordinator adapters. The Coordinator creates a `resolve_download` child, then one `download_file` child only after a successful resolve result. The current direct Python → Go HTTP archive flow remains unchanged.

## Cross-Service Communication

### Current, verified

```text
Web / Mobile
  ├── HTTP Storage API :8080 ──> Go Storage
  └── HTTP Coordinator API `/api/v1/download` ──> Coordinator
       └── resolve_download ──> Python Download worker
       └── download_file ──> Go Storage worker
```

Python calls Go's archive APIs; Go performs all archive filesystem work. Python persists no storage paths. On Python restart it queries Go archive job snapshots and reconnects its monitoring so frontend task state can be restored.

### Coordinator resolution worker, verified

```text
Client ── HTTP task API ──> Coordinator
Coordinator ── outbound worker WebSocket ──> Python Download
                                                └── existing MediaFire resolver
```

Worker integration is additive. The normal Web/Mobile submission path uses the parent Coordinator download job; legacy Python endpoints remain available for compatibility-only controls.

### Coordinator Storage worker, verified

```text
Coordinator ── outbound worker WebSocket ──> local Go Storage
                                                └── existing StartArchiveJob
                                                    download → extract → scan → convert → commit
```

Storage advertises only `download_file`. Its payload is `{ "url", "filename", "destination", "password?" }`; it expects the archive-oriented work already implemented by `StartArchiveJob`. It returns opaque job metadata/progress and never sends file bytes or local filesystem paths on the WebSocket.

### Coordinator download-job pipeline, verified

```text
POST /api/v1/download
→ parent DownloadJob (resolving)
→ resolve_download child task → Python Download
→ result.downloadUrl + result.filename
→ one download_file child task (downloading) → Go Storage
→ parent completed / failed
```

`DownloadJob` has an ID distinct from both child task IDs. Web and Mobile retain the accepted parent ID in runtime state, poll `GET /api/v1/download/{id}` every second, and stop at `completed` or `failed`. Parent state and child mapping are in memory; a Coordinator restart loses active jobs/tasks. The legacy HTTP pipeline remains available for compatibility.

## HTTP API Map

| Service | Method | Path | Handler area | Purpose |
|---|---|---|---|---|
| Storage | GET/POST/PUT/DELETE | `/api/v1/folder`, `/file`, `/item/move` | `controllers/storage_controller.go` | Folder/file management. |
| Storage | GET | `/api/v1/pictures/*`, `/thumbnails/*`, `/videos/*` | picture/video controllers | Serve media and streams. |
| Storage | POST/GET | `/api/v1/jobs/convert...` | `convert_controller.go` | Convert job start/status. |
| Storage | POST/GET/DELETE | `/api/v1/jobs/archive...` | `archive_job_controller.go` | Go archive job lifecycle. |
| Download | POST | `/api/v1/download/archive` | `main.py` | Create MediaFire archive task. |
| Download | GET/POST/DELETE | `/api/v1/download/tasks...`, `/summary` | `main.py` | Task state, retry/password/cancel/delete, summary. |
| Download | WebSocket | `/api/v1/download/ws` | `main.py` | Frontend real-time task events. |
| Coordinator | POST/GET | `/api/v1/tasks`, `/api/v1/tasks/{id}` | `internal/httpapi` | Generic capability task lifecycle. |
| Coordinator | POST/GET | `/api/v1/download`, `/api/v1/download/{id}` | `internal/httpapi/download_handler.go` | Parent two-stage resolve-to-Storage download lifecycle. |
| Coordinator | GET | `/health` | `internal/httpapi` | Health and worker count. |
| Coordinator | WebSocket | `/ws/workers` by default | `internal/websocket` | Worker registration and task protocol. |
| Coordinator | WebSocket | `/ws/events` | `internal/realtime` | Best-effort frontend filesystem invalidation. |

## WebSocket Map

| Endpoint | Direction | Verified behavior |
|---|---|---|
| Python Download `/api/v1/download/ws` | Frontend ↔ Python | Python broadcasts task creation, stage, progress, password and summary events; Web/Mobile reconnect clients consume them. |
| Coordinator `/ws/workers` | Worker ↔ Coordinator | Workers register capabilities, heartbeat, accept/progress/complete/fail tasks; coordinator assigns compatible idle workers. |
| Coordinator `/ws/events` | Coordinator → Frontend | Bounded, best-effort structural-folder invalidations. Clients refetch canonical state after reconnect. |

## Task Flow

### Current archive download

```text
Frontend submits MediaFire URL
→ Python creates DownloadTask and resolves direct URL
→ Python starts Go archive job
→ Go downloads/extracts/scans/converts in SSD workspace
→ Go commits final folder to Storage destination
→ Python polls Go snapshots and broadcasts frontend state
```

### Coordinator task flow

```text
POST /api/v1/tasks { action, payload }
→ queued
→ first compatible idle worker gets task.assign
→ task.accepted / task.progress
→ task.completed or task.failed
```

### Coordinator download-job flow

```text
URL + optional filename/destination/password
→ parent queued/resolving with resolveTaskId
→ Python result.downloadUrl/result.filename
→ parent downloading with storageTaskId
→ Storage archive job result/progress
→ parent completed, or failed with failureStage resolve/storage
```

## Environment and Configuration

Do not place secret values here.

- Root `.gitignore` ignores `.env` and `.env.*` at every depth, but explicitly allows `.env.example`. Real `.env` files are local-only and never overwrite process/Render variables.
- Coordinator: `backend/coordinator/.env.example` documents `COORDINATOR_HTTP_ADDR`, `COORDINATOR_WORKER_WS_PATH`, `COORDINATOR_HEARTBEAT_TIMEOUT`, `COORDINATOR_HEARTBEAT_CHECK_INTERVAL`, and `COORDINATOR_DEFAULT_MAX_ATTEMPTS`. Its optional local `.env` is loaded only for unset variables. On Render, `PORT` is supported and binds `0.0.0.0:<PORT>` unless `COORDINATOR_HTTP_ADDR` is explicitly supplied.
- Download: `backend/download/.env.example` documents `GO_STORAGE_BASE_URL`, `PYTHON_DOWNLOAD_PORT`, `PYTHON_DOWNLOAD_HOST`, `COORDINATOR_WS_URL` (local default `ws://localhost:8090/ws/workers`), and `COORDINATOR_WORKER_ID`. Its outbound worker has finite connect/ping timeouts and bounded reconnect backoff, so a sleeping Coordinator does not stop FastAPI.
- Storage: `backend/storage/.env.example` documents `COORDINATOR_WS_URL` and `COORDINATOR_WORKER_ID`; `configs.LoadEnvironment()` loads its optional local `.env` without overriding OS values. The worker has finite dial timeouts, heartbeat, serialized writes and bounded reconnect backoff. Archive/file processing behavior is reused unchanged.
- Web: `frontend/web/.env.example` includes the public `VITE_COORDINATOR_API_BASE_URL` used by normal download submission/polling, alongside legacy Download variables. Browser localStorage keys beginning `appview_server_...` still configure Storage.
- Mobile: `ApiConfig` reads `APPVIEW_COORDINATOR_API_BASE_URL` from public compile-time `--dart-define` for normal download submission/polling. Legacy Download values remain available only for compatibility code.

## Shared Contracts

- **Download task:** defined by Python `models/download_task.py`; consumed by Web `downloadApi.js`/`App.jsx` and Mobile `api/download_api.dart`/`download_provider.dart`.
- **Go archive snapshot:** defined in Go `api/python/archive_task.go`; consumed by Python `archive/go_archive_client.py` and `archive/service.py`.
- **Coordinator worker envelope:** source of truth is `backend/coordinator/internal/protocol/message.go`, documented by `backend/coordinator/docs/PROTOCOL.md`.
- **Python Download coordinator action:** `resolve_download` accepts payload `{ "url": "https://..." }` and returns resolved URL, filename, extension, and optional estimated size in the opaque Coordinator result.
- **Storage coordinator action:** `download_file` accepts an archive-oriented direct URL payload with `url`, `filename`, relative `destination`, and optional `password`. It delegates to `pythonapi.StartArchiveJob`, sends snapshot-derived progress, and returns only job/filename/conversion metadata.
- **Coordinator DownloadJob:** created by `POST /api/v1/download`; owns `resolveTaskId`, `storageTaskId`, current state/progress/result/error and a private password. The resolver result fields used for transition are exactly `downloadUrl` and `filename`.
- **Storage folder/media response:** produced by Storage controllers; consumed by Web/Mobile folder APIs and models.

## Change Map

### Storage filesystem, archive, convert, or compatibility behavior

Read first: `backend/storage/api/python/archive_task.go`, `api/python/convert_task.go`, relevant controller, and `configs/config.go`. Do not start in frontend unless returned contract changes.

### Storage Coordinator worker adapter

Read first: `backend/storage/worker/{client,handler,protocol}.go`, `configs/env.go`, `api/python/archive_task.go`, and `backend/coordinator/docs/PROTOCOL.md`. Register only `download_file`; reuse existing archive jobs and do not chain resolver tasks here.

### Download URL resolver or task orchestration

Read first: `backend/download/archive/service.py`, `archive/go_archive_client.py`, relevant resolver, `services/task_manager.py`, `models/download_task.py`.

### Download Coordinator worker adapter

Read first: `backend/download/worker/{client,handler,protocol}.py`, `archive/service.py`, `archive/contracts.py`, and `backend/coordinator/docs/PROTOCOL.md`. The adapter resolves only; do not route Go archive work through Coordinator yet.

### Environment or deployment connectivity

Read first: root `.gitignore`, relevant service `.env.example`, Coordinator `internal/config/config.go`, Download `config.py`/`worker/client.py`, and frontend endpoint configuration. Keep production hostnames out of source and use only public frontend configuration values.

### Backend logging or media serving paths

Read first: each service logger, entrypoint and relevant worker/handler. Storage media routes must begin from `PathOriginal()`, decode each path segment once with URL-path semantics, retain traversal checks, and stream the resolved file handle without URL re-parsing.

### Download WebSocket contract/UI

Read first: Python `services/websocket_manager.py`, `services/task_manager.py`; then Web `api/downloadApi.js`/`App.jsx` or Mobile `services/download_websocket_service.dart`/`providers/download_provider.dart` and relevant screen.

### Web media playback

Read first: `frontend/web/src/components/VideoPlayerModal.jsx`, `api/folderApi.js`, `utils/formatters.js`.

### Mobile media playback

Read first: `frontend/mobile/lib/screens/video_player_screen.dart`, `api/folder_api.dart`, `utils/formatters.dart`.

### Coordinator protocol/routing/lifecycle

Read `backend/coordinator/AGENTS.md` then its `ARCHITECTURE.md`; follow the coordinator Change Map.

### Coordinator download-job orchestration

Read first: `backend/coordinator/internal/downloadjob/{model,registry}.go`, `internal/service/coordinator.go`, `internal/httpapi/download_handler.go`, and both worker contract handlers. Preserve generic `/api/v1/tasks`; do not add worker protocol messages or directly call Storage HTTP.

## AI Agent Navigation Rules

1. Read this file before modifying code.
2. Use Change Map to choose initial files.
3. Search symbols before expanding scope.
4. Avoid generated/build/dependency directories.
5. Keep planned coordinator integration distinct from current Python → Go behavior.
6. Update this document for new important services, routes, protocols or responsibility changes.
