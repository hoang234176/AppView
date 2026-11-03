import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useLayout from './useLayout';
import { getFolderTreeApi } from '../api/apiCoordinator';
import { resolveCoordinatorHostPort } from '../utils/cookieUtils';

// Custom Hook quản lý trạng thái, tải dữ liệu và đồng bộ Realtime cho Cây thư mục (Folder Tree)
// Tuyệt đối không lưu trữ bất kỳ Cache hay biến bộ nhớ dùng chung nào (No Cache)

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
  const {
    serverConfig,
    hasServerConnection,
    triggerNotification,
    isSyncLoading,
    syncActiveDrive,
    reportTaskDone,
  } = useLayout();
  const wsRef = useRef(null);

  // Chuẩn hóa tên/ID ổ cứng: hỗ trợ cả HDD/SSD và legacy drive-1/drive-2
  const normalizedDriveId = useMemo(() => {
    if (activeDriveId === 'drive-1') return 'HDD';
    if (activeDriveId === 'drive-2') return 'SSD';
    return activeDriveId || 'HDD';
  }, [activeDriveId]);

  const [prevDriveId, setPrevDriveId] = useState(normalizedDriveId);
  const activeTreeDriveRef = useRef(normalizedDriveId);

  useEffect(() => {
    activeTreeDriveRef.current = normalizedDriveId;
  }, [normalizedDriveId]);

  // Quản lý state gắn chặt theo driveId duy nhất: tuyệt đối không lưu cache của bất kỳ ổ đĩa cũ nào
  const [treeState, setTreeState] = useState({
    driveId: normalizedDriveId,
    folders: [],
    isLoading: true,
  });

  // Tính toán store có hiệu lực ngay tức thì (Zero-delay) trong cùng render phase
  // Xóa trắng ngay lập tức toàn bộ thư mục của ổ cũ khi đổi ổ đĩa
  const effectiveTreeState = useMemo(() => {
    return normalizedDriveId !== prevDriveId
      ? {
          driveId: normalizedDriveId,
          folders: [],
          isLoading: true,
        }
      : treeState;
  }, [normalizedDriveId, prevDriveId, treeState]);

  // Tự động đồng bộ state ngay trong render phase khi đổi ổ đĩa (chuẩn React)
  // Xóa sạch thư mục của ổ cũ khỏi bộ nhớ ngay lập tức
  if (normalizedDriveId !== prevDriveId) {
    setPrevDriveId(normalizedDriveId);
    setTreeState({
      driveId: normalizedDriveId,
      folders: [],
      isLoading: true,
    });
  }

  // Hàm tải dữ liệu cây thư mục từ API với cấu trúc try...catch...finally đầy đủ (Quy tắc 8 & 9)
  const fetchTree = useCallback(async (driveToFetch) => {
    if (!hasServerConnection) return;
    const { host, port } = resolveCoordinatorHostPort(serverConfig);
    if (!host || !port) return;

    setTreeState((prev) =>
      prev.driveId === driveToFetch
        ? { ...prev, isLoading: true }
        : { driveId: driveToFetch, folders: [], isLoading: true }
    );

    try {
      const res = await getFolderTreeApi(host, port, driveToFetch);
      // Chống race condition: chỉ cập nhật nếu người dùng vẫn đang ở đúng ổ đĩa này
      if (activeTreeDriveRef.current === driveToFetch) {
        if (res.ok && Array.isArray(res.data)) {
          setTreeState({
            driveId: driveToFetch,
            folders: res.data,
            isLoading: false,
          });
        } else if (!res.ok) {
          setTreeState({
            driveId: driveToFetch,
            folders: [],
            isLoading: false,
          });
          triggerNotification({
            type: 'error',
            title: 'Folder Error',
            message: res.error || `Cannot retrieve folder structure for ${driveToFetch}.`,
          });
        }
      }
    } catch (err) {
      if (activeTreeDriveRef.current === driveToFetch) {
        setTreeState({
          driveId: driveToFetch,
          folders: [],
          isLoading: false,
        });
        triggerNotification({
          type: 'error',
          title: 'Folder Error',
          message: err.message || `An error occurred while loading folder tree for ${driveToFetch}.`,
        });
      }
    } finally {
      reportTaskDone?.(driveToFetch, 'tree');
    }
  }, [hasServerConnection, serverConfig, triggerNotification, reportTaskDone]);

  // Luôn luôn gọi API tải cây thư mục mới khi đổi ổ đĩa hoặc khi chưa có dữ liệu của ổ này
  useEffect(() => {
    if (!hasServerConnection) return;
    if (effectiveTreeState.driveId === normalizedDriveId && effectiveTreeState.folders.length > 0) return;

    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        fetchTree(normalizedDriveId);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [hasServerConnection, normalizedDriveId, effectiveTreeState.driveId, effectiveTreeState.folders.length, fetchTree]);

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
              fetchTree(targetDrive);
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
  }, [hasServerConnection, serverConfig, normalizedDriveId, fetchTree]);

  // Lắng nghe sự kiện nội bộ refresh-tree / folder-deleted để cập nhật cây ngay lập tức
  useEffect(() => {
    const handleRefresh = () => {
      fetchTree(normalizedDriveId);
    };
    window.addEventListener('refresh-tree', handleRefresh);
    window.addEventListener('folder-deleted', handleRefresh);
    return () => {
      window.removeEventListener('refresh-tree', handleRefresh);
      window.removeEventListener('folder-deleted', handleRefresh);
    };
  }, [fetchTree, normalizedDriveId]);

  const refreshFolderTree = useCallback(() => {
    return fetchTree(normalizedDriveId);
  }, [fetchTree, normalizedDriveId]);

  // KHÓA CHẶT: Chỉ trả về folders khi driveId của store khớp 100% với normalizedDriveId hiện tại
  // Nếu đang ở HDD mà store là SSD: lập tức trả về [] rỗng, loại bỏ sạch dữ liệu cũ
  const isDriveMatched = effectiveTreeState.driveId === normalizedDriveId;
  const effectiveFolders = isDriveMatched ? effectiveTreeState.folders : [];
  const isSyncing = isSyncLoading && syncActiveDrive === normalizedDriveId;
  const isFetchingTree = isSyncing || !isDriveMatched || effectiveTreeState.isLoading;

  return {
    folders: effectiveFolders,
    normalizedDriveId,
    isFetchingTree,
    refreshFolderTree,
  };
}
