#!/bin/bash
# ==============================================================================
# AppView - Khởi chạy toàn bộ hệ thống (3 Backend + 1 Frontend Web) trên macOS:
# 1. Coordinator   (:8090)
# 2. Storage       (:8080)
# 3. Download      (:5002)
# 4. Frontend Web  (:5173 - host LAN)
# ==============================================================================

# Đảm bảo đường dẫn môi trường chuẩn trên macOS
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# Thư mục gốc dự án (AppView/)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Nạp biến môi trường nếu có
if [ -f "$ROOT_DIR/backend/.env" ]; then
    set -a
    source "$ROOT_DIR/backend/.env"
    set +a
elif [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

echo "======================================================================"
echo "           🚀 KHỞI CHẠY HỆ THỐNG APPVIEW (FULLSTACK)                  "
echo "======================================================================"
echo " Thư mục dự án: $ROOT_DIR"
echo ""

# Dọn dẹp tiến trình cũ nếu còn kẹt trên các port 8090, 8080, 5002, 5173
cleanup_ports() {
    for port in 8090 8080 5002 5173; do
        pids=$(lsof -ti :$port 2>/dev/null)
        if [ -n "$pids" ]; then
            echo " [CLEANUP] Đang dừng tiến trình cũ trên port :$port (PID: $pids)..."
            kill -9 $pids 2>/dev/null
        fi
    done
}

cleanup_ports
sleep 1

# Mảng lưu PID của các tiến trình con
PIDS=()

# Hàm xử lý khi tắt script (Ctrl+C hoặc đóng terminal)
shutdown_all() {
    echo ""
    echo "======================================================================"
    echo " [SHUTDOWN] Đang dừng tất cả các dịch vụ (Backend + Frontend)..."
    echo "======================================================================"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
        fi
    done
    sleep 1
    # Buộc dừng triệt để nếu còn sót
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
        fi
    done
    cleanup_ports
    echo " [SHUTDOWN] Đã tắt toàn bộ dịch vụ an toàn."
    exit 0
}

trap shutdown_all SIGINT SIGTERM EXIT

# 1. Khởi chạy Coordinator (:8090)
echo " [1/4] Đang khởi chạy Coordinator (:8090)..."
(cd "$ROOT_DIR/backend/coordinator" && go run cmd/coordinator/main.go) &
PIDS+=($!)
sleep 1

# 2. Khởi chạy Storage (:8080)
echo " [2/4] Đang khởi chạy Storage (:8080)..."
(cd "$ROOT_DIR/backend/storage" && go run main.go) &
PIDS+=($!)
sleep 1

# 3. Khởi chạy Download (:5002)
echo " [3/4] Đang khởi chạy Download (:5002)..."
PYTHON_CMD="python3"
if [ -f "$ROOT_DIR/backend/download/venv/bin/python" ]; then
    PYTHON_CMD="$ROOT_DIR/backend/download/venv/bin/python"
elif [ -f "$ROOT_DIR/backend/venv/bin/python" ]; then
    PYTHON_CMD="$ROOT_DIR/backend/venv/bin/python"
elif [ -f "$ROOT_DIR/venv/bin/python" ]; then
    PYTHON_CMD="$ROOT_DIR/venv/bin/python"
fi

(cd "$ROOT_DIR/backend/download" && "$PYTHON_CMD" -u main.py) &
PIDS+=($!)
sleep 1

# 4. Khởi chạy Frontend Web (:5173 - host LAN)
echo " [4/4] Đang khởi chạy Frontend Web (:5173 --host)..."
(cd "$ROOT_DIR/frontend/web" && npm run dev -- --host) &
PIDS+=($!)

echo ""
echo "======================================================================"
echo " ✅ TOÀN BỘ HỆ THỐNG APPVIEW ĐÃ KHỞI CHẠY THÀNH CÔNG!"
echo "----------------------------------------------------------------------"
echo "  • Frontend Web  : http://localhost:5173 (mở mạng LAN qua IP máy)"
echo "  • Coordinator   : http://localhost:8090 (WS: /ws/workers, /ws/events)"
echo "  • Storage       : http://localhost:8080 (Media & Filesystem)"
echo "  • Download      : http://localhost:5002 (Python Resolver)"
echo "----------------------------------------------------------------------"
echo " Nhấn Ctrl+C trong cửa sổ này để tắt toàn bộ dịch vụ."
echo "======================================================================"
echo ""

# Chờ các tiến trình chạy ngầm
wait
