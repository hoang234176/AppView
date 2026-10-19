# Web — Agent Instructions

## Responsibility

`frontend/web` is a React 19 + Vite + Tailwind CSS single-page application. It browses folders, plays media via Go Storage, and submits/tracks download jobs via Coordinator.

## Stack (verified)

React 19, Vite, Tailwind CSS 4, Axios. Available scripts: `dev`, `build`, `lint`, `preview`.

## Key files

- `src/api/axiosConfig.js` — all backend base URL derivation; Storage uses `appview_server_*` localStorage keys with `VITE_STORAGE_API_BASE_URL` fallback; Coordinator uses `VITE_COORDINATOR_API_BASE_URL`
- `src/api/folderApi.js` — Storage REST calls
- `src/api/downloadApi.js` — Coordinator parent download-job calls; legacy Python Download helpers (compatibility only)
- `src/App.jsx` — top-level state, folder/media loading, Coordinator download-job polling

## API / endpoint rules

- MUST NOT scatter backend base URLs across components — use `axiosConfig.js` helpers.
- Coordinator env var: `VITE_COORDINATOR_API_BASE_URL` (confirmed in `axiosConfig.js`).
- Normal downloads use `POST /api/v1/download` on Coordinator; poll `GET /api/v1/download/{id}` every second until terminal state.
- DO NOT add new direct frontend → Download worker WebSocket/API paths for normal downloads.
- Legacy Python Download routes remain available for compatibility-only controls.

## Data / encoding rules

- Avoid double-encoding media URLs/paths passed to Storage.
- Preserve polling cleanup on unmount (clear intervals/timers to prevent post-unmount state updates).

## Validation

Use only scripts present in `package.json`:

```bash
npm run build
npm run lint
```
