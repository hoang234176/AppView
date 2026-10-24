/**
 * API client giao tiếp với dịch vụ Coordinator (:8090)
 */

/**
 * Kiểm tra kết nối tới dịch vụ Coordinator qua endpoint GET /health
 * @param {string} host - Host hoặc IP của server (mặc định: 127.0.0.1)
 * @param {string|number} port - Cổng của Coordinator (mặc định: 8090)
 * @param {number} timeoutMs - Thời gian chờ tối đa (mặc định: 5000ms)
 * @returns {Promise<{ ok: boolean, data?: { status: string, workers: number }, error?: string }>}
 */
export async function checkCoordinatorHealth(host = '127.0.0.1', port = '8090', timeoutMs = 5000) {
  const targetHost = host || '127.0.0.1';
  const targetPort = port || '8090';
  const url = `http://${targetHost}:${targetPort}/health`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Server phản hồi mã lỗi HTTP ${response.status} (${response.statusText || 'Error'})`,
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
        error: `Kết nối quá thời gian chờ (${Math.round(timeoutMs / 1000)}s). Vui lòng kiểm tra lại server.`,
      };
    }

    return {
      ok: false,
      error: err.message || 'Không thể kết nối đến máy chủ. Hãy chắc chắn server đang chạy và không bị chặn bởi tường lửa.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  checkCoordinatorHealth,
};
