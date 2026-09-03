# Mobile — Agent Instructions

## Responsibility

`frontend/mobile` is a Flutter application. It browses folders, plays media via Go Storage, and submits/tracks download jobs via Coordinator.

## Stack (verified)

Flutter (Dart SDK ^3.7), `video_player`, `dio`, `provider`, `shared_preferences`, `web_socket_channel`.

## Key files

- `lib/api/api_config.dart` — all backend URL configuration; Storage uses SharedPreferences with `APPVIEW_STORAGE_API_BASE_URL` compile-time fallback; Coordinator uses `APPVIEW_COORDINATOR_API_BASE_URL`
- `lib/providers/download_provider.dart` — Coordinator DownloadJob polling, retention, and disposal
- `lib/providers/app_state_provider.dart` — application navigation/cache state
- `lib/services/download_websocket_service.dart` — reconnecting Python Download WebSocket client (legacy compatibility)
- `lib/api/{folder_api,download_api,cache_api}.dart` — typed HTTP boundaries

## API / endpoint rules

- MUST use `ApiConfig` for all backend URLs — do not hardcode hostnames in screens or widgets.
- Coordinator compile-time define: `APPVIEW_COORDINATOR_API_BASE_URL` (confirmed in `api_config.dart`).
- Flutter does not read `.env` files at runtime; URLs are SharedPreferences-backed with compile-time `--dart-define` defaults.
- Normal downloads submit through `DownloadProvider` → `POST /api/v1/download` on Coordinator; poll `GET /api/v1/download/{id}` until terminal state.
- DO NOT add new direct mobile → Download worker paths for normal downloads.
- Legacy Python Download WebSocket client remains for compatibility-only state.

## Data / resource rules

- Construct `Uri` values carefully; avoid double-encoding path segments sent to Storage.
- Native video playback relies on Storage HTTP Range semantics — DO NOT hide Storage Range bugs with fragile Flutter workarounds.
- Dispose controllers, timers, polling futures, and WebSocket listeners correctly; DO NOT call `setState` or `notifyListeners` after disposal.

## Validation

```bash
flutter analyze
```
