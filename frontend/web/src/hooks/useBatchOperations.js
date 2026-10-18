import { useState, useRef, useEffect, useCallback } from 'react';
import { executeBatchItems, checkBatchConflicts, fetchBatchJobStatus } from '../api/folderApi';

/**
 * useBatchOperations — Custom hook managing item selection, batch copy/move/delete,
 * conflict resolution modal, and transfer task polling.
 */
export function useBatchOperations({
  activeDrive,
  currentPath,
  handleRefreshAll,
  loadData,
  loadTreeData,
  setFolders,
  setPictures,
  setVideos,
  setTotalFolders,
  setTotalPictures,
  setTotalVideos,
  updateUrlPath,
  setCurrentPath,
  visibleFolders = [],
  visiblePictures = [],
  visibleVideos = [],
}) {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Map());
  const [batchModalState, setBatchModalState] = useState({ isOpen: false, action: null });
  const [conflictModalData, setConflictModalData] = useState({
    isOpen: false,
    conflicts: [],
    action: 'copy',
    pendingBatch: null,
  });
  const [transferTasks, setTransferTasks] = useState([]);
  const transferTasksRef = useRef(transferTasks);
  transferTasksRef.current = transferTasks;
  const transferPollRef = useRef(null);

  const handleEnterSelectMode = useCallback(() => {
    setIsSelectMode(true);
  }, []);

  const handleExitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedItems(new Map());
  }, []);

  const handleToggleSelectItem = useCallback((item, type) => {
    const key = `${type}:${item.path}`;
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { type, item });
      }
      return next;
    });
  }, []);

  const handleToggleSelectAllFolders = useCallback(() => {
    setSelectedItems((prev) => {
      const isAll = visibleFolders.length > 0 && visibleFolders.every((f) => prev.has(`folder:${f.path}`));
      const next = new Map(prev);
      if (isAll) {
        visibleFolders.forEach((f) => next.delete(`folder:${f.path}`));
      } else {
        visibleFolders.forEach((f) => next.set(`folder:${f.path}`, { type: 'folder', item: f }));
      }
      return next;
    });
  }, [visibleFolders]);

  const handleToggleSelectAllPictures = useCallback(() => {
    setSelectedItems((prev) => {
      const isAll = visiblePictures.length > 0 && visiblePictures.every((p) => prev.has(`picture:${p.path}`));
      const next = new Map(prev);
      if (isAll) {
        visiblePictures.forEach((p) => next.delete(`picture:${p.path}`));
      } else {
        visiblePictures.forEach((p) => next.set(`picture:${p.path}`, { type: 'picture', item: p }));
      }
      return next;
    });
  }, [visiblePictures]);

  const handleToggleSelectAllVideos = useCallback(() => {
    setSelectedItems((prev) => {
      const isAll = visibleVideos.length > 0 && visibleVideos.every((v) => prev.has(`video:${v.path}`));
      const next = new Map(prev);
      if (isAll) {
        visibleVideos.forEach((v) => next.delete(`video:${v.path}`));
      } else {
        visibleVideos.forEach((v) => next.set(`video:${v.path}`, { type: 'video', item: v }));
      }
      return next;
    });
  }, [visibleVideos]);

  const handleBatchCopy = useCallback(() => {
    setSelectedItems((prev) => {
      if (prev.size > 0) {
        setBatchModalState({ isOpen: true, action: 'copy' });
      }
      return prev;
    });
  }, []);

  const handleBatchMove = useCallback(() => {
    setSelectedItems((prev) => {
      if (prev.size > 0) {
        setBatchModalState({ isOpen: true, action: 'move' });
      }
      return prev;
    });
  }, []);

  const handleBatchDelete = useCallback(() => {
    setSelectedItems((prev) => {
      if (prev.size > 0) {
        setBatchModalState({ isOpen: true, action: 'delete' });
      }
      return prev;
    });
  }, []);

  const handleCopySingleItem = useCallback((item, type = 'folder') => {
    setBatchModalState({
      isOpen: true,
      action: 'copy',
      items: [{ type, item }],
    });
  }, []);

  const handleOpenMoveItem = useCallback((item, type = 'folder') => {
    setBatchModalState({
      isOpen: true,
      action: 'move',
      items: [{ type, item }],
    });
  }, []);

  // Centralized polling effect for all active batch transfer jobs
  useEffect(() => {
    const runningJobs = transferTasks.filter((t) => t.status === 'running' && t.id && !t.id.startsWith('temp_'));
    if (runningJobs.length === 0) {
      if (transferPollRef.current) {
        clearInterval(transferPollRef.current);
        transferPollRef.current = null;
      }
      return;
    }

    if (!transferPollRef.current) {
      transferPollRef.current = setInterval(async () => {
        const active = transferTasksRef.current.filter((t) => t.status === 'running' && t.id && !t.id.startsWith('temp_'));
        if (active.length === 0) {
          if (transferPollRef.current) {
            clearInterval(transferPollRef.current);
            transferPollRef.current = null;
          }
          return;
        }

        await Promise.all(
          active.map(async (task) => {
            try {
              const pollRes = await fetchBatchJobStatus(task.id);
              if (pollRes.success && pollRes.job) {
                const updated = pollRes.job;
                setTransferTasks((prev) =>
                  prev.map((item) => {
                    if (item.id !== task.id) return item;
                    return {
                      ...item,
                      action: updated.action || item.action,
                      percent: updated.percent ?? item.percent,
                      status: updated.status || item.status,
                      message: updated.message || item.message,
                      current_file: updated.current_file ?? item.current_file,
                      copied_bytes: updated.copied_bytes ?? item.copied_bytes,
                      total_bytes: updated.total_bytes ?? item.total_bytes,
                    };
                  })
                );

                if (updated.status === 'completed') {
                  handleRefreshAll();
                  setTimeout(() => {
                    setTransferTasks((prev) => prev.filter((item) => item.id !== task.id));
                  }, 3500);
                } else if (updated.status === 'failed') {
                  setTimeout(() => {
                    setTransferTasks((prev) => prev.filter((item) => item.id !== task.id));
                  }, 4500);
                }
              }
            } catch {
              // Ignore transient polling errors
            }
          })
        );
      }, 400);
    }
  }, [transferTasks, handleRefreshAll]);

  const runBatchExecution = useCallback(async ({ action, selectedFolder, destDrive, items, resolutions }) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const destDisplayName = selectedFolder ? `/${selectedFolder}` : '/ (Thư mục gốc)';

    const firstItem = items[0];
    const firstItemName = firstItem?.name || firstItem?.item?.name || (firstItem?.path || firstItem?.item?.path || '').split('/').filter(Boolean).pop() || '';
    const itemNames = items.map((it) => it.name || it.item?.name || (it.path || it.item?.path || '').split('/').filter(Boolean).pop()).filter(Boolean);
    const sourceDisplayName = itemNames.length > 1 ? `${itemNames[0]} (+${itemNames.length - 1} mục khác)` : firstItemName;

    const initialTask = {
      id: tempId,
      action,
      dest: destDisplayName,
      sourceName: sourceDisplayName,
      destDrive: destDrive || activeDrive,
      srcDrive: activeDrive,
      itemsCount: items.length,
      status: 'running',
      percent: 0,
      copied_bytes: 0,
      total_bytes: 0,
      current_file: '',
      message: action === 'copy' ? `Đang sao chép đến ${destDisplayName}...` : `Đang di chuyển đến ${destDisplayName}...`,
    };

    setTransferTasks((prev) => [initialTask, ...prev]);

    const res = await executeBatchItems({
      action,
      items,
      destFolder: selectedFolder,
      srcDrive: activeDrive,
      destDrive: destDrive || activeDrive,
      resolutions,
    });

    if (!res.success) {
      setTransferTasks((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? {
                ...item,
                status: 'failed',
                message: res.message || 'Thao tác thất bại',
              }
            : item
        )
      );
      setTimeout(() => {
        setTransferTasks((prev) => prev.filter((item) => item.id !== tempId));
      }, 4000);
      return;
    }

    const job = res.data?.job || res.job;
    if (job && job.status === 'completed') {
      const finishedId = job.id || tempId;
      setTransferTasks((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? {
                ...item,
                id: finishedId,
                status: 'completed',
                percent: 100,
                message: job.message || 'Thao tác hoàn tất',
              }
            : item
        )
      );

      if (action === 'move') {
        const movedNormalized = new Set(
          items.map((it) => (it.path || it.item?.path || '').replace(/^\/+|\/+$/g, ''))
        );
        setFolders((prev) => {
          const next = prev.filter((f) => !movedNormalized.has((f.path || '').replace(/^\/+|\/+$/g, '')));
          if (next.length !== prev.length) setTotalFolders((c) => Math.max(0, c - (prev.length - next.length)));
          return next;
        });
        setPictures((prev) => {
          const next = prev.filter((p) => !movedNormalized.has((p.path || '').replace(/^\/+|\/+$/g, '')));
          if (next.length !== prev.length) setTotalPictures((c) => Math.max(0, c - (prev.length - next.length)));
          return next;
        });
        setVideos((prev) => {
          const next = prev.filter((v) => !movedNormalized.has((v.path || '').replace(/^\/+|\/+$/g, '')));
          if (next.length !== prev.length) setTotalVideos((c) => Math.max(0, c - (prev.length - next.length)));
          return next;
        });

        const normalize = (p) => (p || '').replace(/^\/+|\/+$/g, '');
        const normCurrent = normalize(currentPath);
        let targetNavPath = null;
        for (const it of items) {
          const normItemPath = normalize(it.path || it.item?.path);
          if (normItemPath && (normCurrent === normItemPath || normCurrent.startsWith(normItemPath + '/'))) {
            const relSuffix = normCurrent === normItemPath ? '' : normCurrent.slice(normItemPath.length + 1);
            const baseName = normItemPath.split('/').pop();
            const normDest = normalize(selectedFolder);
            const newBasePath = normDest ? `${normDest}/${baseName}` : baseName;
            targetNavPath = relSuffix ? `${newBasePath}/${relSuffix}` : newBasePath;
            break;
          }
        }

        if (targetNavPath !== null) {
          updateUrlPath(targetNavPath);
          setCurrentPath(targetNavPath);
          loadData(targetNavPath);
        } else {
          loadData(currentPath);
        }
        loadTreeData(activeDrive);
      } else {
        handleRefreshAll();
      }

      setTimeout(() => {
        setTransferTasks((prev) => prev.filter((item) => item.id !== finishedId && item.id !== tempId));
      }, 3500);
      return;
    }

    if (job && job.id) {
      setTransferTasks((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? {
                ...item,
                id: job.id,
                status: job.status || 'running',
                percent: job.percent || 0,
                copied_bytes: job.copied_bytes || 0,
                total_bytes: job.total_bytes || 0,
                current_file: job.current_file || '',
                message: job.message || item.message,
              }
            : item
        )
      );
    }
  }, [activeDrive, currentPath, handleRefreshAll, loadData, loadTreeData, setCurrentPath, setFolders, setPictures, setTotalFolders, setTotalPictures, setTotalVideos, setVideos, updateUrlPath]);

  const handleExecuteBatch = useCallback(async ({ action, selectedFolder, destDrive, items }) => {
    setBatchModalState({ isOpen: false, action: null, items: [] });
    if (isSelectMode) {
      handleExitSelectMode();
    }

    if (action === 'copy' || action === 'move') {
      try {
        const chk = await checkBatchConflicts({
          action,
          items,
          destFolder: selectedFolder,
          srcDrive: activeDrive,
          destDrive: destDrive || activeDrive,
        });
        if (chk.success && chk.has_conflicts && chk.conflicts.length > 0) {
          setConflictModalData({
            isOpen: true,
            conflicts: chk.conflicts,
            action,
            pendingBatch: { action, selectedFolder, destDrive, items },
          });
          return;
        }
      } catch (err) {
        console.error('Lỗi kiểm tra xung đột:', err);
      }
    }

    runBatchExecution({ action, selectedFolder, destDrive, items });
  }, [activeDrive, isSelectMode, handleExitSelectMode, runBatchExecution]);

  const handleResolveConflicts = useCallback(({ resolutions }) => {
    const pending = conflictModalData.pendingBatch;
    setConflictModalData({ isOpen: false, conflicts: [], action: 'copy', pendingBatch: null });
    if (pending) {
      runBatchExecution({ ...pending, resolutions });
    }
  }, [conflictModalData, runBatchExecution]);

  return {
    isSelectMode,
    selectedItems,
    batchModalState,
    setBatchModalState,
    conflictModalData,
    setConflictModalData,
    transferTasks,
    setTransferTasks,
    handleEnterSelectMode,
    handleExitSelectMode,
    handleToggleSelectItem,
    handleToggleSelectAllFolders,
    handleToggleSelectAllPictures,
    handleToggleSelectAllVideos,
    handleBatchCopy,
    handleBatchMove,
    handleBatchDelete,
    handleCopySingleItem,
    handleOpenMoveItem,
    handleExecuteBatch,
    handleResolveConflicts,
  };
}
