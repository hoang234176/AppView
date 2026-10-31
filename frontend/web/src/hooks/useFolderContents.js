import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useLayout from './useLayout';
import { getFolderContentsApi } from '../api/apiCoordinator';
import { resolveCoordinatorHostPort } from '../utils/cookieUtils';

// Bộ nhớ đệm nội dung thư mục toàn cục dùng chung
const globalFolderContentsCache = {};

export function setFolderContentsCache(key, data) {
  if (key && data) {
    globalFolderContentsCache[key] = data;
  }
}

export function getFolderContentsCache(key) {
  return globalFolderContentsCache[key];
}

/**
 * Custom Hook quản lý nội dung thư mục (folders, pictures, videos) từ Coordinator
 * Tuân thủ Quy tắc 8, 9, 10 của frontend/web/AGENTS.md
 * @param {string} driveId - ID ổ đĩa (HDD, SSD, ...)
 * @param {string} currentPath - Đường dẫn tương đối của thư mục
 * @returns {{
 *   data: object,
 *   folders: Array,
 *   pictures: Array,
 *   videos: Array,
 *   isLoading: boolean,
 *   error: string|null,
 *   refreshContents: () => Promise<void>
 * }}
 */
export default function useFolderContents(driveId = 'SSD', currentPath = '') {
  const { serverConfig, hasServerConnection, triggerNotification } = useLayout();
  const [contentsByCacheKey, setContentsByCacheKey] = useState(globalFolderContentsCache);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  // Chuẩn hóa tên/ID ổ cứng
  const normalizedDriveId = useMemo(() => {
    if (driveId === 'drive-1') return 'HDD';
    if (driveId === 'drive-2') return 'SSD';
    return driveId || 'SSD';
  }, [driveId]);

  const cleanPath = useMemo(() => {
    return String(currentPath || '').trim();
  }, [currentPath]);

  const cacheKey = useMemo(() => {
    return `${normalizedDriveId}:${cleanPath}`;
  }, [normalizedDriveId, cleanPath]);

  // Hàm tải dữ liệu nội dung thư mục với try...catch...finally đầy đủ (Quy tắc 8 & 9)
  const fetchContents = useCallback(async (targetDrive, targetPath) => {
    if (!hasServerConnection) return;
    const { host, port } = resolveCoordinatorHostPort(serverConfig);
    if (!host || !port) return;

    setIsLoading(true);
    setError(null);

    const key = `${targetDrive}:${targetPath}`;

    try {
      const res = await getFolderContentsApi(host, port, {
        drive: targetDrive,
        path: targetPath,
      });

      if (res.ok && res.data) {
        globalFolderContentsCache[key] = res.data;
        setContentsByCacheKey((prev) => ({
          ...prev,
          [key]: res.data,
        }));
      } else {
        const errMsg = res.error || `Cannot retrieve contents for ${targetDrive}/${targetPath}`;
        setError(errMsg);
        triggerNotification({
          type: 'error',
          title: 'Folder Content Error',
          message: errMsg,
        });
      }
    } catch (err) {
      const errMsg = err.message || `An error occurred while loading contents for ${targetDrive}/${targetPath}`;
      setError(errMsg);
      triggerNotification({
        type: 'error',
        title: 'Folder Content Error',
        message: errMsg,
      });
    } finally {
      setIsLoading(false);
    }
  }, [hasServerConnection, serverConfig, triggerNotification]);

  // Tự động tải nội dung khi chuyển đổi ổ đĩa hoặc đường dẫn
  useEffect(() => {
    if (!hasServerConnection) return;
    let isMounted = true;

    if (!contentsByCacheKey[cacheKey]) {
      Promise.resolve().then(() => {
        if (isMounted) {
          fetchContents(normalizedDriveId, cleanPath);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [hasServerConnection, normalizedDriveId, cleanPath, cacheKey, contentsByCacheKey, fetchContents]);

  // Lắng nghe sự kiện WebSocket realtime từ Coordinator (/ws/events)
  useEffect(() => {
    if (!hasServerConnection) return;
    let isMounted = true;
    const { host, port } = resolveCoordinatorHostPort(serverConfig);
    if (!host || !port) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${host}:${port}/ws/events`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const message = JSON.parse(event.data);
          if (message?.type === 'filesystem_event') {
            const fsEvent = message?.event;
            const targetDrive = fsEvent?.drive || normalizedDriveId;
            if (targetDrive === normalizedDriveId) {
              fetchContents(normalizedDriveId, cleanPath);
            }
          }
        } catch {
          // Bỏ qua lỗi JSON
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Bỏ qua lỗi kết nối
    }

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [hasServerConnection, serverConfig, normalizedDriveId, cleanPath, fetchContents]);

  const currentData = contentsByCacheKey[cacheKey] || null;

  return {
    data: currentData,
    folders: currentData?.folders || [],
    pictures: currentData?.pictures || [],
    videos: currentData?.videos || [],
    isLoading: isLoading && !currentData,
    isRefreshing: isLoading,
    error,
    refreshContents: () => fetchContents(normalizedDriveId, cleanPath),
  };
}
