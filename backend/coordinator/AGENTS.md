# Coordinator — Agent Instructions

## Responsibility

`backend/coordinator` is a Go in-memory task orchestrator. It manages worker WebSocket registration, heartbeat, capability-based dispatch, task lifecycle, disconnect recovery, and HTTP task/download-job status.

It MUST NOT resolve URLs, download files, process media, access local storage, or directly call Storage HTTP APIs.

## Before changing code

1. Read `ARCHITECTURE.md` and its Change Map.
2. Open only the files listed there before expanding scope.
3. Do not change `backend/download` or `backend/storage` business logic unless the task explicitly authorizes worker-adapter integration.

## API contracts — preserve unless versioning is explicit

- `POST /api/v1/tasks`, `GET /api/v1/tasks/{id}` — generic capability task lifecycle
- `POST /api/v1/download`, `GET /api/v1/download/{id}` — two-stage resolve-to-Storage download job
- `GET /health` — service health
- `GET /ws/workers` (configurable) — worker WebSocket registration

## Worker protocol invariants

- Source of truth: `internal/protocol/message.go` and `docs/PROTOCOL.md`.
- Route tasks by capability only; never hardcode worker IDs or language.
- Worker protocol changes MUST be reflected in `docs/PROTOCOL.md` and checked against all affected workers.
- DO NOT send raw file bytes or local filesystem paths over worker WebSockets.
- Workers register capabilities; Coordinator assigns only to idle workers with a matching capability.

## Task lifecycle

Centralized in `internal/task/state.go` and `internal/task/registry.go`:

```
queued → assigned → processing → completed
                  → queued (retryable, attempts < maxAttempts on disconnect)
                  → failed  (WORKER_DISCONNECTED or maxAttempts reached)
```

## DownloadJob invariants

- A parent `DownloadJob` is distinct from both child task IDs.
- Resolve child uses `resolve_download`; Storage child uses `download_file`.
- Storage child creation is atomically gated — at most one after a successful resolve result.
- The resolver result fields for transition are exactly `downloadUrl` and `filename`.
- `password` is internal-only and MUST NOT appear in parent JSON responses or logs.
- Coordinator restart loses all in-memory job and task state by design.

## Logging

JSON-line to stdout. Fields: `timestamp`, `level`, `service`, `message`, `jobId`, `taskId`, `workerId`, `action`, `state`, `failureStage` where relevant. MUST NOT log task payloads, passwords, signed URLs, or credentials.

## Dependency direction

Transport (`internal/httpapi`, `internal/websocket`) → `internal/service` → registry/scheduler/domain packages. Registries MUST NOT perform network I/O or hold locks while writing a message. All outbound WebSocket writes go through `Connection.Send`.

## Validation

From `backend/coordinator`:

```bash
go test ./...
go vet ./...
```
