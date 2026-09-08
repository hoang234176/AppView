import urllib.parse
import re
from typing import Optional
import httpx
from bs4 import BeautifulSoup
from config import Config
from logger import log_info, log_error, log_warning
from archive.contracts import ResolvedDownload

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
            resp = await client.get(url)
            if resp.status_code != 200:
                log_error("DOWNLOAD SERVICE", f"MediaFire trả về HTTP status {resp.status_code}")
                raise ValueError(f"Không thể truy cập MediaFire (HTTP {resp.status_code})")

            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Selector priority for direct download button
            download_btn = soup.select_one("a#downloadButton[href]") or soup.select_one("#download_link a#downloadButton")
            
            if not download_btn or not download_btn.get("href"):
                log_error("DOWNLOAD SERVICE", "Không tìm thấy nút downloadButton trong trang MediaFire")
                raise ValueError("Không tìm thấy liên kết tải MediaFire. Trang web có thể đã bị xóa hoặc hỏng.")

            download_url = download_btn["href"].strip()
            
            # Safety check: ensure download_url is valid http/https and not a share link
            parsed_dl = urllib.parse.urlparse(download_url)
            if parsed_dl.scheme not in ("http", "https") or "mediafire.com" not in parsed_dl.netloc.lower():
                raise ValueError("Liên kết tải MediaFire thu được không hợp lệ.")

            # Priority 1: Extract filename from HTML page (.dl-info .filename or .filename)
            filename: Optional[str] = None
            filename_elem = soup.select_one(".dl-info .filename") or soup.select_one(".filename") or soup.select_one("div.filename")
            if filename_elem and filename_elem.text.strip():
                filename = filename_elem.text.strip()

            # Priority 2: Fallback to unquoted path if HTML element not found
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
                extension=ext
            )
