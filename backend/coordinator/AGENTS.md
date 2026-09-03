# Coordinator Agent Instructions

## Purpose

`backend/coordinator` is Go orchestration infrastructure. It routes tasks between clients and workers using worker WebSockets and capabilities. It must not implement scraping, provider resolution, media downloading, FFmpeg conversion, or filesystem operations.

## Before changing code

1. Read `ARCHITECTURE.md`.
2. Use its Change Map.
3. Open only the listed files before expanding scope.

Do not recursively inspect AppView by default. Do not change `backend/download` or `backend/storage` business logic while changing coordinator internals unless the task explicitly authorizes worker-adapter integration.

## Boundaries

Dependencies flow from transport (`internal/httpapi`, `internal/websocket`) to `internal/service`, then registry/scheduler/domain packages. Registries must never perform network I/O or hold locks while a message is written. WebSocket connections own serialized writes through `Connection.Send`.

## Worker rules

Workers register an ID and capabilities. Route only by capability; never hardcode worker IDs or language. A disconnected worker may cause a retryable non-terminal task to requeue, subject to `maxAttempts`.

## Task rules

Lifecycle transitions are centralized in `internal/task/state.go` and `internal/task/registry.go`:

`queued → assigned → processing → completed`

Recovery paths are `assigned/processing → queued` or `failed`. Completed tasks are terminal.

## Documentation and checks

Update `ARCHITECTURE.md` when adding, moving, removing, or materially changing an important file, protocol, route, or lifecycle rule. For protocol work also update `docs/PROTOCOL.md`.

Run focused tests, then from this directory run:

```sh
go test ./...
go vet ./...
```
