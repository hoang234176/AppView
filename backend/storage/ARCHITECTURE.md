# Storage Backend Notes

Storage owns local filesystem/media operations and the `download_file` Coordinator worker.

Successful folder create/delete/move/rename operations publish a small relative-path filesystem event through that existing worker connection. Coordinator forwards these invalidations to `/ws/events`; events are not durable history.

Folder listings build canonical file/folder metadata and media URLs without creating thumbnails. Thumbnail generation remains lazy in `/api/v1/thumbnails/*`; `/api/v1/pictures/*` and `/api/v1/videos/*` resolve and serve originals independently of thumbnail cache state.

## Logging

`utils/logger.go` emits JSON-line events with `timestamp`, `level`, `service`, and `message`. Set `LOG_LEVEL` to `DEBUG`, `INFO`, `WARN`, or `ERROR` (default `INFO`). Do not log passwords, worker payloads, signed URLs, headers, or tokens.

## Media paths

`/api/v1/videos/*`, `/api/v1/pictures/*`, and `/api/v1/thumbnails/*` extract their wildcard from the original escaped URI, then URL-path-decode every segment exactly once. This preserves a literal `%20` filename sent as `%2520`, leaves `+` unchanged, and rejects decoded traversal/separator segments. Once resolved, Storage streams the open filesystem handle without passing the filename back through URL parsing.
