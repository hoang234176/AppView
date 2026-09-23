# AppView

**AppView** is a full-stack, distributed media management and automated download orchestration platform designed for local network (LAN) media streaming, social platform downloads, and format conversion.

---

## 🏗 System Architecture

```text
       ┌──────────────────────┐        ┌──────────────────────┐
       │     Frontend Web     │        │   Frontend Mobile    │
       │  (React 19 + Vite)   │        │      (Flutter)       │
       └──────────┬───────────┘        └──────────┬───────────┘
                  │                               │
                  │   REST / WebSocket Events     │
                  └───────────────┬───────────────┘
                                  ▼
               ┌─────────────────────────────────────┐
               │         Backend Coordinator         │
               │             (Go :8090)              │
               │  - Orchestration & Download Jobs   │
               │  - Capability Worker Routing        │
               │  - Interactive Docs (/docs)         │
               └──────────┬───────────────┬──────────┘
                          │               │
      Outbound WS RPC     │               │  Outbound WS RPC
    (resolve_download)    │               │  (download_file)
                          ▼               ▼
        ┌──────────────────────┐      ┌─────────────────────────┐
        │   Backend Download   │      │     Backend Storage     │
        │  (Python / FastAPI)  │      │    (Go Fiber :8080)     │
        │ - URL Stream Resolver│      │ - Local Filesystem I/O  │
        │ - Social Scrapers    │      │ - Media Streaming       │
        │ - Guest-First Auth   │      │ - Disk Cookie Storage   │
        └──────────────────────┘      │ - FFmpeg Video Convert  │
                                      └─────────────────────────┘
```

---

## 📦 Project Structure & Components

AppView is structured as a monorepo with distinct, decoupled services:

| Component | Path | Tech Stack | Role & Responsibility |
|---|---|---|---|
| **Coordinator** | [`backend/coordinator`](backend/coordinator/README.md) | Go | Central task router, two-stage download pipeline, cookie RPC proxy, and Swagger API docs (`/docs`). |
| **Storage** | [`backend/storage`](backend/storage/README.md) | Go (Fiber) | Local media streaming, folder operations, ffmpeg conversions, archive extractors, and physical cookie files. |
| **Download** | [`backend/download`](backend/download/README.md) | Python (FastAPI) | URL resolver for YouTube, Facebook, TikTok, Instagram, X, and MediaFire. Guest-first auth invariant. |
| **Web Client** | [`frontend/web`](frontend/web/README.md) | React 19, Vite, Tailwind | Desktop-optimized media browser, player modals, download queue manager, and cookie settings. |
| **Mobile Client** | [`frontend/mobile`](frontend/mobile/README.md) | Flutter (Dart) | Cross-platform iOS/Android mobile client for LAN streaming and task tracking. |

---

## ⚡ Quickstart Guide

To run the complete AppView environment locally:

### 1. Start Go Coordinator (:8090)
```bash
cd backend/coordinator
go run ./cmd/coordinator
# API Docs available at http://localhost:8090/docs
```

### 2. Start Go Storage (:8080)
```bash
cd backend/storage
go run main.go
```

### 3. Start Python Download Worker (:8000)
```bash
cd backend/download
source .venv/bin/activate  # or create venv: python3 -m venv .venv
pip install -r requirements.txt
python main.py
```

### 4. Start Web Client (:5173)
```bash
cd frontend/web
npm install
npm run dev
```

---

## 🔒 Key Architectural Boundaries & Invariants

1. **Physical File & Cookie Isolation**:
   - Only **Backend Storage** accesses the physical filesystem, media directories, and cookie disk storage (`~/.tmp-appview/cookies/`).
   - Backend Download and Coordinator never read or write media bytes or cookie files directly to disk.
2. **Guest-First Authentication**:
   - Media link resolution always attempts anonymous extraction first, only loading platform cookies when explicitly challenged.
3. **Capability-Routed Workers**:
   - Backend Download and Storage connect as outbound WebSocket workers to Coordinator, allowing Coordinator to run in cloud environments while Storage remains on the local LAN.

---

## 📖 Sub-project Documentation

For detailed information on configuring and running each individual service:
* [Backend Coordinator README](backend/coordinator/README.md)
* [Backend Storage README](backend/storage/README.md)
* [Backend Download README](backend/download/README.md)
* [Frontend Web README](frontend/web/README.md)
* [Frontend Mobile README](frontend/mobile/README.md)
* [Full Architecture Guide](ARCHITECTURE.md)