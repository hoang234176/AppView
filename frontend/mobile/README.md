# AppView Mobile Client

`frontend/mobile` is the cross-platform mobile application for AppView, built with **Flutter** (iOS & Android).

---

## 🎯 Key Features & Screens

1. **Home & Media Explorer (`HomeScreen`)**:
   - Grid and list browsing for media folders, images, and videos on LAN storage.
   - Smooth lazy thumbnail loading and pull-to-refresh synchronization.
   - Real-time directory invalidation handling via Coordinator `/ws/events`.
2. **Dedicated Media Viewers**:
   - **Video Player Screen (`VideoPlayerScreen`)**: Hardware-accelerated video streaming with playback controls and orientation handling.
   - **Lightbox Screen (`LightboxScreen`)**: Interactive pinch-to-zoom and swiping image viewer.
3. **Download Monitor (`DownloadScreen`)**:
   - Track progress and stage status of downloads submitted across the LAN.
   - Monitor live progress percentages and download speeds.
4. **LAN Server Discovery & Configuration**:
   - Built-in configuration dialog (`ConfigApiDialog`) to set custom IP addresses and ports for Go Storage and Coordinator services.

---

## ⚙️ Configuration

Server endpoints can be configured dynamically within the app settings or passed at compile time:

```bash
flutter run \
  --dart-define=APPVIEW_COORDINATOR_API_BASE_URL=http://<COORDINATOR_IP>:8090 \
  --dart-define=APPVIEW_STORAGE_API_BASE_URL=http://<STORAGE_IP>:8080
```

---

## 🚀 Getting Started

### Prerequisites
- Flutter SDK (3.x+)
- Android Studio / Xcode for device simulation or physical deployment

### Installation & Run
```bash
# Get dependencies
flutter pub get

# Run on connected device / emulator
flutter run

# Build APK for Android
flutter build apk --release
```
