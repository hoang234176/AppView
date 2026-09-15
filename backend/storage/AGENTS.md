# Storage — Agent Instructions

## Responsibility

`backend/storage` is a Go Fiber service. It owns all local filesystem operations: folder CRUD, media serving/streaming, thumbnail generation, archive job lifecycle (download → extract → scan → convert → commit), and the `download_file` Coordinator worker adapter.

It is local-first by design and MUST NOT be redesigned to a remote storage service without an explicit architectural decision.

## Key files

- `main.go` — entry point, worker startup, Fiber initialization
- `routes/routes.go` — verified `/api/v1` route map
- `controllers/storage_controller.go` — folder/file/move/ping
- `controllers/picture_controller.go`, `video_controller.go` — media serving/streaming
- `controllers/archive_job_controller.go` — archive job HTTP API
- `api/python/archive_task.go` — archive job, SSD workspace and HDD commit flow
- `worker/client.go`, `worker/handler.go`, `worker/protocol.go` — outbound Coordinator adapter
- `utils/storage_utils.go` — filesystem listing, thumbnail, path helpers
- `utils/logger.go` — JSON-line structured logging
- `configs/config.go`, `configs/env.go` — Storage root, SSD workspace, env loading

## Media path invariants (CRITICAL)

- Extract wildcard from the **original escaped URI** (`PathOriginal()`).
- URL-path-decode each segment **exactly once** — no double-decode.
- Preserve filenames containing spaces, literal `%`, `#`, `@`, Unicode, emoji, full-width punctuation.
- A literal `%20` in a filename (sent as `%2520`) MUST NOT be decoded to a space.
- After resolving to a filesystem path, stream the open file handle — DO NOT pass the filename back through URL parsing.
- Preserve traversal protections on every decode step; reject decoded `.` / `..` segments.

## Video range serving invariants

- Valid single `Range` header → `206 Partial Content` with correct `Content-Range`, `Content-Length`, MIME type, and `Accept-Ranges: bytes`.
- Invalid/unsatisfiable range → `416`.
- DO NOT fix special-character paths by reintroducing URI parsing of an already-resolved filesystem path.
- Multipart multi-range is a known limitation, not a bug. Document it rather than introducing fragile workarounds.

## Preserved video directory invariants

- Untouched original videos preserved during optimization MUST be stored in `.original-video/` (hidden by default), preserving relative directory structure.
- `.original-video/` and legacy `original-video/` MUST be excluded from recursive video discovery.
- Finalization and cancellation preserve `.original-video/` at destination alongside converted/unoptimized media.

## Platform media vs archive downloads

- Archive and platform-media downloads are separate processing flows.
- Platform-specific Storage flows live under `media_download/<platform>` (e.g. `media_download/youtube`).
- Do not route future platform media through archive processing.
- Do not introduce a generic shared social-media flow prematurely.
- YouTube runtime state lives at `APPVIEW_STATE_DIR/media_download/youtube/jobs/<id>.json` and workspaces at `media_download/youtube/workspaces/<id>/`.
- YouTube downloads commit directly to the destination as a media file, never creating an intermediate directory named after the video.
- TikTok runtime state lives at `APPVIEW_STATE_DIR/media_download/tiktok/jobs/<id>.json` and workspaces at `media_download/tiktok/workspaces/<id>/`.
- TikTok video and photo downloads commit directly to destination without creating subfolders.
- Facebook runtime state lives at `APPVIEW_STATE_DIR/media_download/facebook/jobs/<id>.json` and workspaces at `media_download/facebook/workspaces/<id>/`.
- Facebook video and photo downloads commit directly to destination without creating subfolders.
- Instagram runtime state lives at `APPVIEW_STATE_DIR/media_download/instagram/jobs/<id>.json` and workspaces at `media_download/instagram/workspaces/<id>/`.
- Instagram video and photo downloads commit directly to destination without creating subfolders.

## Worker adapter invariants

- Registers only `download_file`; re-registers after reconnect.
- Payload: `{ "url", "filename", "destination" (relative, optional), "password" (optional), "audioUrl" (optional), "headers" (optional), "source" (optional) }`.
- Archive payloads delegate to `pythonapi.StartArchiveJob`; platform media payloads (e.g. `source: "youtube"`, `source: "tiktok"`, `source: "facebook"`, `source: "instagram"`) route to `media_download/<platform>`.
- Handler MUST strictly check and prioritize explicit `source` attribute before falling back to URL heuristics. Media hosted on shared CDNs (e.g. Meta's `*.fbcdn.net` used by Instagram) MUST NOT be intercepted by Facebook.
- Outbound worker connection checks `STORAGE_COORDINATOR_WS_URL` and `STORAGE_COORDINATOR_WORKER_ID` with fallback to `COORDINATOR_WS_URL` and `COORDINATOR_WORKER_ID`.
- Sends metadata-only progress (snapshot-derived); MUST NOT send file bytes or local filesystem paths on the WebSocket.
- Worker cancellation/disconnect stops monitoring only — does not cancel an in-progress archive or YouTube job (Coordinator can safely requeue/reattach).
- Finite dial timeouts and bounded reconnect backoff — Coordinator outage MUST NOT crash Fiber.

## Logging

MUST NOT log passwords, worker payloads, signed URLs, or tokens. Structured JSON-line to stdout; `LOG_LEVEL` defaults to `INFO`.

## Validation

From `backend/storage`:

```bash
go test ./...
go vet ./...
```

Preserve focused media-path and byte-range regression tests.
