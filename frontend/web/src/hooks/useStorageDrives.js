import { useState, useEffect, useCallback, useRef } from 'react';
import useLayout from './useLayout';

/**
 * Định dạng dung lượng Byte sang chuỗi hiển thị dễ đọc (B, KB, MB, GB, TB)
 * @param {number} bytes
 * @returns {string}
 */
export function formatStorageBytes(bytes) {
  if (bytes == null || isNaN(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1000 && idx < units.length - 1) {
    val /= 1000;
    idx++;
  }
  return `${val >= 100 || idx === 0 ? Math.round(val) : val.toFixed(1)} ${units[idx]}`;
}

/**
 * Custom Hook kết nối Coordinator API & Real-time WebSocket để lấy thông số ổ đĩa
 */
export default function useStorageDrives() {
  const { serverConfig, hasServerConnection, triggerNotification } = useLayout();
  const [drives, setDrives] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const reconnectTimerRef = useRef(null);
  const wsRef = useRef(null);

  // Phân giải host và port của Coordinator
  const getCoordinatorHostPort = useCallback(() => {
    let host = serverConfig?.coordinator?.host?.trim();
    let port = serverConfig?.coordinator?.port;

    if (!host) {
      if (typeof window !== 'undefined' && window.location.hostname) {
        host = window.location.hostname;
      } else {
        host = '127.0.0.1';
      }
    }
    if (!port) {
      port = '8090';
    }
    return { host, port };
  }, [serverConfig]);

  // Nạp snapshot dữ liệu ban đầu qua REST API
  const fetchStorageDrives = useCallback(async () => {
    if (!hasServerConnection) return;
    const { host, port } = getCoordinatorHostPort();
    const url = `http://${host}:${port}/api/v1/storage`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data?.drives)) {
        setDrives(data.drives);
      }
    } catch (err) {
      triggerNotification({
        type: 'error',
        title: 'Storage Error',
        message: err.message || 'Unable to retrieve storage drive information.',
      });
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [hasServerConnection, getCoordinatorHostPort, triggerNotification]);

  // Kết nối WebSocket thời gian thực tới Coordinator /ws/events
  useEffect(() => {
    if (!hasServerConnection) return;

    let isMounted = true;
    const { host, port } = getCoordinatorHostPort();

    const connectWebSocket = () => {
      if (!isMounted) return;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${host}:${port}/ws/events`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const message = JSON.parse(event.data);
            if (message?.type === 'storage.info' && Array.isArray(message?.storageInfo?.drives)) {
              setDrives(message.storageInfo.drives);
            }
          } catch {
            // Bỏ qua lỗi parse JSON không hợp lệ
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            reconnectTimerRef.current = setTimeout(connectWebSocket, 4000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (isMounted) {
          reconnectTimerRef.current = setTimeout(connectWebSocket, 4000);
        }
      }
    };

    const initStorageData = async () => {
      try {
        const response = await fetch(`http://${host}:${port}/api/v1/storage`);
        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }
        const data = await response.json();
        if (isMounted && Array.isArray(data?.drives)) {
          setDrives(data.drives);
        }
      } catch (err) {
        if (isMounted) {
          triggerNotification({
            type: 'error',
            title: 'Storage Error',
            message: err.message || 'Unable to retrieve storage drive information.',
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Gọi API nạp dữ liệu ban đầu
    void initStorageData();

    // Mở kết nối WebSocket lắng nghe biến động dung lượng
    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, [hasServerConnection, getCoordinatorHostPort, triggerNotification]);

  return {
    drives,
    isLoading,
    refetchDrives: fetchStorageDrives,
  };
}
