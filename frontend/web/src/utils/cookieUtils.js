/**
 * Tiện ích xử lý cú pháp và phân tích cookie cho các nền tảng mạng xã hội.
 * Tách biệt logic thuần (pure functions) để dễ quản lý, bảo trì và kiểm thử.
 */

export const SOCIAL_PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook',
    iconModifier: 'facebook',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    iconModifier: 'instagram',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    iconModifier: 'tiktok',
  },
  {
    id: 'x',
    name: 'X',
    iconModifier: 'x',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    iconModifier: 'youtube',
  },
];

/**
 * Phân tích nội dung Netscape HTTP Cookie và xác định trạng thái (empty, active, expired, invalid)
 * Định dạng chuẩn: domain \t include_sub \t path \t is_secure \t expiry \t name \t value
 * @param {string} rawText
 * @returns {{ status: 'empty' | 'active' | 'expired' | 'invalid', cookieCount: number, expiredCount: number, message?: string }}
 */
export function parseNetscapeCookies(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return { status: 'empty', cookieCount: 0, expiredCount: 0 };
  }

  const lines = rawText.split('\n');
  const validCookies = [];
  const now = Math.floor(Date.now() / 1000);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Tách theo tab hoặc ít nhất 2 khoảng trắng liên tiếp
    const parts = line.split(/\t+|\s{2,}/);
    if (parts.length >= 6) {
      const expiry = parseInt(parts[4], 10);
      const isTimestamp = !isNaN(expiry);
      validCookies.push({
        domain: parts[0],
        path: parts[2],
        expiry: isTimestamp ? expiry : 0,
        name: parts[parts.length - 2] || parts[5],
        value: parts[parts.length - 1] || parts[6],
      });
    }
  }

  if (validCookies.length === 0) {
    if (rawText.includes('# Netscape HTTP Cookie File')) {
      return { status: 'empty', cookieCount: 0, expiredCount: 0 };
    }
    return { status: 'invalid', message: 'No valid Netscape cookie entries found.' };
  }

  let expiredCount = 0;
  let hasValidUnexpired = false;

  for (const cookie of validCookies) {
    if (cookie.expiry > 0) {
      if (cookie.expiry < now) {
        expiredCount++;
      } else {
        hasValidUnexpired = true;
      }
    } else {
      // Session cookie (expiry = 0) luôn được coi là hợp lệ
      hasValidUnexpired = true;
    }
  }

  if (!hasValidUnexpired && expiredCount > 0) {
    return { status: 'expired', cookieCount: validCookies.length, expiredCount };
  }

  return { status: 'active', cookieCount: validCookies.length, expiredCount };
}

/**
 * Lấy host và port của Server Coordinator từ session state hoặc fallback localStorage
 * @param {object} serverConfig
 * @returns {{ host: string, port: string }}
 */
export function resolveCoordinatorHostPort(serverConfig) {
  let host = serverConfig?.coordinator?.host ? String(serverConfig.coordinator.host).trim() : '';
  let port = serverConfig?.coordinator?.port ? String(serverConfig.coordinator.port).trim() : '';
  if (!host || !port) {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('setting');
        if (raw) {
          const parsed = JSON.parse(raw);
          const coord = parsed?.['connect-server']?.coordinator || parsed?.['connect-server'];
          if (!host && coord?.host) host = String(coord.host).trim();
          if (!port && coord?.port) port = String(coord.port).trim();
        }
      }
    } catch {
      // Bỏ qua lỗi parse
    }
  }
  return { host, port };
}

/**
 * Đánh giá phản hồi cập nhật cookie từ Coordinator và trả về trạng thái cùng thông báo tương ứng
 * @param {object} res - Phản hồi từ updateCookiesApi
 * @param {string} platformName - Tên hiển thị của nền tảng
 * @returns {{ nextStatus: 'active' | 'empty' | 'expired', notification: object | null }}
 */
export function evaluateCookieUpdateResult(res, platformName) {
  if (!res.ok) {
    return {
      nextStatus: 'empty',
      notification: {
        type: 'error',
        title: 'Update Error',
        message: res.error || `Failed to update ${platformName} cookies.`,
      },
    };
  }

  if (res.valid) {
    return {
      nextStatus: 'active',
      notification: {
        type: 'success',
        title: 'Cookies Updated',
        message: `Cookies for ${platformName} are updated and active.`,
      },
    };
  }

  const msg = (res.message || '').toLowerCase();
  const isEmpty =
    msg.includes('no cookies') ||
    msg.includes('trống') ||
    msg.includes('empty') ||
    msg.includes('chưa có') ||
    msg.includes('không tồn tại');

  const nextStatus = isEmpty ? 'empty' : 'expired';
  return {
    nextStatus,
    notification: {
      type: isEmpty ? 'error' : 'warning',
      title: isEmpty ? 'No Cookies Set' : 'Cookies Expired',
      message: isEmpty
        ? `No cookies configured for ${platformName}.`
        : `Cookies for ${platformName} are invalid or expired.`,
    },
  };
}
