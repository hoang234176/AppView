# AppView Coordinator

Lightweight in-memory Go coordinator for capability-routed worker tasks. It owns worker WebSocket sessions, task lifecycle, scheduling and retry/requeue decisions; it does not scrape, download, convert media or access local files.

Run:

```sh
go run ./cmd/coordinator
```

Endpoints:

- `GET /health`
- `POST /api/tasks`
- `GET /api/tasks/{id}`
- `GET /ws/workers` (WebSocket)

Read [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/PROTOCOL.md](docs/PROTOCOL.md) before adding worker adapters.
