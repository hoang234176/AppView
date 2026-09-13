# Download — Agent Instructions

## Responsibility

`backend/download` is a Python FastAPI service. It owns URL resolution, the `resolve_download` Coordinator worker adapter, in-memory download-task state, and frontend WebSocket broadcasts.

It MUST NOT own filesystem paths, archive/file mutations, or local storage. It does not start Go archive jobs from Coordinator worker work.

## Key files

- `main.py` — lifespan (worker start/stop), REST task API, `/api/v1/download/ws` WebSocket
- `archive/mediafire.py` — MediaFire page resolver
- `archive/service.py` — resolves URL then drives Go archive job monitoring/recovery
- `archive/go_archive_client.py` — sole HTTP boundary from Python to Go Storage archive API
- `services/task_manager.py`, `progress_manager.py`, `websocket_manager.py` — in-memory task lifecycle and broadcasts
- `models/download_task.py` — Download task and stage contract (shared with Web/Mobile)
- `worker/client.py`, `worker/handler.py`, `worker/protocol.py` — outbound Coordinator WebSocket adapter
- `config.py` — env vars: `GO_STORAGE_BASE_URL`, `PYTHON_DOWNLOAD_PORT`, `PYTHON_DOWNLOAD_HOST`, `COORDINATOR_WS_URL`, `COORDINATOR_WORKER_ID`

## API contracts — preserve unless versioning is explicit

- `POST /api/v1/download/archive` — create MediaFire archive task (legacy compatibility)
- `GET/POST/DELETE /api/v1/download/tasks...`, `/summary` — task state/control
- `WebSocket /api/v1/download/ws` — frontend real-time task events

## Worker adapter invariants

- Registers only `resolve_download`; does not register `download_file` or any archive capability.
- Reuses `archive_service.resolver`; does not copy provider logic or start archive jobs from worker handler.
- Sends `task.accepted` → (`task.progress`) → `task.completed` or `task.failed` per Coordinator protocol.
- Source of truth for envelope shape: `backend/coordinator/docs/PROTOCOL.md`.
- Finite dial timeouts and bounded reconnect backoff — Coordinator outage MUST NOT crash or block FastAPI.

## Boundaries

- Python Download owns source-specific media resolution. Each platform must have its own resolver/service.
- `yt-dlp` is strictly an implementation detail of the YouTube resolver (`services/youtube/`) and must not become a generic social-media resolver.
- Future platforms (Facebook, etc.) must have independent platform parsers/resolvers without inheriting yt-dlp abstractions.
- Go Storage remains platform-agnostic and owns actual byte transfer, filesystem operations, and media processing.
- DO NOT introduce new direct frontend → Download worker WebSocket/API paths for normal downloads.
- Preserve intentional legacy API compatibility for `/api/v1/download/archive` and task endpoints.
- DO NOT log passwords, tokens, cookies, signed URL query strings, or sensitive auth payload details.

## Authentication & Cookie Invariant (Guest-First Policy & Storage Ownership)

- All social media resolvers/extractors (YouTube, Facebook, TikTok, Instagram, and future platforms) MUST strictly follow a **Guest-First (Anonymous-First)** approach.
- **Step 1 (Anonymous inspection/resolution)**: Always inspect, scrape, and resolve URLs initially without loading or sending cookies.
- **Step 2 (On-demand auth fallback)**: Only load cookies when the target platform explicitly indicates authentication is required (HTTP 401/403, login redirects, age-gate restrictions, bot checkpoints, or private content).
- **Cookie Storage & Access Invariant (CRITICAL - DO NOT TOUCH FILESYSTEM)**:
  - Python Download worker **MUST NOT read or write cookie text files (e.g. `~/.tmp-appview/cookies/*.txt`) directly on the filesystem**.
  - All cookie files on disk are owned strictly by the **Go Storage worker**.
  - When Python Download requires cookies for authentication fallback, it **MUST query Go Storage via Coordinator RPC** (`coordinator_worker_client.get_cookies("<platform>")`).
  - When updating or saving cookies, Python Download **MUST route the save request to Go Storage via Coordinator RPC** (`coordinator_worker_client.save_cookies("<platform>", cookies)`) or Coordinator HTTP endpoint (`POST /api/v1/cookies/save`).
  - Cookies in Python Download must remain **in-memory only** (e.g. in-memory `CookieJar` or header string).
  - Never pass direct filesystem cookie file paths to third-party engines like `yt-dlp` (e.g. `ydl_opts["cookiefile"] = file_path`), as `yt-dlp` will overwrite the persistent cookie file and strip credentials. Use in-memory cookie jars instead.
- **Rationale**: Sending authenticated cookies unconditionally to public endpoints triggers anti-bot checkpoints, rate limits, account flagging, and can alter SSR responses. Direct filesystem access violates the core architecture boundary where Go Storage exclusively owns all filesystem/media operations.

## Configuration

- `COORDINATOR_WS_URL` defaults to `ws://localhost:8090/ws/workers`.
- `PORT` is used when `PYTHON_DOWNLOAD_PORT` is absent (Render compatibility).
- OS/Render environment values always override local `.env`.

## Validation

Use only scripts/commands actually supported by this repo:

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q .
```
