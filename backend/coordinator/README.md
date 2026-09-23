# AppView Coordinator

`backend/coordinator` is a lightweight, high-performance Go service (`:8090`) responsible for central task orchestration, worker capability routing, real-time invalidations, and system API documentation.

---

## 🎯 Key Responsibilities

1. **Two-Stage Download Pipeline**:
   - Manages end-to-end `DownloadJob` state machine (`queued` → `resolving` → `downloading` → `completed` / `failed`).
   - Coordinates `resolve_download` worker (Python Download) and `download_file` worker (Go Storage) without handling media bytes directly.
2. **Generic Task & Capability Routing**:
   - Manages bi-directional WebSocket connections (`/ws/workers`) from distributed workers.
   - Matches tasks to idle workers based on advertised capabilities (`resolve_download`, `download_file`).
   - Handles heartbeat detection, worker disconnect recovery, and task requeuing.
3. **Cookie RPC Proxy**:
   - Serves as the mediator for platform authentication cookies (`cookie.get`, `cookie.save`).
   - Python Download worker requests cookies from Coordinator, which delegates to Go Storage worker for disk persistence.
4. **Real-time Event Invalidation**:
   - Emits lightweight filesystem and task invalidation messages to frontend clients via `/ws/events`.
5. **Interactive API Documentation**:
   - Serves OpenAPI 3.0 specification (`GET /api/openapi.json`) and Swagger UI (`GET /docs`), indexing routes across Coordinator, Storage, and Download services.

---

## 🔌 API Endpoints & Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/docs` | Interactive Swagger UI API documentation |
| `GET` | `/api/openapi.json` | OpenAPI 3.0 JSON specification |
| `GET` | `/health` | Service health status and connected worker counts |
| `POST` | `/api/v1/download` | Initiate two-stage download pipeline |
| `GET` | `/api/v1/download` | List current & historical download jobs |
| `GET` | `/api/v1/download/{id}` | Get status and details of a specific download job |
| `POST` | `/api/v1/download/{id}/retry` | Retry a failed download job |
| `POST` | `/api/v1/download/{id}/cancel` | Cooperatively cancel an active download job |
| `POST` | `/api/v1/cookies/verify` | Verify social platform cookies |
| `POST` | `/api/v1/cookies/save` | Save platform cookies |
| `WS` | `/ws/workers` | Worker registration and RPC protocol WebSocket |
| `WS` | `/ws/events` | Frontend real-time invalidation WebSocket |

---

## ⚙️ Configuration & Environment

Configuration is loaded from environment variables or an optional `.env` file:

| Variable | Default | Description |
|---|---|---|
| `COORDINATOR_HTTP_ADDR` | `:8090` | HTTP listen address (or Render `PORT`) |
| `COORDINATOR_WORKER_WS_PATH` | `/ws/workers` | Path for worker WebSocket connections |
| `COORDINATOR_HEARTBEAT_TIMEOUT` | `15s` | Timeout before declaring an idle worker dead |
| `COORDINATOR_HEARTBEAT_CHECK_INTERVAL` | `5s` | Heartbeat checker polling interval |
| `COORDINATOR_DEFAULT_MAX_ATTEMPTS` | `3` | Maximum retry attempts for capability tasks |

---

## 🚀 Getting Started

### Prerequisites
- Go 1.22 or higher

### Run Service
```bash
# Run Coordinator directly
go run ./cmd/coordinator

# Or run tests
go test ./...
```

---

## 📚 Related Documentation
- [Coordinator Architecture Details](ARCHITECTURE.md)
- [Worker Protocol Specifications](docs/PROTOCOL.md)
