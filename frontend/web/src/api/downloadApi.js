import axios from 'axios';
import { getCoordinatorApiBaseUrl, getDownloadApiBaseUrl, getDownloadWsUrl } from './axiosConfig';

const createDownloadClient = () => {
  return axios.create({
    baseURL: getDownloadApiBaseUrl(),
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

const createCoordinatorClient = () => {
  const baseURL = getCoordinatorApiBaseUrl();
  if (!baseURL) {
    throw new Error('Chưa cấu hình VITE_COORDINATOR_API_BASE_URL.');
  }
  return axios.create({
    baseURL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * Submit one parent Coordinator download job. Legacy Python endpoints below
 * remain available only for compatibility controls that have not migrated.
 */
export const startArchiveDownload = async (url, destination = '', password = null) => {
  try {
    const response = await createCoordinatorClient().post('/download', {
      url,
      destination,
      ...(password ? { password } : {}),
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Lỗi khởi tạo download:', error);
    let message = 'Không thể kết nối đến Coordinator.';
    let code = 'COORDINATOR_ERROR';
    if (typeof error.response?.data?.error === 'string') {
      message = error.response.data.error;
    } else if (error.response?.data?.error) {
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

export const fetchCoordinatorDownload = async (jobId) => {
  try {
    const response = await createCoordinatorClient().get(`/download/${encodeURIComponent(jobId)}`);
    return { success: true, data: response.data };
  } catch (error) {
    const errorData = error.response?.data?.error;
    return {
      success: false,
      message: typeof errorData === 'string' ? errorData : errorData?.message || 'Không thể cập nhật tiến trình tải.',
    };
  }
};

export const fetchCoordinatorDownloads = async () => {
  try {
    const response = await createCoordinatorClient().get('/download');
    return { success: true, data: Array.isArray(response.data?.jobs) ? response.data.jobs : [] };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || 'Không thể tải lịch sử download.' };
  }
};
export const fetchCoordinatorStorageInfo = async () => {
  try { const response = await createCoordinatorClient().get('/storage'); return { success: true, data: response.data }; }
  catch (error) { return { success: false, message: error.response?.data?.error || 'Không thể đọc dung lượng Storage.' }; }
};

export const retryCoordinatorArchive = async (jobId) => {
  try { await createCoordinatorClient().post(`/download/${encodeURIComponent(jobId)}/retry`); return { success: true }; }
  catch (error) { return { success: false, message: error.response?.data?.error || 'Không thể tải tiếp tác vụ.' }; }
};
export const submitCoordinatorArchivePassword = async (jobId, password) => {
  try { await createCoordinatorClient().post(`/download/${encodeURIComponent(jobId)}/extract`, { password }); return { success: true }; }
  catch (error) { return { success: false, message: error.response?.data?.error || 'Mật khẩu không hợp lệ.' }; }
};
export const cancelCoordinatorArchive = async (jobId) => {
  try { await createCoordinatorClient().post(`/download/${encodeURIComponent(jobId)}/cancel`); return { success: true }; }
  catch (error) { return { success: false, message: error.response?.data?.error || 'Không thể hủy tác vụ.' }; }
};
export const submitVideoDecision = async (jobId, videoId, quality) => {
  try { await createCoordinatorClient().post(`/download/${encodeURIComponent(jobId)}/videos/${encodeURIComponent(videoId)}/decision`, { quality }); return { success: true }; }
  catch (error) { return { success: false, message: error.response?.data?.error || 'Không thể lưu lựa chọn video.' }; }
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
