import axios from 'axios';

const trimTrailingSlashes = (value) => value.replace(/\/+$/, '');
const viteValue = (name, fallback) => {
  const value = import.meta.env[name];
  return trimTrailingSlashes(value && value.trim() ? value.trim() : fallback);
};

// Fixed ports — not user-configurable. Coordinator is always :8090; legacy
// Python Download stays on :5002. These are source-of-truth constants.
export const COORDINATOR_PORT = '8090';
export const PYTHON_DOWNLOAD_PORT = '5002';
// Storage port default kept for Vite fallback compatibility.
const STORAGE_PORT_DEFAULT = '8080';

export const DEFAULT_SERVER_HOST = 'localhost';
export const DEFAULT_API_BASE_URL = viteValue('VITE_STORAGE_API_BASE_URL', `http://localhost:${STORAGE_PORT_DEFAULT}/api/v1`);
export const DEFAULT_DOWNLOAD_API_BASE_URL = viteValue('VITE_DOWNLOAD_API_BASE_URL', `http://localhost:${PYTHON_DOWNLOAD_PORT}/api/v1/download`);
export const DEFAULT_DOWNLOAD_WS_URL = viteValue('VITE_DOWNLOAD_WS_URL', `ws://localhost:${PYTHON_DOWNLOAD_PORT}/api/v1/download/ws`);
// Coordinator is intentionally configured independently from the legacy
// Python download API.  A deployment must provide this public Vite value.
export const DEFAULT_COORDINATOR_API_BASE_URL = viteValue('VITE_COORDINATOR_API_BASE_URL', '');

// ---------------------------------------------------------------------------
// Persisted settings — localStorage keys
// ---------------------------------------------------------------------------
// Legacy keys preserved for migration reads; new saves use appview_server_host.
const KEY_HOST = 'appview_server_host';
const KEY_LEGACY_IP = 'appview_server_ip';
const KEY_LEGACY_PORT = 'appview_server_port';
// Root path is no longer read by the frontend; key kept only to avoid
// corrupting saved settings that other tools may have written.
const KEY_LEGACY_ROOT_PATH = 'appview_root_folder_path';

/**
 * Return the saved Server Host, falling back to any legacy saved IP, then the
 * default.  Port and root path are no longer read.
 */
export const getServerHost = () => {
  const saved = localStorage.getItem(KEY_HOST);
  if (saved && saved.trim()) return saved.trim();
  // Migrate: use existing saved IP as the host when no new key yet.
  const legacyIp = localStorage.getItem(KEY_LEGACY_IP);
  if (legacyIp && legacyIp.trim()) return legacyIp.trim();
  return DEFAULT_SERVER_HOST;
};

// ---------------------------------------------------------------------------
// Legacy accessors — kept for compatibility with existing callers in App.jsx.
// Both delegate to getServerHost so nothing breaks.
// ---------------------------------------------------------------------------
/** @deprecated Use getServerHost() */
export const getServerIp = () => getServerHost();
/** @deprecated Port is fixed; returns COORDINATOR_PORT for Coordinator calls. */
export const getServerPort = () => COORDINATOR_PORT;
/** @deprecated Root path no longer belongs to frontend. Returns ''. */
export const getRootFolderPath = () => '';

/**
 * Server is considered configured when a non-empty host has been saved.
 * Port and root path are no longer required.
 */
export const isServerConfigured = () => {
  const host = getServerHost();
  return Boolean(host && host.trim());
};

// ---------------------------------------------------------------------------
// URL construction — single source of truth per service
// ---------------------------------------------------------------------------

export const getApiBaseUrl = () => {
  if (!isServerConfigured()) return DEFAULT_API_BASE_URL;
  const host = getServerHost();
  // Storage still runs on its own port; derive from VITE env or default 8080.
  const storageBase = DEFAULT_API_BASE_URL;
  // If VITE_STORAGE_API_BASE_URL was customised, use it directly.
  if (import.meta.env.VITE_STORAGE_API_BASE_URL && import.meta.env.VITE_STORAGE_API_BASE_URL.trim()) {
    return storageBase;
  }
  return `http://${host}:${STORAGE_PORT_DEFAULT}/api/v1`;
};

export const getDownloadApiBaseUrl = () => {
  if (!isServerConfigured()) return DEFAULT_DOWNLOAD_API_BASE_URL;
  const host = getServerHost();
  return `http://${host}:${PYTHON_DOWNLOAD_PORT}/api/v1/download`;
};

export const getDownloadWsUrl = () => {
  if (!isServerConfigured()) return DEFAULT_DOWNLOAD_WS_URL;
  const host = getServerHost();
  return `ws://${host}:${PYTHON_DOWNLOAD_PORT}/api/v1/download/ws`;
};

export const getCoordinatorApiBaseUrl = () => {
  if (DEFAULT_COORDINATOR_API_BASE_URL) return DEFAULT_COORDINATOR_API_BASE_URL;
  if (!isServerConfigured()) return '';
  return `http://${getServerHost()}:${COORDINATOR_PORT}/api/v1`;
};

// The Coordinator HTTP base includes `/api/v1`; its frontend invalidation
// socket is intentionally mounted at the service root.
export const getCoordinatorEventsWsUrl = () => {
  const baseUrl = getCoordinatorApiBaseUrl();
  if (!baseUrl) return '';
  try {
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '')}/ws/events`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
};

// ---------------------------------------------------------------------------
// Save — persists only host; obsolete fields are left untouched so existing
// data is not corrupted, but they are no longer depended upon.
// ---------------------------------------------------------------------------

/**
 * Perform a lightweight Coordinator health/identity validation for a candidate host.
 * Returns { success: true } or { success: false, message: string }.
 * Does NOT persist or apply settings.
 */
export const validateCoordinatorHost = async (rawHost) => {
  const cleanHost = String(rawHost || '').trim();
  if (!cleanHost) {
    return { success: false, message: 'Vui lòng nhập Server Host (hostname hoặc địa chỉ IP).' };
  }

  const url = `http://${cleanHost}:${COORDINATOR_PORT}/health`;
  try {
    const response = await axios.get(url, { timeout: 5000 });
    if (response.status === 200 && response.data && response.data.status === 'ok') {
      return { success: true };
    }
    return {
      success: false,
      message: `Phản hồi từ ${cleanHost} không phải là máy chủ Coordinator (HTTP ${response.status}).`,
    };
  } catch (error) {
    let msg = `Không thể kết nối đến máy chủ ${cleanHost}:${COORDINATOR_PORT}.`;
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      msg = `Kết nối đến ${cleanHost} bị quá thời gian (Timeout). Vui lòng kiểm tra lại địa chỉ máy chủ.`;
    } else if (error.response) {
      msg = `Máy chủ ${cleanHost} phản hồi lỗi HTTP ${error.response.status}.`;
    }
    return { success: false, message: msg };
  }
};

/**
 * Save the server configuration. Only `host` is required/used.
 * Legacy `port` and `rootFolderPath` parameters are accepted but ignored so
 * existing call-sites do not break; they are not written.
 */
export const saveServerConfig = (host, _portIgnored, _rootPathIgnored) => {
  const cleanHost = (host || DEFAULT_SERVER_HOST).trim();
  localStorage.setItem(KEY_HOST, cleanHost);
  // Write to the legacy key too so older sessions still work.
  localStorage.setItem(KEY_LEGACY_IP, cleanHost);
  const coordinatorBase = `http://${cleanHost}:${COORDINATOR_PORT}/api/v1`;
  localStorage.setItem('appview_api_base_url', coordinatorBase);
  return { host: cleanHost, baseUrl: coordinatorBase };
};

// Create dynamic axios instance
export const createApiClient = () => {
  const baseURL = getApiBaseUrl();
  return axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      // X-Root-Folder-Path header no longer sent; backend uses its own ROOT_PATH.
    },
  });
};
