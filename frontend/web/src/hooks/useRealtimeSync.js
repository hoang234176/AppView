import { useRef, useEffect, useCallback } from 'react';
import { getApiBaseUrl, getCoordinatorEventsWsUrl } from '../api/axiosConfig';
import { normalizeMediaItem } from '../api/folderApi';

const isSameOrDescendantPath = (candidate, parent) => Boolean(parent) && (candidate === parent || candidate.startsWith(`${parent}/`));
const parentPath = (path) => {
  const separator = path.lastIndexOf('/');
  return separator === -1 ? '' : path.slice(0, separator);
};
const replacePathPrefix = (path, oldPrefix, newPrefix) => (path === oldPrefix ? newPrefix : `${newPrefix}${path.slice(oldPrefix.length)}`);

/**
 * useRealtimeSync — Custom hook managing Coordinator WebSocket connection and reactive updates
 */
export function useRealtimeSync({
  isConnected,
  configVersion,
  activeDrive,
  currentPath,
  setCurrentPath,
  updateUrlPath,
  setSearchQuery,
  loadTreeData,
  loadData,
  loadDrives,
  setDrives,
  setFolders,
  setPictures,
  setVideos,
  setTotalFolders,
  setTotalPictures,
  setTotalVideos,
  setTransferTasks,
  handleRefreshAll,
  refreshCoordinatorDownloads,
}) {
  const realtimeSocketRef = useRef(null);
  const realtimeReconnectTimerRef = useRef(null);
  const realtimeRefreshTimerRef = useRef(null);
  const downloadRefreshTimerRef = useRef(null);

  const realtimeRefreshRef = useRef(null);
  const loadDrivesRef = useRef(null);
  const refreshCoordinatorDownloadsRef = useRef(null);
  const handleRefreshAllRef = useRef(null);

  useEffect(() => {
    loadDrivesRef.current = loadDrives;
  }, [loadDrives]);

  useEffect(() => {
    refreshCoordinatorDownloadsRef.current = refreshCoordinatorDownloads;
  }, [refreshCoordinatorDownloads]);

  useEffect(() => {
    handleRefreshAllRef.current = handleRefreshAll;
  }, [handleRefreshAll]);

  const refreshFromFilesystemEvent = useCallback((event = null) => {
    if (event?.drive && activeDrive && event.drive.toUpperCase() !== activeDrive.toUpperCase()) {
      return;
    }
    let nextPath = currentPath;
    let refreshCurrent = event === null;
    const type = event?.type;
    const oldPath = event?.oldPath || event?.path || '';
    const newPath = event?.newPath || event?.path || '';
    const oldParentPath = event?.oldParentPath || parentPath(oldPath);
    const newParentPath = event?.newParentPath || event?.parentPath || parentPath(newPath);

    const normalize = (p) => (p || '').replace(/^\/+|\/+$/g, '');
    const normCurrent = normalize(currentPath);
    const normOldParent = normalize(oldParentPath);
    const normNewParent = normalize(newParentPath);
    const normOld = normalize(oldPath);
    const normNew = normalize(newPath);

    // 1. File Created - Incremental prepend without reloading entire folder
    if (type === 'file_created') {
      if (normCurrent === normNewParent || normCurrent === normOldParent) {
        if (event.item) {
          const formatted = normalizeMediaItem(event.item, activeDrive);
          if (formatted.type === 'video') {
            setVideos((prev) => [formatted, ...prev.filter((v) => normalize(v.path) !== normNew)]);
            setTotalVideos((c) => c + 1);
          } else {
            setPictures((prev) => [formatted, ...prev.filter((p) => normalize(p.path) !== normNew)]);
            setTotalPictures((c) => c + 1);
          }
          return;
        }
        refreshCurrent = true;
      } else {
        return;
      }
    }

    // 2. File Deleted - Incremental filter without reloading entire folder
    if (type === 'file_deleted') {
      if (normCurrent === normOldParent || normCurrent === normNewParent) {
        setPictures((prev) => {
          const next = prev.filter((p) => normalize(p.path) !== normOld);
          if (next.length !== prev.length) setTotalPictures((c) => Math.max(0, c - 1));
          return next;
        });
        setVideos((prev) => {
          const next = prev.filter((v) => normalize(v.path) !== normOld);
          if (next.length !== prev.length) setTotalVideos((c) => Math.max(0, c - 1));
          return next;
        });
        return;
      }
      return;
    }

    // 3. File Moved
    if (type === 'file_moved') {
      if (normCurrent === normOldParent) {
        setPictures((prev) => {
          const next = prev.filter((p) => normalize(p.path) !== normOld);
          if (next.length !== prev.length) setTotalPictures((c) => Math.max(0, c - 1));
          return next;
        });
        setVideos((prev) => {
          const next = prev.filter((v) => normalize(v.path) !== normOld);
          if (next.length !== prev.length) setTotalVideos((c) => Math.max(0, c - 1));
          return next;
        });
      }
      if (normCurrent === normNewParent) {
        if (event.item) {
          const formatted = normalizeMediaItem(event.item, activeDrive);
          if (formatted.type === 'video') {
            setVideos((prev) => [formatted, ...prev.filter((v) => normalize(v.path) !== normNew)]);
            setTotalVideos((c) => c + 1);
          } else {
            setPictures((prev) => [formatted, ...prev.filter((p) => normalize(p.path) !== normNew)]);
            setTotalPictures((c) => c + 1);
          }
        } else {
          refreshCurrent = true;
        }
      }
      if (normCurrent !== normOldParent && normCurrent !== normNewParent) {
        return;
      }
      if (!refreshCurrent) return;
    }

    // 4. Batch Items Deleted
    if (type === 'items_deleted') {
      const delSet = new Set((event.paths || []).map(normalize));
      setFolders((prev) => {
        const next = prev.filter((f) => !delSet.has(normalize(f.path)));
        if (next.length !== prev.length) setTotalFolders((c) => Math.max(0, c - (prev.length - next.length)));
        return next;
      });
      setPictures((prev) => {
        const next = prev.filter((p) => !delSet.has(normalize(p.path)));
        if (next.length !== prev.length) setTotalPictures((c) => Math.max(0, c - (prev.length - next.length)));
        return next;
      });
      setVideos((prev) => {
        const next = prev.filter((v) => !delSet.has(normalize(v.path)));
        if (next.length !== prev.length) setTotalVideos((c) => Math.max(0, c - (prev.length - next.length)));
        return next;
      });
      loadTreeData();
      return;
    }

    // 5. Folder Created - Incremental add & Tree sync
    if (type === 'folder_created') {
      loadTreeData();
      if (normCurrent === normNewParent) {
        const baseUrl = getApiBaseUrl();
        const origin = baseUrl.replace(/\/api\/v1\/?$/, '');
        if (event.item) {
          const item = event.item;
          const formattedItem = {
            ...item,
            previews: Array.isArray(item.previews)
              ? item.previews.map((p) => (/^https?:\/\//i.test(p) ? p : `${origin}${p.startsWith('/') ? '' : '/'}${p}`))
              : [],
          };
          setFolders((prev) => [formattedItem, ...prev.filter((f) => normalize(f.path) !== normNew)]);
          setTotalFolders((c) => c + 1);
          return;
        }
        const folderName = newPath.split('/').pop();
        const newFolder = { name: folderName, path: newPath, previews: [] };
        setFolders((prev) => [newFolder, ...prev.filter((f) => normalize(f.path) !== normNew)]);
        setTotalFolders((c) => c + 1);
        return;
      }
      return;
    }

    // 5b. Folder Updated (e.g. preview thumbnails became ready reactively)
    if (type === 'folder_updated') {
      const targetPath = normalize(event.path || event.newPath || '');
      const rawPreviews = event.previews || event.item?.previews;
      if (targetPath && Array.isArray(rawPreviews)) {
        const baseUrl = getApiBaseUrl();
        const origin = baseUrl.replace(/\/api\/v1\/?$/, '');
        const previews = rawPreviews.map((p) => {
          if (!p) return '';
          if (/^https?:\/\//i.test(p)) return p;
          return `${origin}${p.startsWith('/') ? '' : '/'}${p}`;
        });
        setFolders((prev) =>
          prev.map((f) => {
            if (normalize(f.path) === targetPath) {
              return { ...f, previews };
            }
            return f;
          })
        );
      }
      return;
    }

    // 6. Folder Deleted - Navigate out or filter & Tree sync
    if (type === 'folder_deleted') {
      loadTreeData();
      if (isSameOrDescendantPath(normCurrent, normOld)) {
        nextPath = oldParentPath;
        refreshCurrent = true;
      } else if (normCurrent === normOldParent) {
        setFolders((prev) => {
          const next = prev.filter((f) => normalize(f.path) !== normOld);
          if (next.length !== prev.length) setTotalFolders((c) => Math.max(0, c - 1));
          return next;
        });
        return;
      } else {
        return;
      }
    }

    // 7. Folder Moved / Renamed - Tree sync
    if (type === 'folder_moved' || type === 'folder_renamed') {
      loadTreeData();
      if (isSameOrDescendantPath(normCurrent, normOld)) {
        nextPath = replacePathPrefix(currentPath, oldPath, newPath);
        refreshCurrent = true;
      } else if (normCurrent === normOldParent) {
        setFolders((prev) => {
          const next = prev.filter((f) => normalize(f.path) !== normOld);
          if (next.length !== prev.length) setTotalFolders((c) => Math.max(0, c - 1));
          return next;
        });
        refreshCurrent = true;
      } else if (normCurrent === normNewParent) {
        refreshCurrent = true;
      } else {
        return;
      }
    }

    // 8. Batch Items Moved / Copied - Tree sync
    if (type === 'items_moved' || type === 'items_copied') {
      loadTreeData();
      if (type === 'items_moved' && normCurrent === normOldParent) {
        const movedSet = new Set((event.paths || []).map(normalize));
        setFolders((prev) => {
          const next = prev.filter((f) => !movedSet.has(normalize(f.path)));
          if (next.length !== prev.length) setTotalFolders((c) => Math.max(0, c - (prev.length - next.length)));
          return next;
        });
        setPictures((prev) => {
          const next = prev.filter((p) => !movedSet.has(normalize(p.path)));
          if (next.length !== prev.length) setTotalPictures((c) => Math.max(0, c - (prev.length - next.length)));
          return next;
        });
        setVideos((prev) => {
          const next = prev.filter((v) => !movedSet.has(normalize(v.path)));
          if (next.length !== prev.length) setTotalVideos((c) => Math.max(0, c - (prev.length - next.length)));
          return next;
        });
        refreshCurrent = true;
      } else if (normCurrent === normNewParent || normCurrent === normOldParent) {
        refreshCurrent = true;
      } else {
        return;
      }
    }

    const pathChanged = nextPath !== currentPath;
    if (pathChanged) {
      updateUrlPath(nextPath);
      setCurrentPath(nextPath);
      if (setSearchQuery) setSearchQuery('');
    }

    if (realtimeRefreshTimerRef.current) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }
    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      loadTreeData();
      if (refreshCurrent && !pathChanged) {
        loadData(nextPath, { limit: 0 }, false);
      }
    }, 120);
  }, [activeDrive, currentPath, loadData, loadTreeData, setCurrentPath, setFolders, setPictures, setSearchQuery, setTotalFolders, setTotalPictures, setTotalVideos, setVideos, updateUrlPath]);

  useEffect(() => {
    realtimeRefreshRef.current = refreshFromFilesystemEvent;
  }, [refreshFromFilesystemEvent]);

  useEffect(() => {
    if (!isConnected) return undefined;
    const websocketUrl = getCoordinatorEventsWsUrl();
    if (!websocketUrl) return undefined;

    let stopped = false;
    let reconnectAttempt = 0;
    const connect = () => {
      if (stopped) return;
      const socket = new WebSocket(websocketUrl);
      realtimeSocketRef.current = socket;
      socket.onopen = () => {
        reconnectAttempt = 0;
        loadDrivesRef.current?.();
        realtimeRefreshRef.current?.();
        refreshCoordinatorDownloadsRef.current?.();
      };
      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data);
          if (payload?.type === 'storage.info' && Array.isArray(payload.storageInfo?.drives)) {
            setDrives(payload.storageInfo.drives);
          } else if (payload?.type === 'filesystem_event' && payload.event && typeof payload.event === 'object') {
            realtimeRefreshRef.current?.(payload.event);
          } else if (payload?.type === 'batch_job_progress' && payload.batchJob) {
            const job = payload.batchJob;
            setTransferTasks((prev) => {
              const idx = prev.findIndex((t) => t.id === job.id);
              if (idx >= 0) {
                return prev.map((item) => {
                  if (item.id !== job.id) return item;
                  return {
                    ...item,
                    sourceName: job.source_name || item.sourceName,
                    action: job.action || item.action,
                    percent: job.percent ?? item.percent,
                    status: job.status || item.status,
                    message: job.message || item.message,
                    current_file: job.current_file ?? item.current_file,
                    copied_bytes: job.copied_bytes ?? item.copied_bytes,
                    total_bytes: job.total_bytes ?? item.total_bytes,
                  };
                });
              } else {
                return [
                  ...prev,
                  {
                    id: job.id,
                    action: job.action,
                    dest: job.dest_folder ? `/${job.dest_folder}` : '/ (Thư mục gốc)',
                    sourceName: job.source_name || '',
                    dest_folder: job.dest_folder,
                    percent: job.percent ?? 0,
                    status: job.status || 'running',
                    message: job.message || '',
                    current_file: job.current_file || '',
                    copied_bytes: job.copied_bytes || 0,
                    total_bytes: job.total_bytes || 0,
                  },
                ];
              }
            });
            if (job.status === 'completed') {
              handleRefreshAllRef.current?.();
              setTimeout(() => {
                setTransferTasks((prev) => prev.filter((item) => item.id !== job.id));
              }, 3500);
            } else if (job.status === 'failed') {
              setTimeout(() => {
                setTransferTasks((prev) => prev.filter((item) => item.id !== job.id));
              }, 4500);
            }
          } else if (payload?.type === 'download_event') {
            if (downloadRefreshTimerRef.current) window.clearTimeout(downloadRefreshTimerRef.current);
            downloadRefreshTimerRef.current = window.setTimeout(() => {
              refreshCoordinatorDownloadsRef.current?.();
            }, 200);
          }
        } catch {
          // Ignore malformed best-effort invalidation messages.
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        const delay = Math.min(1000 * (2 ** reconnectAttempt), 15000);
        reconnectAttempt = Math.min(reconnectAttempt + 1, 4);
        realtimeReconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };
    connect();

    return () => {
      stopped = true;
      if (realtimeReconnectTimerRef.current) window.clearTimeout(realtimeReconnectTimerRef.current);
      if (realtimeRefreshTimerRef.current) window.clearTimeout(realtimeRefreshTimerRef.current);
      if (downloadRefreshTimerRef.current) window.clearTimeout(downloadRefreshTimerRef.current);
      const socket = realtimeSocketRef.current;
      realtimeSocketRef.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [configVersion, isConnected, setDrives, setTransferTasks]);

  return {
    refreshFromFilesystemEvent,
  };
}
