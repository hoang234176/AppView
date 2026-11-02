import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import useLayout from './useLayout';
import { renameFolderApi } from '../api/apiCoordinator';
import { resolveCoordinatorHostPort } from '../utils/cookieUtils';

/**
 * Custom Hook quản lý toàn bộ nghiệp vụ, trạng thái mở/đóng và tương tác đổi tên thư mục
 * Tuân thủ Quy tắc 8, 9, 10, 14 và 15 của frontend/web/AGENTS.md
 */
export default function useRenameModal() {
  const location = useLocation();
  const {
    isRenameFolderOpen,
    closeRenameFolder,
    renameTarget,
    serverConfig,
    hasServerConnection,
    triggerNotification,
  } = useLayout();

  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isRenameFolderOpen);
  const inputRef = useRef(null);

  // Đồng bộ lại trạng thái khi Modal mở hoặc đổi thư mục mục tiêu
  if (prevIsOpen !== isRenameFolderOpen) {
    setPrevIsOpen(isRenameFolderOpen);
    if (isRenameFolderOpen) {
      setFolderName(renameTarget?.name || '');
      setError('');
      setIsSubmitting(false);
    }
  }

  // Tự động focus và bôi đen toàn bộ tên thư mục hiện tại khi mở Modal
  useEffect(() => {
    if (isRenameFolderOpen) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isRenameFolderOpen]);

  // Phân giải activeDriveId từ target hoặc từ URL
  const { activeDriveId, displayLocationPath } = useMemo(() => {
    let driveId = renameTarget?.drive || '';
    if (!driveId) {
      const pathParts = location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0 && pathParts[0] !== 'settings') {
        if (pathParts[0] === 'drives' && pathParts.length > 1) {
          driveId = decodeURIComponent(pathParts[1]);
        } else {
          driveId = decodeURIComponent(pathParts[0]);
        }
      }
    }
    if (driveId === 'drive-1' || !driveId) driveId = 'HDD';
    if (driveId === 'drive-2') driveId = 'SSD';

    const targetPath = renameTarget?.path || '';
    const cleanSubPath = targetPath.trim().replace(/^\/+|\/+$/g, '');
    const parentPath = cleanSubPath.includes('/')
      ? cleanSubPath.slice(0, cleanSubPath.lastIndexOf('/'))
      : '';

    const displayLocationPath = parentPath
      ? `${driveId} > ${parentPath.split('/').join(' > ')}`
      : driveId;

    return { activeDriveId: driveId, displayLocationPath };
  }, [renameTarget, location.pathname]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    closeRenameFolder();
  }, [isSubmitting, closeRenameFolder]);

  const handleRename = useCallback(async () => {
    const trimmed = folderName.trim();
    if (!trimmed) {
      setError('Folder name cannot be empty.');
      inputRef.current?.focus();
      return;
    }

    if (/[\\/:*?"<>|]/.test(trimmed)) {
      setError('Folder name cannot contain characters \\ / : * ? " < > |');
      inputRef.current?.focus();
      return;
    }

    // Nếu tên không đổi: đóng modal không cần gọi API
    if (trimmed === renameTarget?.name) {
      closeRenameFolder();
      return;
    }

    if (!hasServerConnection) {
      setError('Lost connection to server.');
      return;
    }

    const { host, port } = resolveCoordinatorHostPort(serverConfig);
    if (!host || !port) {
      setError('Missing server connection information.');
      return;
    }

    const targetPath = renameTarget?.path || '';
    if (!targetPath || targetPath === '/' || targetPath === '.') {
      setError('Cannot rename root drive folder.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await renameFolderApi(host, port, {
        drive: activeDriveId,
        path: targetPath,
        new_name: trimmed,
      });

      if (!res.ok) {
        const errorMsg = res.error || 'Unable to rename folder.';
        setError(errorMsg);
        triggerNotification({
          type: 'error',
          title: 'Rename Error',
          message: errorMsg,
        });
        return;
      }

      triggerNotification({
        type: 'success',
        title: 'Success',
        message: `Folder renamed to "${trimmed}" successfully`,
      });

      // Phát sự kiện để ContentsView và SidebarTree cập nhật ngay lập tức
      window.dispatchEvent(
        new CustomEvent('folder-renamed', {
          detail: {
            oldPath: targetPath,
            newPath: res.data?.path || targetPath,
            newName: trimmed,
            oldName: renameTarget?.name,
            drive: activeDriveId,
            data: res.data,
          },
        })
      );

      closeRenameFolder();
    } catch (err) {
      const errMsg = err.message || 'Connection error while renaming folder.';
      setError(errMsg);
      triggerNotification({
        type: 'error',
        title: 'Rename Error',
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    folderName,
    renameTarget,
    hasServerConnection,
    serverConfig,
    activeDriveId,
    triggerNotification,
    closeRenameFolder,
  ]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    },
    [handleRename, handleClose]
  );

  return {
    isOpen: isRenameFolderOpen,
    folderName,
    setFolderName,
    error,
    isSubmitting,
    inputRef,
    displayLocationPath,
    handleClose,
    handleRename,
    handleKeyDown,
  };
}
