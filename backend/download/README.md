# AppView Download Service

`backend/download` is a **Python FastAPI** service (`:8000`) specialized in media URL resolution, direct stream extraction, and social platform scrapers.

---

## 🎯 Key Responsibilities

1. **URL Resolution & Inspection (`resolve_download` Worker)**:
   - Registers with Coordinator as an outbound WebSocket worker for the `resolve_download` capability.
   - Extracts downloadable media URLs, streams, resolutions, and titles for YouTube, Facebook, TikTok, Instagram, X (Twitter), and MediaFire.
   - Generates standardized download filenames following platform conventions (e.g. `[YouTube]_Title.mp4`, `[Facebook]_Photo_01.jpeg`).
2. **Guest-First / Anonymous-First Auth Invariant**:
   - Always attempts anonymous / unauthenticated extraction first.
   - Only requests user cookies if an age-gate, login barrier, or rate limit challenge is encountered.
3. **Strict Separation of Storage & Cookies**:
   - Does **NOT** directly read or write to disk for cookie files or media storage.
   - Fetches and stores cookies strictly via Coordinator RPC (`cookie.get` / `cookie.save`), which delegates disk I/O to the local Storage worker.
4. **Metadata Inspection**:
   - Provides direct inspection APIs (`POST /inspect`) returning platform metadata, available quality streams, and thumbnails without triggering a full download.

---

## 🔌 API Endpoints & Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/inspect` | Inspect URL metadata and available stream formats |
| `GET` | `/health` | Service health status |
| `POST` | `/api/v1/download/archive` | Legacy MediaFire archive submission |
| `GET` | `/api/v1/download/tasks` | Legacy task state listing |
| `WS` | `/api/v1/download/ws` | Legacy real-time task progress WebSocket |

---

## ⚙️ Configuration & Environment

Configuration is managed via environment variables or a `.env` file:

| Variable | Default | Description |
|---|---|---|
| `PYTHON_DOWNLOAD_HOST` | `0.0.0.0` | Listen host |
| `PYTHON_DOWNLOAD_PORT` | `8000` | Listen port (or Render `PORT`) |
| `COORDINATOR_WS_URL` | `ws://localhost:8090/ws/workers` | Coordinator worker WebSocket URL |
| `COORDINATOR_WORKER_ID`| `download-worker-1` | Worker identifier for Coordinator |
| `GO_STORAGE_BASE_URL` | `http://localhost:8080` | URL to local Go Storage for legacy fallback |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- `yt-dlp` and dependencies in `requirements.txt`

### Installation & Run
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run service
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
