# Coordinator Worker Protocol

WebSocket endpoint: `GET /ws/workers` (configurable by `COORDINATOR_WORKER_WS_PATH`).

All messages use the `internal/protocol.Message` JSON envelope. Fields not relevant to a message are omitted. `payload`, `progress`, and `result` are valid JSON values owned by the worker capability, not interpreted by the coordinator.

| Type | Direction | Required fields | Meaning |
|---|---|---|---|
| `worker.register` | worker → coordinator | `workerId`, `capabilities` | Opens a worker session. |
| `worker.registered` | coordinator → worker | `workerId` | Registration acknowledgement. |
| `worker.heartbeat` | worker → coordinator | optional `workerId` | Keeps the worker online. |
| `task.assign` | coordinator → worker | `taskId`, `action`, `payload` | Capability-routed task. |
| `task.accepted` | worker → coordinator | `taskId` | Worker began processing. |
| `task.progress` | worker → coordinator | `taskId`, `progress` | Opaque task progress snapshot. |
| `task.completed` | worker → coordinator | `taskId`, optional `result` | Terminal successful result. |
| `task.failed` | worker → coordinator | `taskId`, `error` | Terminal worker-reported failure. |
| `filesystem_event` | Storage worker → coordinator → frontend | `event.type`, relative paths | Best-effort canonical filesystem invalidation. |
| `storage.history` | Storage worker → coordinator | `storageHistory.jobs[]` | Password-free durable archive metadata from one identified Storage worker. |
| `download_event` | coordinator → frontend | `download.jobId`, `download.kind` | Small all-client download-history invalidation. |
| `error` | coordinator → worker | `error.code`, `error.message` | Protocol validation error. |

Workers must register before sending any task event. A task is assigned only to an idle worker advertising a capability exactly matching `action`.

On disconnect or heartbeat expiry, an `assigned`/`processing` task is requeued only if `retryable` is true and its `attempts` count is below `maxAttempts`; otherwise it becomes `failed` with `WORKER_DISCONNECTED`.

Filesystem events are not task results. Supported events are `folder_created`, `folder_deleted`, `folder_moved`, and `folder_renamed`; their event object carries only repository-relative `path`, `oldPath`, `newPath`, and parent fields. Coordinator broadcasts `{ "type": "filesystem_event", "event": { ... } }` to `/ws/events` subscribers. Delivery is bounded and best-effort; reconnecting clients must refetch canonical state.

`storage.history` is accepted only from a registered worker advertising `download_file`. Items require a stable ID, real archive filename, state, valid timestamps, and coherent non-negative progress. `canonicalJobId` preserves the public Coordinator parent ID while the distinct Storage child ID continues to drive worker tasks. Coordinator associates imported records with the sending worker ID and rejects a same-ID record from another Storage worker. Storage strips URL query/fragment/user-info before sending; no password, local path, or file bytes are present.

Coordinator broadcasts `{ "type": "download_event", "download": { "jobId": "...", "kind": "created|updated|progress|state_changed" } }` to every `/ws/events` subscriber. Clients refetch `GET /api/v1/download`. Progress is throttled per job to one event per 750ms; state changes bypass that throttle. The fanout remains bounded/best-effort, so reconnecting clients refetch canonical history.
