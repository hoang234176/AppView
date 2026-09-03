# Current State

## Current goal

Integrate Go Storage as an outbound Coordinator worker while preserving the direct Python → Storage HTTP archive workflow.

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

## Important decisions

- Coordinator task `resolve_download` performs URL resolution only and returns opaque metadata; it does not enter the existing archive download pipeline.
- Coordinator outages use bounded reconnect backoff and cannot crash or block the FastAPI HTTP service.
- Go Storage is out of scope and unchanged.
- Real `.env` files are optional local conveniences; OS/Render values override them. Production hostnames are intentionally not stored in source.
- `download_file` currently means the existing archive workflow, not a newly invented raw-file downloader. It requires `url` and `filename`; `destination` is relative and optional (Storage root when empty).

## Protocol/API assumptions

- Coordinator endpoint is `COORDINATOR_WS_URL`, defaulting to `ws://localhost:8090/ws/workers`; production may set `wss://...`.
- `COORDINATOR_WORKER_ID` is configurable and otherwise hostname-derived.
- Shared message names and envelope shape remain those in `backend/coordinator/docs/PROTOCOL.md`.
- Vite public variables: `VITE_STORAGE_API_BASE_URL`, `VITE_DOWNLOAD_API_BASE_URL`, `VITE_DOWNLOAD_WS_URL`.
- Flutter public compile-time variables: `APPVIEW_STORAGE_API_BASE_URL`, `APPVIEW_DOWNLOAD_API_BASE_URL`, `APPVIEW_DOWNLOAD_WS_URL`.
- Storage worker uses `COORDINATOR_WS_URL` and `COORDINATOR_WORKER_ID`, defaulting to local Coordinator URL and a hostname-derived ID when unset.

## Tests run

- `cd backend/download && python3 -m unittest discover -s tests -v`
- `cd backend/download && python3 -m compileall -q .`
- Python config baseline and OS override checks: localhost `.env` values resolve, while supplied `PYTHON_DOWNLOAD_PORT` and `COORDINATOR_WS_URL` win.
- `cd backend/coordinator && go test ./... && go vet ./...`
- `cd frontend/web && npm run build`
- `cd frontend/mobile && dart analyze`
- Ignore-policy check: local `.env` files are ignored, `.env.example` files are not ignored, and no local `.env` is tracked.
- `cd backend/storage && gofmt -w ... && go test ./... && go vet ./...`
- Manual local verification: Storage connected to Coordinator on `:18090` as `storage-integration-test`; a `download_file` task with an empty payload was capability-routed and became `failed` with `INVALID_PAYLOAD`, without starting a download.

## Known issues

- The Coordinator task registry is in memory, so task status does not survive a Coordinator restart by design.
- Flutter configuration is compile-time (`--dart-define`) by design; it does not read `.env` files at runtime.
- `download_file` is currently tied to the archive-oriented existing Storage API. A future pipeline must pass resolver metadata and an intended relative destination; automatic `resolve_download → download_file` chaining does not exist yet.

## Next step

Implement Coordinator orchestration/pipeline between `resolve_download` and `download_file`.
