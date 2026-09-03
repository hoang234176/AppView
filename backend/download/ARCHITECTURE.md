# Download Backend Notes

Python Download owns URL resolution and the `resolve_download` Coordinator worker; it does not own Storage filesystem paths.

## Logging

`logger.py` emits JSON-line logs controlled by `LOG_LEVEL` (`INFO` by default). Coordinator worker events include safe task IDs, action and filename metadata. Request query strings, passwords, worker payloads, tokens and signed URLs are intentionally omitted from logs.
