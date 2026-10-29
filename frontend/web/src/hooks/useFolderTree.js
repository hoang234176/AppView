import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useLayout from './useLayout';
import { getFolderTreeApi } from '../api/apiCoordinator';
import { resolveCoordinatorHostPort } from '../utils/cookieUtils';

/**
 * Custom Hook quản lý trạng thái, tải dữ liệu và đồng bộ Realtime cho Cây thư mục (Folder Tree)
 * Tuân thủ quy tắc 8, 9 và 10 của frontend/web/AGENTS.md
 * @param {string} activeDriveId - ID ổ đĩa hiện tại (HDD, SSD, ...)
 * @returns {{
 *   folders: Array,
 *   normalizedDriveId: string,
 *   isFetchingTree: boolean,
 *   refreshFolderTree: () => Promise<void>
 * }}
 */
export default function useFolderTree(activeDriveId = 'HDD') {
  const { serverConfig, hasServerConnection, triggerNotification } = useLayout();
  const [foldersByDrive, setFoldersByDrive] = useState({});
  const [fetchingDrives, setFetchingDrives] = useState(() => new Set());
  const wsRef = useRef(null);

  // Chuẩn hóa tên/ID ổ cứng: hỗ trợ cả HDD/SSD và legacy drive-1/drive-2
  const normalizedDriveId = useMemo(() => {
    if (activeDriveId === 'drive-1') return 'HDD';
    if (activeDriveId === 'drive-2') return 'SSD';
    return activeDriveId || 'HDD';
  }, [activeDriveId]);

  // Hàm tải dữ liệu cây thư mục với cấu trúc try...catch...finally đầy đủ (Quy tắc 8 & 9)
  const fetchTree = useCallback(async (driveToFetch) => {
    if (!hasServerConnection) return;
    const { host, port } = resolveCoordinatorHostPort(serverConfig);
    if (!host || !port) return;

    setFetchingDrives((prev) => new Set(prev).add(driveToFetch));

    try {
      const res = await getFolderTreeApi(host, port, driveToFetch);
      if (res.ok && Array.isArray(res.data)) {
        setFoldersByDrive((prev) => ({
          ...prev,
          [driveToFetch]: res.data,
        }));
      } else if (!res.ok) {
        triggerNotification({
          type: 'error',
          title: 'Folder Error',
          message: res.error || `Cannot retrieve folder structure for ${driveToFetch}.`,
        });
      }
    } catch (err) {
      triggerNotification({
        type: 'error',
        title: 'Folder Error',
        message: err.message || `An error occurred while loading folder tree for ${driveToFetch}.`,
      });
    } finally {
      setFetchingDrives((prev) => {
        const next = new Set(prev);
        next.delete(driveToFetch);
        return next;
      });
    }
  }, [hasServerConnection, serverConfig, triggerNotification]);

  // Tự động tải cây thư mục khi chuyển ổ hoặc khi kết nối server sẵn sàng
  useEffect(() => {
    if (!hasServerConnection) return;
    let isMounted = true;

    // Nếu ổ đĩa này chưa có trong cache: tiến hành tải
    if (!foldersByDrive[normalizedDriveId]) {
      // Đưa vào microtask để tránh setState đồng bộ trực tiếp trong effect
      Promise.resolve().then(() => {
        if (isMounted) {
          fetchTree(normalizedDriveId);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [hasServerConnection, normalizedDriveId, foldersByDrive, fetchTree]);

  // Lắng nghe sự kiện WebSocket realtime từ Coordinator (/ws/events)
  // Khi có filesystem_event (tạo, xóa, đổi tên, di chuyển thư mục) -> tự động refresh cây thư mục
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
            fetchTree(targetDrive);
          }
        } catch {
          // Bỏ qua lỗi parse tin nhắn rác
        }
      };

      ws.onerror = () => {
        // Lỗi kết nối WebSocket sẽ được tái kết nối tự động bởi hook cha
      };
    } catch {
      // Ignored
    }

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [hasServerConnection, serverConfig, normalizedDriveId, fetchTree]);

  const folders = useMemo(() => {
    return foldersByDrive[normalizedDriveId] || [];
  }, [foldersByDrive, normalizedDriveId]);

  const isFetchingTree = fetchingDrives.has(normalizedDriveId) || !foldersByDrive[normalizedDriveId];

  const refreshFolderTree = useCallback(() => {
    return fetchTree(normalizedDriveId);
  }, [fetchTree, normalizedDriveId]);

  return {
    folders,
    normalizedDriveId,
    isFetchingTree,
    refreshFolderTree,
  };
}
