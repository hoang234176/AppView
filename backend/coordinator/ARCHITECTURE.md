# Coordinator Architecture

Navigation document for targeted maintenance. Read the relevant Change Map entry before opening source files.

## Service Responsibility

The coordinator is an in-memory Go task orchestrator. It manages worker WebSocket registration, heartbeats, capability-based dispatch, task state, worker disconnect recovery, and HTTP task status. It does **not** resolve URLs, download files, process media, or access local storage.

Python Download is connected as an outbound `resolve_download` worker. Local Go Storage is connected as an outbound `download_file` worker. Coordinator owns a small in-memory `DownloadJob` orchestration that chains these existing capabilities without learning their implementations.

```text
HTTP client ── POST /api/v1/tasks ──> Coordinator ── WebSocket ──> registered worker
                                      │
                                      └── task status via GET /api/v1/tasks/{id}
```

## Directory Map

```text
backend/coordinator/
├── cmd/coordinator/main.go          # composition, HTTP server, graceful shutdown
├── internal/
│   ├── config/config.go             # environment-backed runtime configuration
│   ├── protocol/{message,capability}.go
│   ├── worker/{model,registry}.go   # connected worker state
│   ├── task/{model,state,registry}.go
│   ├── downloadjob/{model,registry}.go # parent resolve-to-Storage lifecycle
│   ├── scheduler/scheduler.go       # first compatible idle worker
│   ├── service/coordinator.go       # dispatch and lifecycle orchestration
│   ├── websocket/{server,connection}.go
│   └── httpapi/{server,task_handler,health_handler}.go
├── docs/PROTOCOL.md
├── AGENTS.md
├── ARCHITECTURE.md
├── README.md
└── go.mod
```

## File Responsibility Index

### `cmd/coordinator/main.go`

Composes registries, scheduler, transport, HTTP API, heartbeat monitor and graceful shutdown. Inspect for startup or top-level dependency changes. Usually changed with `internal/config/config.go`.

### `internal/protocol/message.go`, `capability.go`

Defines the typed JSON envelope, protocol message names and shared capability constants. Depends on no transport code. Change with `internal/websocket/server.go`, `internal/service/coordinator.go`, and `docs/PROTOCOL.md` when protocol semantics change.

### `internal/worker/model.go`, `registry.go`

Concurrent-safe connected worker records: capability list, idle/busy status, heartbeat and sender handle. The registry does not write sockets. Inspect for registration, availability, heartbeat or capability lookup changes. Test: `registry_test.go`.

### `internal/task/model.go`, `state.go`, `registry.go`

Defines opaque-payload tasks, legal lifecycle transitions and concurrent in-memory storage. Inspect for task metadata, retry rules, persistence, or lifecycle changes. Test: `registry_test.go`.

### `internal/downloadjob/model.go`, `registry.go`

Defines the in-memory parent `DownloadJob` and its child-task mapping. A parent stores separate resolve/storage task IDs, exposes resolving/downloading/completed/failed state, maps child progress/errors, and atomically permits at most one Storage child after a successful resolver result. Password is internal-only and omitted from JSON responses.

### `internal/scheduler/scheduler.go`

Selects the first ID-sorted compatible idle worker supplied by the worker registry. It does not dispatch. Inspect for load balancing changes. Test: `scheduler_test.go`.

### `internal/service/coordinator.go`

Main orchestration layer: creates tasks, dispatches assignments, receives worker events, marks workers idle, and requeues eligible tasks on disconnect/heartbeat expiry. Depends on worker/task registries, scheduler and protocol. Test: `coordinator_test.go`.

### `internal/websocket/connection.go`, `server.go`

Gorilla WebSocket upgrade and read loop. `Connection` serializes all outbound writes. The server maps protocol events to service calls and starts heartbeat expiry handling; it contains no task selection rules.

### `internal/httpapi/*.go`

Minimal standard-library HTTP API: task creation/query and health. Inspect for client-facing API changes, not worker transport changes.

## HTTP API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Service health and connected worker count. |
| `POST` | `/api/v1/tasks` | Create a capability/action task. |
| `GET` | `/api/v1/tasks/{id}` | Return the in-memory task snapshot. |
| `POST` | `/api/v1/download` | Create a parent two-stage resolve-to-Storage download job. |
| `GET` | `/api/v1/download/{id}` | Return its in-memory parent job snapshot. |
| `GET` | configured `/ws/workers` | Worker WebSocket upgrade. |

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `COORDINATOR_HTTP_ADDR` | `:8090` | HTTP listen address. |
| `COORDINATOR_WORKER_WS_PATH` | `/ws/workers` | Worker WebSocket endpoint. |
| `COORDINATOR_HEARTBEAT_TIMEOUT` | `30s` | Offline threshold. |
| `COORDINATOR_HEARTBEAT_CHECK_INTERVAL` | `5s` | Offline sweep interval. |
| `COORDINATOR_DEFAULT_MAX_ATTEMPTS` | `2` | Retryable task assignment limit. |
| `PORT` | unset | Render-compatible fallback: listens on `0.0.0.0:<PORT>` when `COORDINATOR_HTTP_ADDR` is unset. |

The optional service-local `.env` is loaded for absent variables only; process environment values always take precedence. The root `.gitignore` keeps `.env` local while allowing `.env.example` documentation.

## Lifecycle and Disconnect Policy

Valid states: `queued`, `assigned`, `processing`, `completed`, `failed`.

- Assignment increments `attempts` and sets worker busy.
- `task.accepted` starts processing.
- `task.completed`/`task.failed` frees the worker.
- On disconnect, `assigned` or `processing` tasks requeue only when `retryable` and `attempts < maxAttempts`; otherwise they fail as `WORKER_DISCONNECTED`.
- A DownloadJob follows its child state: requeued children leave the parent in its current stage; a terminal child failure marks the parent failed at `resolve` or `storage`. Coordinator restart loses both registries by design.

## Change Map

### Add/change a WebSocket message

Read `internal/protocol/message.go`, `internal/websocket/server.go`, `internal/service/coordinator.go`, then `docs/PROTOCOL.md`.

### Change worker registration, heartbeat, or disconnect recovery

Read `internal/worker/{model,registry}.go`, `internal/websocket/server.go`, `internal/service/coordinator.go`, and associated tests.

### Change capability routing or load balancing

Read `internal/protocol/capability.go`, `internal/worker/registry.go`, `internal/scheduler/scheduler.go`, `internal/scheduler/scheduler_test.go`.

### Change task fields, lifecycle, retries, or future persistence

Read `internal/task/{model,state,registry}.go`, `internal/service/coordinator.go`, and task/service tests. Do not begin with WebSocket code unless protocol also changes.

### Change resolve-to-Storage download orchestration

Read `internal/downloadjob/{model,registry}.go`, `internal/service/coordinator.go`, `internal/httpapi/download_handler.go`, and `internal/service/download_orchestration_test.go`. Preserve child capability routing and generic `/api/v1/tasks`; do not create a general DAG engine.

### Change client HTTP task API

Read `internal/httpapi/{server,task_handler,health_handler}.go` and `internal/service/coordinator.go`.

### Add a worker adapter

Read `docs/PROTOCOL.md`, `internal/protocol/*.go`, and the target worker's existing business-service boundary. Keep adapter code in that worker service; do not copy its business logic into coordinator.

## Planned Integration

Python Download connects outbound and advertises `resolve_download`. Go Storage connects outbound and advertises only `download_file`, backed by its existing archive job. Coordinator now chains them only for `POST /api/v1/download`; frontend migration to this API remains planned.
