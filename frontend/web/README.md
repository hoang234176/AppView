# AppView Web Client

`frontend/web` is the primary desktop-oriented web application for AppView, built with **React 19**, **Vite**, and **Tailwind CSS**.

---

## 🎯 Key Features & UI Modules

1. **Media Library & Folder Explorer**:
   - Seamless browsing of local folders, pictures, and video streams served by Go Storage (`:8080`).
   - Breadcrumb navigation, folder creation, renaming, and batch move/delete actions.
   - Real-time filesystem updates via Coordinator WebSocket (`/ws/events`).
2. **Media Players & Viewers**:
   - **Video Player Modal**: Full-featured video player supporting playback speed, rotation, full-screen, range seeking, and on-the-fly format conversion.
   - **Lightbox Modal**: High-resolution image viewer with zoom, pan, rotation, and slideshow navigation.
3. **Download Manager & Active Tasks**:
   - Unified URL download dialog supporting social media platforms (YouTube, TikTok, Facebook, Instagram, X) and MediaFire archives.
   - Multi-stage progress tracking (Resolving → Downloading → Converting) with floating snackbar notifications.
   - Retry, password entry, and cooperative cancellation controls.
4. **Cookie & Authentication Settings**:
   - Platform-specific cookie management for YouTube, TikTok, Facebook, Instagram, and X.
   - In-app cookie verification, format checking, and storage synchronization through Coordinator.

---

## ⚙️ Configuration & Environment

Environment settings can be configured in `.env` (or via browser `localStorage` dynamically in Settings):

| Variable | Default | Description |
|---|---|---|
| `VITE_COORDINATOR_API_BASE_URL` | `http://localhost:8090` | Coordinator service base URL |
| `VITE_STORAGE_API_BASE_URL` | `http://localhost:8080` | Storage service base URL |
| `VITE_DOWNLOAD_API_BASE_URL` | `http://localhost:8000` | Legacy Python Download service base URL |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm or pnpm

### Installation & Run
```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```
