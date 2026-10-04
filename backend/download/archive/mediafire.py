import asyncio
import re
import urllib.parse
from typing import Any, Optional
import httpx
from bs4 import BeautifulSoup
from config import Config
from logger import log_info, log_error, log_warning
from archive.contracts import ResolvedDownload


def extract_part_index(name: str) -> int:
    m = re.search(r"\.part(\d+)\.", name, re.IGNORECASE)
    if m:
        return int(m.group(1))
    m = re.search(r"\.7z\.(\d+)$", name, re.IGNORECASE)
    if m:
        return int(m.group(1))
    m = re.search(r"\.z(\d+)$", name, re.IGNORECASE)
    if m:
        return int(m.group(1))
    m = re.search(r"\.r(\d+)$", name, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return 1


def extract_archive_basename(name: str) -> str:
    cleaned = re.sub(r"\.part\d+\.rar$", "", name, flags=re.IGNORECASE)
    cleaned = re.sub(r"\.7z\.\d+$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\.z\d+$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\.rar$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\.zip$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\.7z$", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip() or name


async def resolve_single_archive(url: str, client: httpx.AsyncClient) -> ResolvedDownload:
    """Giải mã liên kết file MediaFire đơn lẻ."""
    resp = await client.get(url)
    if resp.status_code != 200:
        log_error("DOWNLOAD SERVICE", f"MediaFire trả về HTTP status {resp.status_code}")
        raise ValueError(f"Không thể truy cập MediaFire (HTTP {resp.status_code})")

    soup = BeautifulSoup(resp.text, "html.parser")
    download_btn = soup.select_one("a#downloadButton[href]") or soup.select_one("#download_link a#downloadButton")
    if not download_btn or not download_btn.get("href"):
        log_error("DOWNLOAD SERVICE", "Không tìm thấy nút downloadButton trong trang MediaFire")
        raise ValueError("Không tìm thấy liên kết tải MediaFire. Trang web có thể đã bị xóa hoặc hỏng.")

    download_url = download_btn["href"].strip()
    parsed_dl = urllib.parse.urlparse(download_url)
    if parsed_dl.scheme not in ("http", "https") or "mediafire.com" not in parsed_dl.netloc.lower():
        raise ValueError("Liên kết tải MediaFire thu được không hợp lệ.")

    filename: Optional[str] = None
    filename_elem = soup.select_one(".dl-info .filename") or soup.select_one(".filename") or soup.select_one("div.filename")
    if filename_elem and filename_elem.text.strip():
        filename = filename_elem.text.strip()

    if not filename:
        unquoted_path = urllib.parse.unquote_plus(parsed_dl.path)
        filename = unquoted_path.split("/")[-1] if "/" in unquoted_path else "file.archive"

    filename = urllib.parse.unquote_plus(filename).strip() or "file.archive"
    ext = filename.split(".")[-1].lower() if "." in filename else "rar"

    log_info("DOWNLOAD SERVICE", f"Tìm thấy tệp MediaFire chính xác: '{filename}' -> Direct URL: {download_url}")
    return ResolvedDownload(
        original_url=url,
        download_url=download_url,
        filename=filename,
        extension=ext,
        source="archive",
        archive_type="single",
    )


async def resolve_multipart_archive(url: str, client: httpx.AsyncClient) -> ResolvedDownload:
    """Giải mã thư mục MediaFire chứa nhiều part và gom thành gói tải multipart."""
    log_info("DOWNLOAD SERVICE", f"Đang phân tích MediaFire Folder: {url}")
    match = re.search(r"/folder/([a-zA-Z0-9]+)", url)
    if not match:
        raise ValueError("Không thể nhận diện mã thư mục MediaFire (folder_key).")
    folder_key = match.group(1)

    api_url = f"https://www.mediafire.com/api/1.5/folder/get_content.php?folder_key={folder_key}&content_type=files&response_format=json"
    api_resp = await client.get(api_url)
    if api_resp.status_code != 200:
        raise ValueError(f"Không thể truy vấn nội dung thư mục MediaFire (HTTP {api_resp.status_code})")

    data = api_resp.json()
    response_data = data.get("response", {})
    if response_data.get("result") != "Success":
        err_msg = response_data.get("message", "Thư mục MediaFire không tồn tại hoặc đã bị khóa.")
        raise ValueError(f"Lỗi đọc MediaFire Folder: {err_msg}")

    files_list = response_data.get("folder_content", {}).get("files", [])
    if not files_list:
        raise ValueError("Thư mục MediaFire trống hoặc không có tệp tải về.")

    log_info("DOWNLOAD SERVICE", f"Tìm thấy {len(files_list)} tệp trong MediaFire folder. Đang lấy link tải trực tiếp song song...")

    async def _resolve_file_item(file_info: dict[str, Any]) -> dict[str, Any]:
        normal_link = file_info.get("links", {}).get("normal_download") or f"https://www.mediafire.com/file/{file_info.get('quickkey')}"
        raw_name = file_info.get("filename", "")
        file_size = int(file_info.get("size", 0))
        resolved_file = await resolve_single_archive(normal_link, client)
        return {
            "filename": resolved_file.filename or raw_name,
            "download_url": resolved_file.download_url,
            "size": file_size,
            "part_index": extract_part_index(resolved_file.filename or raw_name),
        }

    resolved_items = await asyncio.gather(*(_resolve_file_item(f) for f in files_list))

    # Sort parts naturally (part1 before part2, etc.)
    sorted_items = sorted(resolved_items, key=lambda it: it.get("part_index", 1))

    base_name = extract_archive_basename(sorted_items[0]["filename"])
    ext = sorted_items[0]["filename"].split(".")[-1].lower() if "." in sorted_items[0]["filename"] else "rar"

    log_info("DOWNLOAD SERVICE", f"Đã giải mã thành công bộ multipart: '{base_name}' ({len(sorted_items)} parts)")

    return ResolvedDownload(
        original_url=url,
        download_url=sorted_items[0]["download_url"],
        filename=base_name,
        extension=ext,
        source="archive",
        items=sorted_items,
        archive_type="multipart",
    )


class MediaFireResolver:
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
    }

    def supports(self, url: str) -> bool:
        try:
            parsed = urllib.parse.urlparse(url.strip())
            return parsed.scheme in ("http", "https") and "mediafire.com" in parsed.netloc.lower()
        except Exception:
            return False

    async def resolve(self, url: str) -> ResolvedDownload:
        log_info("DOWNLOAD SERVICE", f"Đang phân tích MediaFire URL: {url}")

        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL phải bắt đầu bằng http:// hoặc https://")
        if "mediafire.com" not in parsed.netloc.lower():
            raise ValueError("Chỉ hỗ trợ liên kết MediaFire (mediafire.com)")

        async with httpx.AsyncClient(headers=self.HEADERS, follow_redirects=True, timeout=Config.RESOLVE_TIMEOUT) as client:
            if "/folder/" in parsed.path.lower():
                return await resolve_multipart_archive(url, client)
            return await resolve_single_archive(url, client)
