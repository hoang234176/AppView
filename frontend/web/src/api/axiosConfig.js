import axios from 'axios';

const trimTrailingSlashes = (value) => value.replace(/\/+$/, '');
const viteValue = (name, fallback) => {
  const value = import.meta.env[name];
  return trimTrailingSlashes(value && value.trim() ? value.trim() : fallback);
};

export const DEFAULT_SERVER_IP = 'localhost';
export const DEFAULT_SERVER_PORT = '8080';
export const DEFAULT_ROOT_FOLDER_PATH = '';
export const DEFAULT_API_BASE_URL = viteValue('VITE_STORAGE_API_BASE_URL', 'http://localhost:8080/api/v1');
export const DEFAULT_DOWNLOAD_API_BASE_URL = viteValue('VITE_DOWNLOAD_API_BASE_URL', 'http://localhost:5002/api/v1/download');
export const DEFAULT_DOWNLOAD_WS_URL = viteValue('VITE_DOWNLOAD_WS_URL', 'ws://localhost:5002/api/v1/download/ws');

export const PYTHON_DOWNLOAD_PORT = '5002';

export const getServerIp = () => {
  const saved = localStorage.getItem('appview_server_ip');
  if (!saved || !saved.trim()) return DEFAULT_SERVER_IP;
  return saved.trim();
};

export const getServerPort = () => {
  return localStorage.getItem('appview_server_port') || DEFAULT_SERVER_PORT;
};

export const getRootFolderPath = () => {
  return localStorage.getItem('appview_root_folder_path') ?? '';
};

export const isServerConfigured = () => {
  const ip = localStorage.getItem('appview_server_ip');
  const port = localStorage.getItem('appview_server_port');
  const rootPath = localStorage.getItem('appview_root_folder_path');
  return Boolean(ip && ip.trim() && port && port.trim() && rootPath && rootPath.trim());
};

export const getApiBaseUrl = () => {
  const savedIp = localStorage.getItem('appview_server_ip');
  const savedPort = localStorage.getItem('appview_server_port');
  if (!savedIp || !savedIp.trim() || !savedPort || !savedPort.trim()) {
    return DEFAULT_API_BASE_URL;
  }
  const ip = getServerIp();
  const port = getServerPort();
  return `http://${ip}:${port}/api/v1`;
};

export const getDownloadApiBaseUrl = () => {
  const savedIp = localStorage.getItem('appview_server_ip');
  if (!savedIp || !savedIp.trim()) return DEFAULT_DOWNLOAD_API_BASE_URL;
  const ip = getServerIp();
  return `http://${ip}:${PYTHON_DOWNLOAD_PORT}/api/v1/download`;
};

export const getDownloadWsUrl = () => {
  const savedIp = localStorage.getItem('appview_server_ip');
  if (!savedIp || !savedIp.trim()) return DEFAULT_DOWNLOAD_WS_URL;
  const ip = getServerIp();
  return `ws://${ip}:${PYTHON_DOWNLOAD_PORT}/api/v1/download/ws`;
};

export const saveServerConfig = (ip, port, rootFolderPath) => {
  const cleanIp = (ip || DEFAULT_SERVER_IP).trim();
  const cleanPort = (port || DEFAULT_SERVER_PORT).trim();
  let cleanRootPath = (rootFolderPath || '').trim();
  cleanRootPath = cleanRootPath.replace(/^["']|["']$/g, '').trim();

  localStorage.setItem('appview_server_ip', cleanIp);
  localStorage.setItem('appview_server_port', cleanPort);
  localStorage.setItem('appview_root_folder_path', cleanRootPath);
  const baseUrl = `http://${cleanIp}:${cleanPort}/api/v1`;
  localStorage.setItem('appview_api_base_url', baseUrl);
  return { ip: cleanIp, port: cleanPort, rootFolderPath: cleanRootPath, baseUrl };
};

// Create dynamic axios instance
export const createApiClient = () => {
  const baseURL = getApiBaseUrl();
  const rootFolderPath = getRootFolderPath();
  const safeHeaderPath = rootFolderPath ? encodeURIComponent(rootFolderPath) : '';
  return axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      'X-Root-Folder-Path': safeHeaderPath,
    },
  });
};
