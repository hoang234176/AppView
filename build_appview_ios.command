#!/bin/bash
# ==============================================================================
# build_appview_ios.command
# Tự động hóa build Release iOS (xcodebuild), renew chữ ký Apple (7 ngày),
# hiển thị thanh tiến trình 1 dòng duy nhất (Progress bar %), cài đặt không dây.
# ==============================================================================

# Đổi thư mục làm việc về root của dự án AppView
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT" || exit 1

# Thiết lập bảng màu
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

IOS_DIR="$PROJECT_ROOT/frontend/mobile/ios"
WORKSPACE="$IOS_DIR/Runner.xcworkspace"
SCHEME="Runner"
CONFIGURATION="Release"
LOG_DIR="$PROJECT_ROOT/.tmp-appview/logs"
mkdir -p "$LOG_DIR"
BUILD_LOG="$LOG_DIR/ios_build_$(date +%Y%m%d_%H%M%S).log"

print_header() {
    echo -e "\n${BOLD}${BLUE}======================================================================${NC}"
    echo -e "${BOLD}${CYAN}   $1${NC}"
    echo -e "${BOLD}${BLUE}======================================================================${NC}\n"
}

log_step() {
    echo ""
    echo -e "${BOLD}[$(date +'%H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}✔ [$(date +'%H:%M:%S')] $1${NC}"
}

SHIMMER_PID=""

start_shimmer() {
    local text="$1"
    python3 - "$text" << 'EOF' &
import sys, time

text = sys.argv[1]
# Bảng gradient xám mịn 256 màu (từ tối sâu 237 -> 240 -> 244 -> 248 -> 252 -> sáng 255)
GRADIENT = [237, 239, 241, 243, 246, 249, 252, 255]
base_color = 237
nc = '\033[0m'
clear_line = '\033[K'

wave = -len(GRADIENT)
max_pos = len(text) + len(GRADIENT)

while True:
    chars = []
    for idx, ch in enumerate(text):
        dist = abs(idx - wave)
        if dist < len(GRADIENT):
            color_idx = len(GRADIENT) - 1 - dist
            color_code = GRADIENT[color_idx]
            if color_code == 255:
                chars.append(f"\033[1;38;5;{color_code}m{ch}{nc}")
            else:
                chars.append(f"\033[38;5;{color_code}m{ch}{nc}")
        else:
            chars.append(f"\033[38;5;{base_color}m{ch}{nc}")
            
    line = "".join(chars)
    sys.stdout.write(f"\r  {line}{clear_line}")
    sys.stdout.flush()
    
    wave += 1
    if wave > max_pos:
        wave = -len(GRADIENT)
    time.sleep(0.04)
EOF
    SHIMMER_PID=$!
}

stop_shimmer() {
    if [ -n "$SHIMMER_PID" ]; then
        kill "$SHIMMER_PID" 2>/dev/null
        wait "$SHIMMER_PID" 2>/dev/null
        SHIMMER_PID=""
    fi
    echo -ne "\r\033[K"
}

log_error() {
    stop_shimmer
    echo -e "${RED}✖ [$(date +'%H:%M:%S')] $1${NC}"
}

print_header "APPVIEW IOS - BUILD & DEPLOY KHÔNG DÂY (WIRELESS / USB)"

# ------------------------------------------------------------------------------
# 1. KIỂM TRA MÔI TRƯỜNG & CÔNG CỤ
# ------------------------------------------------------------------------------
log_step "Tác vụ 1/4: Kiểm tra môi trường Xcode & CoreDevice..."
start_shimmer "Đang kiểm tra Xcode CLI và Workspace..."

if ! command -v xcrun &>/dev/null; then
    stop_shimmer
    log_error "Không tìm thấy công cụ 'xcrun'. Vui lòng cài đặt Xcode Command Line Tools."
    read -n 1 -s -r -p "Nhấn phím bất kỳ để thoát..."
    exit 1
fi

if [ ! -d "$WORKSPACE" ]; then
    stop_shimmer
    log_error "Không tìm thấy Workspace tại: $WORKSPACE"
    read -n 1 -s -r -p "Nhấn phím bất kỳ để thoát..."
    exit 1
fi
stop_shimmer
log_success "Môi trường hợp lệ: Xcode CLI sẵn sàng."

# ------------------------------------------------------------------------------
# 2. PHÁT HIỆN THIẾT BỊ iOS (USB HOẶC WIRELESS)
# ------------------------------------------------------------------------------
log_step "Tác vụ 2/4: Quét thiết bị iOS (CoreDevice)..."
start_shimmer "Đang quét thiết bị iPhone kết nối (Wi-Fi / USB)..."

DEVICE_INFO=$(python3 - << 'EOF'
import subprocess
import json
import sys

try:
    res = subprocess.run(
        ['xcrun', 'devicectl', 'list', 'devices', '--json-output', '/dev/stdout'],
        capture_output=True,
        text=True,
        timeout=15
    )
    raw = res.stdout
    start = raw.find('{')
    if start == -1:
        sys.exit(1)
    data = json.loads(raw[start:])
    devices = data.get('result', {}).get('devices', [])
    physical = [d for d in devices if d.get('hardwareProperties', {}).get('reality') == 'physical']
    if not physical:
        sys.exit(2)
        
    dev = physical[0]
    name = dev.get('deviceProperties', {}).get('name', 'iOS Device')
    model = dev.get('hardwareProperties', {}).get('marketingName', 'iPhone')
    udid = dev.get('hardwareProperties', {}).get('udid', '')
    transport = dev.get('connectionProperties', {}).get('transportType', 'unknown')
    identifier = dev.get('identifier', '')
    
    print(f"NAME={name}")
    print(f"MODEL={model}")
    print(f"UDID={udid}")
    print(f"TRANSPORT={transport}")
    print(f"IDENTIFIER={identifier}")
except Exception:
    sys.exit(3)
EOF
)

stop_shimmer

RET_CODE=$?
if [ $RET_CODE -ne 0 ] || [ -z "$DEVICE_INFO" ]; then
    log_error "Không tìm thấy thiết bị iOS vật lý nào đang kết nối (USB hoặc Wi-Fi)."
    echo -e "${YELLOW}Vui lòng kiểm tra lại:${NC}"
    echo -e "  - iPhone và Mac có đang kết nối cùng mạng Wi-Fi không?"
    echo -e "  - Trong Xcode > Devices and Simulators, iPhone đã bật 'Connect via network' chưa?"
    echo ""
    read -n 1 -s -r -p "Nhấn phím bất kỳ để thoát..."
    exit 1
fi

DEV_NAME=$(echo "$DEVICE_INFO" | grep "^NAME=" | cut -d'=' -f2-)
DEV_MODEL=$(echo "$DEVICE_INFO" | grep "^MODEL=" | cut -d'=' -f2-)
DEV_UDID=$(echo "$DEVICE_INFO" | grep "^UDID=" | cut -d'=' -f2-)
DEV_TRANSPORT=$(echo "$DEVICE_INFO" | grep "^TRANSPORT=" | cut -d'=' -f2-)
DEV_ID=$(echo "$DEVICE_INFO" | grep "^IDENTIFIER=" | cut -d'=' -f2-)

if [ "$DEV_TRANSPORT" = "wired" ]; then
    CONN_STR="${GREEN}USB (Cáp trực tiếp)${NC}"
elif [ "$DEV_TRANSPORT" = "localNetwork" ]; then
    CONN_STR="${BLUE}WIRELESS (Wi-Fi / Mạng nội bộ)${NC}"
else
    CONN_STR="${YELLOW}$DEV_TRANSPORT${NC}"
fi

echo -e "    --------------------------------------------------"
echo -e "    • Thiết bị đích : ${CYAN}${DEV_NAME}${NC} (${DEV_MODEL})"
echo -e "    • Phương thức   : ${CONN_STR}"
echo -e "    • UDID          : ${DEV_UDID}"
echo -e "    --------------------------------------------------"
log_success "Đã nhận diện thiết bị thành công."

# ------------------------------------------------------------------------------
# 3. BIÊN DỊCH VÀ TỰ ĐỘNG CẤP LẠI CHỨNG CHỈ (VỚI PROGRESS BAR 1 DÒNG DUY NHẤT)
# ------------------------------------------------------------------------------
log_step "Tác vụ 3/4: Đang biên dịch Release & cập nhật chứng chỉ Apple..."
echo -e "    • Configuration : ${MAGENTA}${CONFIGURATION}${NC}"
echo -e "    • Scheme        : ${MAGENTA}${SCHEME}${NC}"
echo -e "    • Cờ tự cấp ký  : ${GREEN}-allowProvisioningUpdates${NC}"
echo -e "    • Chi tiết log  : ${BUILD_LOG}\n"

cd "$IOS_DIR" || exit 1

# Thiết lập pipefail để bắt lỗi chính xác từ xcodebuild
set -o pipefail

# Chạy xcodebuild qua bộ lọc Python Progress Bar độc lập
PROGRESS_PARSER="$PROJECT_ROOT/.tmp-appview/xcode_progress.py"

xcodebuild -workspace "$WORKSPACE" \
           -scheme "$SCHEME" \
           -configuration "$CONFIGURATION" \
           -destination "id=$DEV_UDID" \
           -allowProvisioningUpdates \
           build 2>&1 | python3 "$PROGRESS_PARSER" "$BUILD_LOG"

BUILD_STATUS=$?
set +o pipefail

if [ $BUILD_STATUS -ne 0 ]; then
    log_error "Biên dịch thất bại (xcodebuild exit code: $BUILD_STATUS)!"
    echo -e "\n${RED}--- 20 dòng cuối trong file log lỗi ---${NC}"
    tail -n 20 "$BUILD_LOG"
    echo -e "${RED}---------------------------------------${NC}"
    echo -e "Xem toàn bộ log tại: $BUILD_LOG\n"
    read -n 1 -s -r -p "Nhấn phím bất kỳ để thoát..."
    exit 1
fi
log_success "Biên dịch và ký mã số thành công (** BUILD SUCCEEDED **)."

start_shimmer "Đang chuẩn bị gói ứng dụng Runner.app và kết nối thiết bị..."

# Định vị thư mục Runner.app
APP_PATH=$(python3 - << 'EOF'
import subprocess, os
derived_dir = os.path.expanduser("~/Library/Developer/Xcode/DerivedData")
candidate = os.path.join(derived_dir, "Runner-edywoyrcoifgyfbjuqqsuadzuyxj/Build/Products/Release-iphoneos/Runner.app")
if os.path.isdir(candidate):
    print(candidate)
else:
    res = subprocess.run(['find', derived_dir, '-name', 'Runner.app', '-path', '*/Release-iphoneos/*'], capture_output=True, text=True)
    lines = [line.strip() for line in res.stdout.strip().split('\n') if line.strip()]
    if lines:
        print(lines[0])
EOF
)

stop_shimmer

if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
    log_error "Không định vị được thư mục Runner.app vừa build!"
    read -n 1 -s -r -p "Nhấn phím bất kỳ để thoát..."
    exit 1
fi

# ------------------------------------------------------------------------------
# 4. CÀI ĐẶT APP VÀO THIẾT BỊ (QUA WIRELESS / USB) VỚI SHIMMER HIỆU ỨNG SÓNG
# ------------------------------------------------------------------------------
log_step "Tác vụ 4/4: Đang truyền và cài đặt ứng dụng vào ${DEV_NAME}..."

INSTALL_LOG="$LOG_DIR/ios_install_$(date +%Y%m%d_%H%M%S).log"

# Bắt đầu hiệu ứng sóng chữ xám mịn chạy ngang qua
start_shimmer "Đang truyền tải dữ liệu và ghi vào bộ nhớ iPhone qua Wi-Fi..."

xcrun devicectl device install app --device "$DEV_UDID" "$APP_PATH" > "$INSTALL_LOG" 2>&1
INSTALL_STATUS=$?

stop_shimmer

if [ $INSTALL_STATUS -ne 0 ]; then
    log_error "Cài đặt ứng dụng thất bại!"
    cat "$INSTALL_LOG"
    read -n 1 -s -r -p "Nhấn phím bất kỳ để thoát..."
    exit 1
fi
log_success "Cài đặt ứng dụng thành công vào iPhone!"

# ------------------------------------------------------------------------------
# 5. TỔNG HỢP & HIỂN THỊ THÔNG TIN CHỨNG CHỈ (THỜI HẠN CÒN LẠI)
# ------------------------------------------------------------------------------
print_header "KẾT QUẢ TRIỂN KHAI VÀ THỜI HẠN CHỨNG CHỈ"

python3 - << EOF
import plistlib, subprocess, os
from datetime import datetime, timezone

BOLD = '\033[1m'
GREEN = '\033[0;32m'
BLUE = '\033[0;34m'
YELLOW = '\033[0;33m'
RED = '\033[0;31m'
CYAN = '\033[0;36m'
MAGENTA = '\033[0;35m'
NC = '\033[0m'

app_path = "$APP_PATH"
prov_path = os.path.join(app_path, "embedded.mobileprovision")

if os.path.isfile(prov_path):
    res = subprocess.run(['security', 'cms', '-D', '-i', prov_path], capture_output=True)
    if res.returncode == 0:
        plist = plistlib.loads(res.stdout)
        exp_date = plist.get('ExpirationDate')
        creat_date = plist.get('CreationDate')
        app_id = plist.get('AppIDName', 'AppView')
        team_name = plist.get('TeamName', '')
        
        now = datetime.now(timezone.utc)
        if exp_date:
            exp_date_utc = exp_date.replace(tzinfo=timezone.utc) if exp_date.tzinfo is None else exp_date
            creat_date_utc = creat_date.replace(tzinfo=timezone.utc) if creat_date and creat_date.tzinfo is None else creat_date
            
            local_exp = exp_date_utc.astimezone()
            local_creat = creat_date_utc.astimezone() if creat_date_utc else None
            remaining = exp_date_utc - now
            
            if remaining.total_seconds() > 0:
                days = remaining.days
                hours, remainder = divmod(remaining.seconds, 3600)
                minutes, _ = divmod(remainder, 60)
                rem_str = f"{GREEN}{days} ngày {hours} giờ {minutes} phút{NC}"
            else:
                rem_str = f"{RED}Đã hết hạn!{NC}"
                
            print(f"    - Trạng thái cài đặt: {GREEN}Thành công 100%{NC}")
            print(f"    - Thiết bị đích     : {CYAN}$DEV_NAME{NC} ($DEV_TRANSPORT)")
            print(f"    - Cấu hình biên dịch: {MAGENTA}Release (Tối ưu hiệu năng){NC}")
            print(f"    - Ứng dụng          : {CYAN}{app_id}{NC} ({team_name})")
            if local_creat:
                print(f"    - Ngày cấp          : {local_creat.strftime('%d/%m/%Y %H:%M:%S')}")
            print(f"    - Ngày hết hạn      : {local_exp.strftime('%d/%m/%Y %H:%M:%S')}")
            print(f"    - Thời gian còn lại : {rem_str}")
EOF

echo -e "\n${BOLD}${BLUE}======================================================================${NC}"
echo -e "${GREEN}Hoàn tất! Bạn có thể mở ứng dụng AppView trên iPhone ngay bây giờ.${NC}"
read -n 1 -s -r -p "Nhấn phím bất kỳ để đóng cửa sổ..."
echo ""

# Đóng cửa sổ Terminal hiện tại
osascript -e 'tell application "Terminal" to close front window' &>/dev/null &
exit 0
