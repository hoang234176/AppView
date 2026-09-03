import axios from 'axios';
import { getDownloadApiBaseUrl, getDownloadWsUrl } from './axiosConfig';

const createDownloadClient = () => {
  return axios.create({
    baseURL: getDownloadApiBaseUrl(),
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

/**
 * Submit a MediaFire URL for download and extraction
 * Endpoint: POST /archive
 */
export const startArchiveDownload = async (url, destination = '', password = null) => {
  const client = createDownloadClient();
  try {
    const response = await client.post('/archive', {
      url,
      destination,
      password: password || null,
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Lỗi khởi tạo download:', error);
    let message = 'Không thể kết nối đến máy chủ Download.';
    let code = 'DOWNLOAD_SERVICE_ERROR';
    if (error.response?.data?.error) {
      message = error.response.data.error.message || message;
      code = error.response.data.error.code || code;
    }
    return {
      success: false,
      message,
      code,
    };
  }
};

/**
 * Fetch all tasks
 * Endpoint: GET /tasks
 */
export const fetchDownloadTasks = async () => {
  const client = createDownloadClient();
  try {
    const response = await client.get('/tasks');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Lỗi danh sách task download:', error);
    return { success: false, data: [] };
  }
};

/**
 * Submit new password to retry extraction
 * Endpoint: POST /tasks/{task_id}/password
 */
export const submitTaskPassword = async (taskId, password) => {
  const client = createDownloadClient();
  try {
    const response = await client.post(`/tasks/${taskId}/password`, { password });
    return {
      success: true,
      message: response.data?.message || 'Đã gửi mật khẩu',
    };
  } catch (error) {
    console.error('Lỗi gửi mật khẩu:', error);
    let message = 'Không thể thử lại mật khẩu.';
    if (error.response?.data?.error?.message) {
      message = error.response.data.error.message;
    }
    return { success: false, message };
  }
};

/**
 * Retry failed task (resolves from existing temp archive file if available)
 * Endpoint: POST /tasks/{task_id}/retry
 */
export const retryDownloadTask = async (taskId) => {
  const client = createDownloadClient();
  try {
    const response = await client.post(`/tasks/${taskId}/retry`);
    return {
      success: true,
      message: response.data?.message || 'Đang thử giải nén lại',
    };
  } catch (error) {
    console.error('Lỗi thử lại task:', error);
    return { success: false, message: 'Không thể thử lại' };
  }
};

/**
 * Cancel download/extraction task
 * Endpoint: POST /tasks/{task_id}/cancel
 */
export const cancelDownloadTask = async (taskId) => {
  const client = createDownloadClient();
  try {
    const response = await client.post(`/tasks/${taskId}/cancel`);
    return {
      success: true,
      message: response.data?.message || 'Đã hủy task',
    };
  } catch (error) {
    console.error('Lỗi hủy task:', error);
    return { success: false, message: 'Không thể hủy task' };
  }
};

/**
 * Delete task
 * Endpoint: DELETE /tasks/{task_id}
 */
export const deleteDownloadTask = async (taskId) => {
  const client = createDownloadClient();
  try {
    const response = await client.delete(`/tasks/${taskId}`);
    return {
      success: true,
      message: response.data?.message || 'Đã xóa task',
    };
  } catch (error) {
    console.error('Lỗi xóa task:', error);
    return { success: false, message: 'Không thể xóa task' };
  }
};

/**
 * Fetch summary status
 * Endpoint: GET /summary
 */
export const fetchDownloadSummary = async () => {
  const client = createDownloadClient();
  try {
    const response = await client.get('/summary');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return { success: false, data: null };
  }
};

/**
 * Connect to Download Service WebSocket with auto-reconnect
 */
export class DownloadWebSocketClient {
  constructor(onEventCallback) {
    this.onEvent = onEventCallback;
    this.ws = null;
    this.reconnectTimer = null;
    this.isClosedManually = false;
  }

  connect() {
    this.isClosedManually = false;
    // Không mở chồng nhiều socket khi React re-render hoặc khi timer reconnect
    // chưa kịp bị hủy. Hai kết nối chồng lên nhau là nguyên nhân log open/close
    // lặp và một socket bị đóng ngay lúc đang CONNECTING.
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    const wsUrl = getDownloadWsUrl();
    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws || this.isClosedManually) return;
        console.log('[WS DOWNLOAD] Đã kết nối thành công:', wsUrl);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      ws.onmessage = (event) => {
        if (this.ws !== ws) return;
        try {
          const data = JSON.parse(event.data);
          if (this.onEvent) this.onEvent(data);
        } catch (e) {
          console.error('[WS DOWNLOAD] Lỗi parse JSON event:', e);
        }
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        if (!this.isClosedManually) {
          console.warn('[WS DOWNLOAD] Kết nối bị ngắt, đang thử lại sau 3s...');
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      };

      ws.onerror = (err) => {
        if (this.ws !== ws || this.isClosedManually) return;
        console.error('[WS DOWNLOAD] Lỗi kết nối WebSocket:', err);
        // Browser sẽ tự phát onclose sau onerror. Không close chủ động ở đây
        // vì nó dễ tạo thêm một close/reconnect trùng lặp.
      };
    } catch (e) {
      console.error('[WS DOWNLOAD] Lỗi khởi tạo WebSocket:', e);
      if (!this.isClosedManually) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    }
  }

  disconnect() {
    this.isClosedManually = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      try {
        // Hủy handler trước khi đóng: cleanup của React (đặc biệt StrictMode)
        // không được phép kích hoạt reconnect cho socket đang CONNECTING.
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      } catch (_) {}
    }
  }
}
