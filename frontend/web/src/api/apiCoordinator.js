/**
 * API client giao tiếp với dịch vụ Coordinator (:8090)
 * Quản lý tập trung các Endpoints, Methods và Timeouts bằng hằng số VIẾT HOA.
 * Host và Port được truyền động từ phiên làm việc (Session), không dùng hằng số cố định.
 */

// 1. ENDPOINTS VIẾT HOA
export const HEALTH_CHECK_API = '/health';
export const VERIFY_COOKIES_API = '/api/v1/cookies/verify';
export const UPDATE_COOKIES_API = '/api/v1/cookies/update';
export const SAVE_COOKIES_API = '/api/v1/cookies/save';
export const GET_COOKIE_CONTENT_API = '/api/v1/cookies/content';
export const GET_TREE_FOLDER_API = '/api/v1/tree-folder';

// 2. HTTP METHODS VIẾT HOA
export const HTTP_METHOD_GET = 'GET';
export const HTTP_METHOD_POST = 'POST';

// 3. TIMEOUTS VIẾT HOA (Facebook & MXH timeout dài 65s)
export const DEFAULT_HEALTH_TIMEOUT_MS = 5000;
export const DEFAULT_VERIFY_TIMEOUT_MS = 65000;
export const DEFAULT_TREE_FOLDER_TIMEOUT_MS = 10000;

/**
 * Kiểm tra kết nối tới dịch vụ Coordinator qua endpoint GET /health
 * @param {string} host - Host hoặc IP từ session
 * @param {string|number} port - Cổng của Coordinator từ session
 * @param {number} timeoutMs - Thời gian chờ tối đa (mặc định: 5000ms)
 * @returns {Promise<{ ok: boolean, data?: { status: string, workers: number }, error?: string }>}
 */
export async function checkCoordinatorHealth(host, port, timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS) {
  const targetHost = String(host || '').trim();
  const targetPort = String(port || '').trim();

  if (!targetHost || !targetPort) {
    return {
      ok: false,
      error: 'Thiếu host hoặc port của Coordinator từ phiên làm việc (Session).',
    };
  }

  const url = `http://${targetHost}:${targetPort}${HEALTH_CHECK_API}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: HTTP_METHOD_GET,
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Server phản hồi lỗi HTTP ${response.status} (${response.statusText || 'Error'})`,
      };
    }

    const data = await response.json();
    return {
      ok: true,
      data,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        ok: false,
        error: `Hết thời gian kết nối (${Math.round(timeoutMs / 1000)}s). Vui lòng kiểm tra server.`,
      };
    }

    return {
      ok: false,
      error: err.message || 'Không thể kết nối tới Coordinator. Vui lòng đảm bảo server đang chạy.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Kiểm tra cookie của một nền tảng MXH qua Coordinator (POST /api/v1/cookies/verify)
 * Khi cookies rỗng, Coordinator sẽ đọc cookie từ Storage worker để verify.
 * Timeout được thiết lập dài (65s) vì quá trình xác thực Facebook/MXH cần nhiều thời gian.
 * @param {string} host - Host từ session
 * @param {string|number} port - Port từ session
 * @param {string} platform - Tên nền tảng (facebook, youtube, tiktok, instagram, x)
 * @param {string} cookies - Chuỗi Netscape cookies (hoặc để rỗng nếu kiểm tra cookie đã lưu)
 * @param {number} timeoutMs - Thời gian chờ tối đa (mặc định: 65000ms)
 * @returns {Promise<{ ok: boolean, valid?: boolean, message?: string, error?: string }>}
 */
export async function verifyCookiesApi(
  host,
  port,
  platform,
  cookies = '',
  timeoutMs = DEFAULT_VERIFY_TIMEOUT_MS
) {
  const targetHost = String(host || '').trim();
  const targetPort = String(port || '').trim();

  if (!targetHost || !targetPort) {
    return {
      ok: false,
      error: 'Thiếu host hoặc port của Coordinator từ phiên làm việc (Session).',
    };
  }

  const targetPlatform = String(platform || '').trim();
  if (!targetPlatform) {
    return {
      ok: false,
      error: 'Tên nền tảng (platform) là bắt buộc.',
    };
  }

  const url = `http://${targetHost}:${targetPort}${VERIFY_COOKIES_API}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: HTTP_METHOD_POST,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        platform: targetPlatform,
        cookies: typeof cookies === 'string' ? cookies : '',
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errMsg = data?.error || `Server phản hồi mã lỗi HTTP ${response.status}`;
      return {
        ok: false,
        valid: false,
        message: errMsg,
        error: errMsg,
      };
    }

    return {
      ok: true,
      valid: Boolean(data?.valid),
      message: data?.message || '',
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        ok: false,
        valid: false,
        error: `Quá trình xác thực ${targetPlatform} vượt quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`,
      };
    }

    return {
      ok: false,
      valid: false,
      error: err.message || 'Lỗi khi gửi yêu cầu kiểm tra cookie tới Coordinator.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cập nhật và làm mới cookie của một nền tảng MXH đã lưu qua Coordinator (POST /api/v1/cookies/update)
 * Coordinator sẽ đọc cookie từ Storage worker, kết nối MXH kiểm tra và tự động cập nhật session tokens mới nhất.
 * @param {string} host - Host từ session
 * @param {string|number} port - Port từ session
 * @param {string} platform - Tên nền tảng (facebook, youtube, tiktok, instagram, x)
 * @param {number} timeoutMs - Thời gian chờ tối đa (mặc định: 65000ms)
 * @returns {Promise<{ ok: boolean, valid?: boolean, message?: string, error?: string }>}
 */
export async function updateCookiesApi(
  host,
  port,
  platform,
  timeoutMs = DEFAULT_VERIFY_TIMEOUT_MS
) {
  const targetHost = String(host || '').trim();
  const targetPort = String(port || '').trim();

  if (!targetHost || !targetPort) {
    return {
      ok: false,
      error: 'Thiếu host hoặc port của Coordinator từ phiên làm việc (Session).',
    };
  }

  const targetPlatform = String(platform || '').trim();
  if (!targetPlatform) {
    return {
      ok: false,
      error: 'Tên nền tảng (platform) là bắt buộc.',
    };
  }

  const url = `http://${targetHost}:${targetPort}${UPDATE_COOKIES_API}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: HTTP_METHOD_POST,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        platform: targetPlatform,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errMsg = data?.error || `Server phản hồi mã lỗi HTTP ${response.status}`;
      return {
        ok: false,
        valid: false,
        message: errMsg,
        error: errMsg,
      };
    }

    return {
      ok: true,
      valid: Boolean(data?.valid),
      message: data?.message || '',
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        ok: false,
        valid: false,
        error: `Quá trình cập nhật ${targetPlatform} vượt quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`,
      };
    }

    return {
      ok: false,
      valid: false,
      error: err.message || 'Lỗi khi gửi yêu cầu cập nhật cookie tới Coordinator.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lưu/ghi đè file cookie mới của một nền tảng MXH qua Coordinator (POST /api/v1/cookies/save)
 * Coordinator sẽ yêu cầu Storage worker xóa/thay thế file cookie cũ và ghi mới toàn bộ các thuộc tính vừa nhập.
 * @param {string} host - Host từ session
 * @param {string|number} port - Port từ session
 * @param {string} platform - Tên nền tảng (facebook, youtube, tiktok, instagram, x)
 * @param {string} cookies - Chuỗi cookie định dạng Netscape
 * @param {number} timeoutMs - Thời gian chờ tối đa (mặc định: 15000ms)
 * @returns {Promise<{ ok: boolean, success?: boolean, error?: string }>}
 */
export async function saveCookiesApi(
  host,
  port,
  platform,
  cookies,
  timeoutMs = 15000
) {
  const targetHost = String(host || '').trim();
  const targetPort = String(port || '').trim();

  if (!targetHost || !targetPort) {
    return {
      ok: false,
      error: 'Thiếu host hoặc port của Coordinator từ phiên làm việc (Session).',
    };
  }

  const targetPlatform = String(platform || '').trim();
  if (!targetPlatform) {
    return {
      ok: false,
      error: 'Tên nền tảng (platform) là bắt buộc.',
    };
  }

  const url = `http://${targetHost}:${targetPort}${SAVE_COOKIES_API}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: HTTP_METHOD_POST,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        platform: targetPlatform,
        cookies: typeof cookies === 'string' ? cookies : '',
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errMsg = data?.error || `Server phản hồi mã lỗi HTTP ${response.status}`;
      return {
        ok: false,
        error: errMsg,
      };
    }

    return {
      ok: true,
      success: Boolean(data?.success),
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        ok: false,
        error: `Quá trình lưu cookie ${targetPlatform} vượt quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`,
      };
    }

    return {
      ok: false,
      error: err.message || 'Lỗi khi gửi yêu cầu lưu cookie tới Coordinator.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lấy nội dung cookie đã lưu của một nền tảng MXH qua Coordinator (GET /api/v1/cookies/content)
 * @param {string} host - Host từ session
 * @param {string|number} port - Port từ session
 * @param {string} platform - Tên nền tảng (facebook, youtube, tiktok, instagram, x)
 * @param {number} timeoutMs - Thời gian chờ tối đa (mặc định: 5000ms)
 * @returns {Promise<{ ok: boolean, exists?: boolean, cookies?: string, error?: string }>}
 */
export async function getCookieContentApi(
  host,
  port,
  platform,
  timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS
) {
  const targetHost = String(host || '').trim();
  const targetPort = String(port || '').trim();

  if (!targetHost || !targetPort) {
    return {
      ok: false,
      error: 'Thiếu host hoặc port của Coordinator từ phiên làm việc (Session).',
    };
  }

  const targetPlatform = String(platform || '').trim();
  if (!targetPlatform) {
    return {
      ok: false,
      error: 'Tên nền tảng (platform) là bắt buộc.',
    };
  }

  const url = `http://${targetHost}:${targetPort}${GET_COOKIE_CONTENT_API}?platform=${encodeURIComponent(targetPlatform)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: HTTP_METHOD_GET,
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        error: data?.error || `Server phản hồi mã lỗi HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      exists: Boolean(data?.exists),
      cookies: data?.cookies || '',
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        ok: false,
        error: `Hết thời gian chờ lấy cookie (${Math.round(timeoutMs / 1000)}s).`,
      };
    }

    return {
      ok: false,
      error: err.message || 'Lỗi kết nối khi lấy nội dung cookie.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lấy cây thư mục đệ quy của một ổ cứng qua Coordinator (GET /api/v1/tree-folder?drive=...)
 * @param {string} host - Host từ session
 * @param {string|number} port - Port từ session
 * @param {string} drive - Tên/ID ổ cứng (HDD, SSD...)
 * @param {number} timeoutMs - Thời gian chờ tối đa (mặc định: 10000ms)
 * @returns {Promise<{ ok: boolean, data?: Array, error?: string }>}
 */
export async function getFolderTreeApi(host, port, drive = '', timeoutMs = DEFAULT_TREE_FOLDER_TIMEOUT_MS) {
  const targetHost = String(host || '').trim();
  const targetPort = String(port || '').trim();

  if (!targetHost || !targetPort) {
    return {
      ok: false,
      error: 'Thiếu host hoặc port của Coordinator.',
    };
  }

  const query = drive ? `?drive=${encodeURIComponent(drive)}` : '';
  const url = `http://${targetHost}:${targetPort}${GET_TREE_FOLDER_API}${query}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: HTTP_METHOD_GET,
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Server phản hồi lỗi HTTP ${response.status}`,
      };
    }

    const json = await response.json();
    return {
      ok: true,
      data: Array.isArray(json?.data) ? json.data : [],
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        ok: false,
        error: `Hết thời gian tải cây thư mục (${Math.round(timeoutMs / 1000)}s).`,
      };
    }
    return {
      ok: false,
      error: err.message || 'Không thể lấy cây thư mục từ Coordinator.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  HEALTH_CHECK_API,
  VERIFY_COOKIES_API,
  UPDATE_COOKIES_API,
  GET_COOKIE_CONTENT_API,
  GET_TREE_FOLDER_API,
  HTTP_METHOD_GET,
  HTTP_METHOD_POST,
  DEFAULT_HEALTH_TIMEOUT_MS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  DEFAULT_TREE_FOLDER_TIMEOUT_MS,
  checkCoordinatorHealth,
  verifyCookiesApi,
  updateCookiesApi,
  getCookieContentApi,
  getFolderTreeApi,
};
