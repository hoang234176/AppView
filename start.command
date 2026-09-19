#!/bin/bash
# ==============================================================================
# AppView - Trình khởi chạy hệ thống (Menu lựa chọn):
# 1. Khởi động Backend
# 2. Khởi động Backend + Frontend
# 3. Thoát (Quit)
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

# Hàm đóng cửa sổ Terminal khi thoát
close_terminal_window() {
    osascript -e 'tell application "Terminal" to close (first window whose frontmost is true)' 2>/dev/null || \
    osascript -e 'tell application "Terminal" to close front window' 2>/dev/null || \
    kill -9 $PPID 2>/dev/null
}

# Hiển thị Menu lựa chọn
clear
echo "======================================================================"
echo "               🚀 HỆ THỐNG QUẢN LÝ APPVIEW                            "
echo "======================================================================"
echo " Thư mục dự án: $ROOT_DIR"
echo "----------------------------------------------------------------------"
echo "  [1] Khởi động Backend"
echo "  [2] Khởi động Backend + Frontend"
echo "  [3] Thoát (Quit)"
echo "======================================================================"
read -p " Nhập lựa chọn của bạn [1, 2 hoặc 3]: " choice

case "$choice" in
    1)
        START_FRONTEND=0
        ;;
    2)
        START_FRONTEND=1
        ;;
    3)
        echo " [THOÁT] Đang đóng cửa sổ..."
        close_terminal_window
        exit 0
        ;;
    *)
        echo " [LỖI] Lựa chọn không hợp lệ. Vui lòng chạy lại script và chọn 1, 2 hoặc 3."
        sleep 2
        close_terminal_window
        exit 1
        ;;
esac

echo ""
echo "----------------------------------------------------------------------"
echo " Đang chuẩn bị môi trường khởi chạy..."
echo "----------------------------------------------------------------------"

# Dọn dẹp tiến trình cũ nếu còn kẹt trên các port tương ứng
cleanup_ports() {
    local ports=(8090 8080 5002)
    if [ "$START_FRONTEND" -eq 1 ]; then
        ports+=(5173)
    fi
    for port in "${ports[@]}"; do
        pids=$(lsof -ti :$port 2>/dev/null)
        if [ -n "$pids" ]; then
            echo " [CLEANUP] Đang dừng tiến trình cũ trên port :$port (PID: $pids)..."
            kill -9 $pids 2>/dev/null
        fi
    done
}

cleanup_ports
sleep 1

# Thiết lập vùng cuộn của Terminal (Scroll Margins)
# Dành riêng dòng cuối cùng làm Snackbar cố định
ROWS=$(tput lines 2>/dev/null || echo 24)
SCROLL_MAX=$((ROWS - 1))

# Hàm in và ghim thanh snackbar cố định ở dòng dưới cùng
render_snackbar() {
    local max_row
    max_row=$(tput lines 2>/dev/null || echo 24)
    # Lưu vị trí con trỏ
    tput sc 2>/dev/null
    # Nhảy đến dòng cuối cùng của màn hình
    tput cup $((max_row - 1)) 0 2>/dev/null
    # In snackbar chữ xám nền trong suốt, xóa hết phần còn lại của dòng
    printf "\033[90mCtrl + C: tắt hệ thống\033[0m\033[K"
    # Khôi phục vị trí con trỏ
    tput rc 2>/dev/null
}

# Khôi phục vùng cuộn đầy đủ khi thoát
reset_scroll_region() {
    # Hủy vùng cuộn giới hạn (trả lại 1 đến dòng cuối)
    printf "\033[r"
    local max_row
    max_row=$(tput lines 2>/dev/null || echo 24)
    tput cup $max_row 0 2>/dev/null
    echo ""
}

# Thiết lập vùng cuộn từ dòng 1 đến SCROLL_MAX
# Tất cả output/log sẽ chỉ cuộn bên trong vùng này, không bao giờ chạm tới dòng cuối
printf "\033[1;%dr" "$SCROLL_MAX"
tput cup $((SCROLL_MAX - 1)) 0 2>/dev/null
render_snackbar

# Bắt tín hiệu thay đổi kích thước cửa sổ Terminal (WINCH) để tính toán lại vùng cuộn
handle_winch() {
    ROWS=$(tput lines 2>/dev/null || echo 24)
    SCROLL_MAX=$((ROWS - 1))
    printf "\033[1;%dr" "$SCROLL_MAX"
    render_snackbar
}
trap handle_winch WINCH

# Mảng lưu PID của các tiến trình con
PIDS=()

# Hàm xử lý khi tắt script (Ctrl+C hoặc đóng terminal)
shutdown_all() {
    reset_scroll_region
    echo ""
    echo "======================================================================"
    echo " [SHUTDOWN] Đang dừng tất cả các dịch vụ đang chạy..."
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
echo " [1/3] Đang khởi chạy Coordinator (:8090)..."
(cd "$ROOT_DIR/backend/coordinator" && go run cmd/coordinator/main.go) &
PIDS+=($!)
sleep 1

# 2. Khởi chạy Storage (:8080)
echo " [2/3] Đang khởi chạy Storage (:8080)..."
(cd "$ROOT_DIR/backend/storage" && go run main.go) &
PIDS+=($!)
sleep 1

# 3. Khởi chạy Download (:5002)
echo " [3/3] Đang khởi chạy Download (:5002)..."
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

# 4. Khởi chạy Frontend Web (:5173 - host LAN) nếu chọn option 2
if [ "$START_FRONTEND" -eq 1 ]; then
    sleep 1
    echo " [4/4] Đang khởi chạy Frontend Web (:5173 --host)..."
    (cd "$ROOT_DIR/frontend/web" && npm run dev -- --host) &
    PIDS+=($!)
fi

echo ""
echo "======================================================================"
if [ "$START_FRONTEND" -eq 1 ]; then
    echo " ✅ TOÀN BỘ HỆ THỐNG APPVIEW (BACKEND + FRONTEND) ĐÃ CHẠY THÀNH CÔNG!"
else
    echo " ✅ 3 BACKEND SERVICE APPVIEW ĐÃ KHỞI CHẠY THÀNH CÔNG!"
fi
echo "----------------------------------------------------------------------"
echo "  • Coordinator   : http://localhost:8090 (WS: /ws/workers, /ws/events)"
echo "  • Storage       : http://localhost:8080 (Media & Filesystem)"
echo "  • Download      : http://localhost:5002 (Python Resolver)"
if [ "$START_FRONTEND" -eq 1 ]; then
    echo "  • Frontend Web  : http://localhost:5173 (mở mạng LAN qua IP máy)"
fi
echo "======================================================================"
echo ""

# Đảm bảo snackbar vẫn hiển thị chuẩn xác ở đáy
render_snackbar

# Chờ các tiến trình chạy ngầm
wait
