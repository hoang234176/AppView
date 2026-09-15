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
- `config.py` — env vars: `GO_STORAGE_BASE_URL`, `PYTHON_DOWNLOAD_PORT`, `PYTHON_DOWNLOAD_HOST`, `DOWNLOAD_COORDINATOR_WS_URL` / `COORDINATOR_WS_URL`, `DOWNLOAD_COORDINATOR_WORKER_ID` / `COORDINATOR_WORKER_ID`

## API contracts — preserve unless versioning is explicit

- `POST /api/v1/download/archive` — create MediaFire archive task (legacy compatibility)
- `GET/POST/DELETE /api/v1/download/tasks...`, `/summary` — task state/control
- `WebSocket /api/v1/download/ws` — frontend real-time task events

## Worker adapter invariants

- Registers only `resolve_download`; does not register `download_file` or any archive capability.
- Reuses `archive_service.resolver`; does not copy provider logic or start archive jobs from worker handler.
- Supports `DOWNLOAD_COORDINATOR_WS_URL` and `DOWNLOAD_COORDINATOR_WORKER_ID` with fallback to `COORDINATOR_WS_URL` and `COORDINATOR_WORKER_ID`.
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

## Social Media Media Download Naming Invariant (Photos & Videos)

- **Universal Filename Format for Photos**:
  All social media platforms (Facebook, TikTok, Instagram, and any future platform expansion; YouTube is excluded as it only downloads video) MUST format photo filenames according to:
  ```text
  [<Tên mxh>]_<Tên ảnh>_<số thứ tự ảnh>.<đuôi file ảnh>
  ```
  - **Example**: `[Facebook]_Ảnh demo_01.jpeg`, `[TikTok]_Vũ điệu hot_02.jpeg`, `[Instagram]_Du lịch hè_01.jpeg`
  - **Rules**:
    - Single photo: Always padded with `01` (e.g., `[Facebook]_Single Photo_01.jpeg`).
    - Multi-photo / Album / Carousel: Items are sequentially indexed (`01`, `02`, `03`...), and the bundle archive is `[<Tên mxh>]_<Tên ảnh>.zip`.
    - Extension: Standardized `.jpeg`.
    - Helper: `archive.contracts.format_photo_download_filename`.

- **Universal Filename Format for Videos**:
  All social media platforms (YouTube, Facebook, TikTok, Instagram, and any future platform expansion) MUST format video filenames with the platform prefix in square brackets:
  ```text
  Single video:  [<Tên mxh>]_<Tên video>.<đuôi file video>
  Multi-video:   [<Tên mxh>]_<Tên video>_<số thứ tự video>.<đuôi file video>
  Archive zip:   [<Tên mxh>]_<Tên video>.zip
  ```
  - **Examples**:
    - `[YouTube]_Bài giảng Python.mp4`
    - `[Facebook]_Video hài hước.mp4`
    - `[TikTok]_Dance Challenge.mp4`
    - `[Instagram]_Reel demo.mp4`
    - `[Instagram]_Reel demo_01.mp4` (trong carousel nhiều video)
  - **Rules**:
    - Single video: Formatted as `[<Platform>]_<Title>.<ext>` without index number.
    - Multi-video (album/carousel): Items are indexed (`_01.mp4`, `_02.mp4`...), and root bundle archive is `[<Platform>]_<Title>.zip`.
    - Extension: Standardized `.mp4`.
    - Helper: `archive.contracts.format_video_download_filename`.

- **Common Components**:
  - `[<Tên mxh>]`: Platform tag in square brackets (`[YouTube]`, `[Facebook]`, `[TikTok]`, `[Instagram]`, etc.).
  - `_`: Underscore delimiter between tag and title.
  - `<Tên>`: Sanitized title (removing invalid filesystem characters `\/:\*?"<>|\x00-\x1f` and redundant platform prefixes like `facebook_`, `tiktok_`, `instagram_`, `youtube_`). Fallback to `post_<id>` or `video_<id>` if title is empty.
  - Future platform implementations MUST use `format_photo_download_filename` and `format_video_download_filename`.

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
