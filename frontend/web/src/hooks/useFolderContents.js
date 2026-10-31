import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useLayout from './useLayout';
import { getFolderContentsApi } from '../api/apiCoordinator';
import { resolveCoordinatorHostPort } from '../utils/cookieUtils';

// Custom Hook quản lý nội dung thư mục (folders, pictures, videos) từ Coordinator
// Tuyệt đối không lưu trữ bất kỳ Cache hay biến bộ nhớ dùng chung nào (No Cache)

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
  const {
    serverConfig,
    hasServerConnection,
    triggerNotification,
    isSyncLoading,
    syncActiveDrive,
    reportTaskDone,
  } = useLayout();

  // Chuẩn hóa tên/ID ổ cứng
  const normalizedDriveId = useMemo(() => {
    if (driveId === 'drive-1') return 'HDD';
    if (driveId === 'drive-2') return 'SSD';
    return driveId || 'SSD';
  }, [driveId]);

  const cleanPath = useMemo(() => {
    return String(currentPath || '').trim();
  }, [currentPath]);

  const activeKey = `${normalizedDriveId}:${cleanPath}`;
  const activeKeyRef = useRef(activeKey);

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  // Quản lý state gắn chặt theo activeKey duy nhất
  // Quản lý state gắn chặt theo activeKey duy nhất: tuyệt đối không lưu cache của bất kỳ thư mục cũ nào
  const [store, setStore] = useState({
    key: activeKey,
    data: null,
    isLoading: true,
    error: null,
  });

  const [prevKey, setPrevKey] = useState(activeKey);

  // Tính toán store có hiệu lực ngay tức thì (Zero-delay) trong cùng render phase
  // Xóa trắng ngay lập tức toàn bộ nội dung của thư mục cũ khi đổi đường dẫn / ổ đĩa
  const effectiveStore = useMemo(() => {
    return activeKey !== prevKey
      ? {
          key: activeKey,
          data: null,
          isLoading: true,
          error: null,
        }
      : store;
  }, [activeKey, prevKey, store]);

  // Tự động đồng bộ state ngay trong render phase khi đổi ổ đĩa hoặc đổi thư mục (chuẩn React)
  // Xóa sạch nội dung thư mục cũ khỏi bộ nhớ ngay lập tức
  if (activeKey !== prevKey) {
    setPrevKey(activeKey);
    setStore({
      key: activeKey,
      data: null,
      isLoading: true,
      error: null,
    });
  }

  const wsRef = useRef(null);

  // Hàm tải dữ liệu nội dung thư mục với try...catch...finally đầy đủ (Quy tắc 8 & 9)
  const fetchContents = useCallback(async (targetDrive, targetPath) => {
    if (!hasServerConnection) return;
    const { host, port } = resolveCoordinatorHostPort(serverConfig);
    if (!host || !port) return;

    const requestKey = `${targetDrive}:${targetPath}`;
    setStore((prev) =>
      prev.key === requestKey
        ? { ...prev, isLoading: true, error: null }
        : { key: requestKey, data: null, isLoading: true, error: null }
    );

    // Đảm bảo vòng loading hiển thị tối thiểu 200ms khi mở thư mục để không bị giật/chớp tắt nhanh
    const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 200));

    try {
      const [res] = await Promise.all([
        getFolderContentsApi(host, port, {
          drive: targetDrive,
          path: targetPath,
        }),
        minDelayPromise,
      ]);

      // Kiểm tra race condition: chỉ cập nhật nếu người dùng vẫn đang ở đúng thư mục đã gửi request
      if (activeKeyRef.current === requestKey) {
        if (res.ok && res.data) {
          setStore({
            key: requestKey,
            data: res.data,
            isLoading: false,
            error: null,
          });
        } else {
          const errMsg = res.error || `Cannot retrieve contents for ${targetDrive}/${targetPath}`;
          setStore({
            key: requestKey,
            data: null,
            isLoading: false,
            error: errMsg,
          });
          triggerNotification({
            type: 'error',
            title: 'Folder Content Error',
            message: errMsg,
          });
        }
      }
    } catch (err) {
      if (activeKeyRef.current === requestKey) {
        const errMsg = err.message || `An error occurred while loading contents for ${targetDrive}/${targetPath}`;
        setStore({
          key: requestKey,
          data: null,
          isLoading: false,
          error: errMsg,
        });
        triggerNotification({
          type: 'error',
          title: 'Folder Content Error',
          message: errMsg,
        });
      }
    } finally {
      reportTaskDone?.(targetDrive, 'contents');
    }
  }, [hasServerConnection, serverConfig, triggerNotification, reportTaskDone]);

  // Luôn luôn gọi API tải nội dung thư mục mới nhất khi đổi ổ đĩa hoặc thư mục
  useEffect(() => {
    if (!hasServerConnection) return;
    if (effectiveStore.key === activeKey && effectiveStore.data !== null) return;

    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        fetchContents(normalizedDriveId, cleanPath);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [hasServerConnection, activeKey, effectiveStore.key, effectiveStore.data, normalizedDriveId, cleanPath, fetchContents]);

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

  // KHÓA DỮ LIỆU THEO EFFECTIVE STORE
  const isKeyMatched = effectiveStore.key === activeKey;
  const currentData = isKeyMatched ? effectiveStore.data : null;
  const isSyncing = isSyncLoading && syncActiveDrive === normalizedDriveId;
  const isLoading = isSyncing || (isKeyMatched ? effectiveStore.isLoading : true);
  const error = isKeyMatched ? effectiveStore.error : null;

  return {
    data: currentData,
    folders: currentData?.folders || [],
    pictures: currentData?.pictures || [],
    videos: currentData?.videos || [],
    isLoading,
    isRefreshing: isLoading && Boolean(currentData),
    error,
    refreshContents: () => fetchContents(normalizedDriveId, cleanPath),
  };
}
