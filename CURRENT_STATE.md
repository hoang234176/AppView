# Current State

## Current goal

Improve backend observability and verify the end-to-end Coordinator download path with real workers.

## Completed

- Added `backend/download/worker` with a reconnecting outbound WebSocket client.
- Registers `resolve_download`, sends protocol-compatible accepted/completed/failed events, and sends heartbeats.
- Reuses the existing `archive_service.resolver`; no provider logic was copied and no Go archive job starts from Coordinator work.
- Starts/stops the worker from the FastAPI lifespan while preserving all existing Download routes and Go Storage calls.
- Added focused handler tests.
- Added root `.gitignore` protection for real `.env` files and safe service/frontend `.env.example` templates.
- Added safe localhost `.env` files for Coordinator, Python Download, and Vite Web; each is ignored by Git and process/Render variables take precedence.
- Coordinator now supports Render `PORT` and binds `0.0.0.0:<PORT>` when no explicit address is supplied.
- Python Download uses `PORT` when `PYTHON_DOWNLOAD_PORT` is absent; its existing finite-timeout, bounded-backoff worker behavior remains intact.
- Web URL fallbacks now use public Vite variables; Flutter URL fallbacks now use public `--dart-define` values while saved endpoints still win.
- Added `backend/storage/worker` as an outbound, reconnecting Coordinator adapter.
- Storage registers only `download_file`, validates the archive-oriented direct-URL payload, sends accepted/progress/completed/failed, and re-registers after reconnect.
- The adapter reuses `pythonapi.StartArchiveJob` plus existing thread-safe archive snapshots. It sends metadata only and never file bytes/local paths.
- Worker cancellation/disconnect stops monitoring only; it deliberately does not cancel an existing local archive job, so Coordinator can requeue/reattach safely.
- Storage startup now loads optional local `.env`, launches the worker alongside Fiber, and cancels worker work on graceful process shutdown without removing HTTP routes.
- Added Coordinator parent `DownloadJob` registry with distinct resolve and Storage child task IDs.
- Added `POST /api/v1/download`, `GET /api/v1/download`, and `GET /api/v1/download/{id}` without changing generic `/api/v1/tasks`.
- Storage now owns a versioned durable archive-job snapshot under `APPVIEW_STATE_DIR/downloads/jobs` (defaulting through `os.UserHomeDir()` to `~/.tmp-appview`). It restores history at startup, marks interrupted active work as resumable rather than silently losing it, retains partial/archive/extracted artifacts, and exposes per-job `POST /api/v1/jobs/archive/:job_id/retry`. Passwords are never persisted.
- Storage now synchronizes its password-free durable archive snapshots through the existing `download_file` worker connection using `storage.history`. Coordinator merges by stable ID and worker identity, exposes recovered records through `GET /api/v1/download`, and broadcasts bounded `download_event` invalidations to every `/ws/events` subscriber. Coordinator never accesses Storage state files.
- Web and Mobile now treat `GET /api/v1/download` as canonical download history. Their existing app-level Coordinator event connection treats `download_event` as a coalesced invalidation and refetches history on event/reconnect; per-job Storage retry and password-only extraction controls do not retain passwords locally.
- Password-required is a recoverable canonical download state. Web and Mobile keep it in Downloading, show a per-job masked retry input, and derive their header warning badge from canonical attention states. Retry/extract requests now go through Coordinator, which pins the short-lived `download_file` control task to the Storage worker that owns the persisted archive.
- Canonical download actions now include cooperative cancel through Coordinator. Storage persists cancelled jobs without deleting archive/extracted artifacts. After a successful SSD-workspace commit, Storage emits one public `folder_created` event for the final relative destination, so tree/current-folder refetches happen without exposing temporary paths.
- Successful Python resolver result maps exact fields `downloadUrl` and `filename` into one Storage payload `{url, filename, destination, password}`.
- Parent progress mirrors child progress; child failure maps to `failureStage` `resolve` or `storage`. Requeue retains the parent current stage, while terminal disconnect failure is synchronized to the parent.
- Storage child creation is atomically gated by parent registry state, preventing duplicate `download_file` tasks.
- Web now submits one parent job to `POST /api/v1/download`, retains its `id`, and polls `GET /api/v1/download/{id}` every second until terminal state. It maps only Coordinator-provided progress fields into the existing task UI and does not use the Python WebSocket for new submissions.
- Mobile `DownloadProvider` now has equivalent runtime parent-job retention/polling with disposal cleanup and no post-dispose notifications. The add-download dialog submits through the provider instead of the legacy Python `/archive` route.
- Added JSON-line structured logs in Coordinator, Download and Storage. `LOG_LEVEL` defaults to `INFO`; logging avoids passwords, task payloads, signed URL queries and credentials.
- Storage media routes now read the original escaped route wildcard, decode each URL path segment exactly once, retain traversal checks, and stream the verified file handle. Focused tests cover spaces, `#`, `%`, `@`, Unicode, emoji, full-width punctuation, literal `%20`, video/thumbnail routes and traversal rejection.
- Storage now emits post-success `folder_created`, `folder_deleted`, `folder_moved`, and `folder_renamed` invalidations through its existing Coordinator worker connection. Coordinator relays bounded best-effort envelopes to frontend subscribers at `/ws/events`; clients must refetch after reconnect.
- Thumbnail investigation confirmed that folder listing does not generate thumbnails and original picture/video endpoints do not wait for thumbnail cache generation. Focused regression tests cover uncached originals and listing behavior.
- Web `App.jsx` and Mobile `AppStateProvider` now each own one reconnecting Coordinator `/ws/events` connection. Filesystem events are treated as invalidations and coalesced into canonical tree/current-folder refetches; reconnect performs the same refetch because events are non-durable.
- Image viewers now retain the canonical picture snapshot supplied at open time, so unrelated folder refreshes or thumbnail presentation work cannot replace/block an already-open viewer.

## In progress

- No implementation work in progress.

## Relevant files

- `backend/download/worker/client.py`
- `backend/download/worker/handler.py`
- `backend/download/worker/protocol.py`
- `backend/download/main.py`
- `backend/download/config.py`
- `backend/download/tests/test_worker_handler.py`
- `.gitignore`, `backend/coordinator/.env.example`, `backend/download/.env.example`, `backend/storage/.env.example`, `frontend/web/.env.example`
- `backend/coordinator/internal/config/config.go`
- `frontend/web/src/api/axiosConfig.js`
- `frontend/mobile/lib/api/api_config.dart`
- `ARCHITECTURE.md`
- `backend/storage/main.go`
- `backend/storage/configs/env.go`
- `backend/storage/worker/{client,handler,protocol}.go`
- `backend/storage/worker/handler_test.go`
- `backend/storage/.env.example`
- `backend/coordinator/internal/downloadjob/{model,registry}.go`
- `backend/coordinator/internal/service/coordinator.go`
- `backend/coordinator/internal/service/download_orchestration_test.go`
- `backend/coordinator/internal/httpapi/download_handler.go`
- `backend/coordinator/internal/httpapi/{server.go}`
- `backend/{coordinator,download,storage}/.env.example` and service logger files
- `backend/storage/utils/{media_path,storage_utils,logger}.go`, `controllers/media_path_test.go`

## Important decisions

- Coordinator task `resolve_download` performs URL resolution only and returns opaque metadata; it does not enter the existing archive download pipeline.
- Coordinator outages use bounded reconnect backoff and cannot crash or block the FastAPI HTTP service.
- Coordinator filesystem events are invalidations only; there is no durable replay. Phase 2 Web/Mobile clients must reconnect and refetch their folder/tree state.
- Coordinator event URLs are derived from the existing Coordinator HTTP base by removing its `/api/v1` suffix and using `ws`/`wss` with `/ws/events`.
- Real `.env` files are optional local conveniences; OS/Render values override them. Production hostnames are intentionally not stored in source.
- `download_file` currently means the existing archive workflow, not a newly invented raw-file downloader. It requires `url` and `filename`; `destination` is relative and optional (Storage root when empty).
- Orchestration is deliberately only a two-stage download job, not a generic DAG/workflow engine. Coordinator does not call Storage HTTP or inspect local Storage paths.

## Protocol/API assumptions

- Coordinator endpoint is `COORDINATOR_WS_URL`, defaulting to `ws://localhost:8090/ws/workers`; production may set `wss://...`.
- `COORDINATOR_WORKER_ID` is configurable and otherwise hostname-derived.
- Shared message names and envelope shape remain those in `backend/coordinator/docs/PROTOCOL.md`.
- Vite public variables: `VITE_STORAGE_API_BASE_URL`, `VITE_DOWNLOAD_API_BASE_URL`, `VITE_DOWNLOAD_WS_URL`, `VITE_COORDINATOR_API_BASE_URL`.
- Flutter public compile-time variables: `APPVIEW_STORAGE_API_BASE_URL`, `APPVIEW_DOWNLOAD_API_BASE_URL`, `APPVIEW_DOWNLOAD_WS_URL`, `APPVIEW_COORDINATOR_API_BASE_URL`.
- Storage worker uses `COORDINATOR_WS_URL` and `COORDINATOR_WORKER_ID`, defaulting to local Coordinator URL and a hostname-derived ID when unset.
- Download-job API accepts `url` (required), optional `filename`, optional relative `destination`, and optional `password`; password is forwarded only to Storage payload and omitted from parent JSON.

## Tests run

- `cd backend/download && python3 -m unittest discover -s tests -v`
- `cd backend/download && python3 -m compileall -q .`
- Python config baseline and OS override checks: localhost `.env` values resolve, while supplied `PYTHON_DOWNLOAD_PORT` and `COORDINATOR_WS_URL` win.
- `cd backend/coordinator && go test ./... && go vet ./...`
- Persistent archive-state, restart-to-`interrupted`, state-directory override, and independent video validation/resolution-class tests: `cd backend/storage && go test ./... && go vet ./...`.
- `cd frontend/web && npm run build`
- `cd frontend/mobile && dart analyze`
- Ignore-policy check: local `.env` files are ignored, `.env.example` files are not ignored, and no local `.env` is tracked.
- `cd backend/storage && gofmt -w ... && go test ./... && go vet ./...`
- Manual local verification: Storage connected to Coordinator on `:18090` as `storage-integration-test`; a `download_file` task with an empty payload was capability-routed and became `failed` with `INVALID_PAYLOAD`, without starting a download.
- `cd backend/coordinator && gofmt -w ... && go test ./... && go vet ./...`
- Manual three-service verification: Coordinator on `:18090` saw two workers; `POST /api/v1/download` created a resolving parent and an intentionally invalid URL ended as parent `failed` with `failureStage: resolve`, without Storage child creation.
- Frontend migration verification: `cd frontend/web && npm run build` and `cd frontend/mobile && flutter analyze` pass after switching normal client submission/status to the Coordinator parent-job API.

## Known issues

- The Coordinator task registry is in memory, so task status does not survive a Coordinator restart by design.
- Flutter configuration is compile-time (`--dart-define`) by design; it does not read `.env` files at runtime.
- `download_file` is currently tied to the archive-oriented existing Storage API; the Coordinator now chains resolved URL/filename into it, but broader raw-file/provider pipelines remain future work.

## Next step

Run a non-destructive three-service E2E download with Coordinator, Python Download and Storage workers to verify structured trace correlation in a real environment.
