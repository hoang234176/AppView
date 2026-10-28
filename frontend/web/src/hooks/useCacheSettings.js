import { useState, useEffect, useCallback } from 'react';
import useLayout from './useLayout';

const CACHE_NAME_MAP = {
  thumbnails: 'appview-thumbnails',
  media: 'appview-media',
};

/**
 * Định dạng số bytes thành chuỗi dung lượng thân thiện
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0 || isNaN(bytes)) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${units[i] || 'B'}`;
}

/**
 * Tính tổng số bytes được lưu trong một phân vùng cache của trình duyệt (CacheStorage API)
 * @param {string} cacheName
 * @returns {Promise<number>}
 */
async function calculateCacheBytes(cacheName) {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return 0;
  }

  try {
    const hasCache = await window.caches.has(cacheName);
    if (!hasCache) {
      return 0;
    }

    const cache = await window.caches.open(cacheName);
    const requests = await cache.keys();
    let totalBytes = 0;

    for (const req of requests) {
      try {
        const res = await cache.match(req);
        if (res) {
          const blob = await res.blob();
          totalBytes += blob.size;
        }
      } catch {
        // Bỏ qua lỗi từng item đơn lẻ
      }
    }

    return totalBytes;
  } catch (err) {
    console.error(`Failed to calculate cache size for ${cacheName}:`, err);
    return 0;
  }
}

/**
 * Hook quản lý tính toán và dọn dẹp bộ nhớ tạm thuần Client Web
 */
export function useCacheSettings() {
  const { triggerNotification } = useLayout();
  const [cacheSizes, setCacheSizes] = useState({
    thumbnails: '0 B',
    media: '0 B',
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [clearingState, setClearingState] = useState({
    thumbnails: false,
    media: false,
  });

  const refreshCacheSizes = useCallback(async () => {
    setIsCalculating(true);
    try {
      const [thumbBytes, mediaBytes] = await Promise.all([
        calculateCacheBytes(CACHE_NAME_MAP.thumbnails),
        calculateCacheBytes(CACHE_NAME_MAP.media),
      ]);

      setCacheSizes({
        thumbnails: formatBytes(thumbBytes),
        media: formatBytes(mediaBytes),
      });
    } catch (err) {
      triggerNotification({
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to refresh cache sizes.',
      });
    } finally {
      setIsCalculating(false);
    }
  }, [triggerNotification]);

  useEffect(() => {
    let ignore = false;

    async function loadInitialSizes() {
      try {
        const [thumbBytes, mediaBytes] = await Promise.all([
          calculateCacheBytes(CACHE_NAME_MAP.thumbnails),
          calculateCacheBytes(CACHE_NAME_MAP.media),
        ]);
        if (!ignore) {
          setCacheSizes({
            thumbnails: formatBytes(thumbBytes),
            media: formatBytes(mediaBytes),
          });
        }
      } catch (err) {
        if (!ignore) {
          triggerNotification({
            type: 'error',
            title: 'Error',
            message: err.message || 'Failed to load initial cache sizes.',
          });
        }
      } finally {
        // Chu trình tải dung lượng cache khởi tạo hoàn tất an toàn
      }
    }

    loadInitialSizes();

    return () => {
      ignore = true;
    };
  }, [triggerNotification]);

  const clearCache = useCallback(
    async (cacheId) => {
      const cacheName = CACHE_NAME_MAP[cacheId];
      if (!cacheName || typeof window === 'undefined' || !('caches' in window)) {
        return;
      }

      setClearingState((prev) => ({ ...prev, [cacheId]: true }));

      try {
        await window.caches.delete(cacheName);
        setCacheSizes((prev) => ({ ...prev, [cacheId]: '0 B' }));

        triggerNotification({
          type: 'success',
          title: 'Cache Cleared',
          message: `${cacheId === 'thumbnails' ? 'Thumbnails' : 'Media'} cache cleared successfully.`,
        });
      } catch (err) {
        triggerNotification({
          type: 'error',
          title: 'Clear Cache Failed',
          message: err.message || 'Failed to clear cache.',
        });
      } finally {
        setClearingState((prev) => ({ ...prev, [cacheId]: false }));
      }
    },
    [triggerNotification]
  );

  return {
    cacheSizes,
    isCalculating,
    clearingState,
    refreshCacheSizes,
    clearCache,
  };
}

export default useCacheSettings;
