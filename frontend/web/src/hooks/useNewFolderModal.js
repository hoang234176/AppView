import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import useLayout from './useLayout';
import { createFolderApi } from '../api/apiCoordinator';
import { resolveCoordinatorHostPort } from '../utils/cookieUtils';

/**
 * Custom Hook quản lý toàn bộ nghiệp vụ, trạng thái mở/đóng và tương tác tạo thư mục mới
 * Tuân thủ Quy tắc 8, 9 và 10 của frontend/web/AGENTS.md
 */
export default function useNewFolderModal() {
  const location = useLocation();
  const {
    isNewFolderOpen,
    closeNewFolder,
    serverConfig,
    hasServerConnection,
    triggerNotification,
  } = useLayout();

  const [folderName, setFolderName] = useState('Untitled folder');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isNewFolderOpen);
  const inputRef = useRef(null);

  // Chuẩn React: Đồng bộ lại trạng thái khi Modal được kích hoạt mở
  if (prevIsOpen !== isNewFolderOpen) {
    setPrevIsOpen(isNewFolderOpen);
    if (isNewFolderOpen) {
      setFolderName('Untitled folder');
      setError('');
      setIsSubmitting(false);
    }
  }

  // Tự động focus và bôi đen toàn bộ tên gợi ý khi mở Modal
  useEffect(() => {
    if (isNewFolderOpen) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isNewFolderOpen]);

  // Phân giải driveId và path từ URL hiện tại
  const { activeDriveId, currentPath, displayLocationPath } = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    let driveId = 'HDD';
    if (pathParts.length > 0 && pathParts[0] !== 'settings') {
      if (pathParts[0] === 'drives' && pathParts.length > 1) {
        driveId = decodeURIComponent(pathParts[1]);
      } else {
        driveId = decodeURIComponent(pathParts[0]);
      }
    }
    if (driveId === 'drive-1') driveId = 'HDD';
    if (driveId === 'drive-2') driveId = 'SSD';

    const queryParams = new URLSearchParams(location.search);
    const path = queryParams.get('path') || '';

    // Tạo chuỗi hiển thị vị trí chuẩn Finder (vd: HDD > Subfolder)
    const cleanSubPath = path.trim().replace(/^\/+|\/+$/g, '');
    const displayLocationPath = cleanSubPath
      ? `${driveId} > ${cleanSubPath.split('/').join(' > ')}`
      : driveId;

    return { activeDriveId: driveId, currentPath: path, displayLocationPath };
  }, [location.pathname, location.search]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    closeNewFolder();
  }, [isSubmitting, closeNewFolder]);

  const handleCreate = useCallback(async () => {
    const trimmed = folderName.trim();
    if (!trimmed) {
      setError('Tên thư mục không được để trống.');
      inputRef.current?.focus();
      return;
    }

    if (/[\\/:*?"<>|]/.test(trimmed)) {
      setError('Tên thư mục không được chứa các ký tự \\ / : * ? " < > |');
      inputRef.current?.focus();
      return;
    }

    if (!hasServerConnection) {
      setError('Mất kết nối với máy chủ.');
      return;
    }

    const { host, port } = resolveCoordinatorHostPort(serverConfig);
    if (!host || !port) {
      setError('Thiếu thông tin kết nối máy chủ.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await createFolderApi(host, port, {
        drive: activeDriveId,
        path: currentPath,
        name: trimmed,
      });

      if (!res.ok) {
        const errorMsg = res.error || 'Không thể tạo thư mục.';
        setError(errorMsg);
        triggerNotification({
          type: 'error',
          title: 'Lỗi tạo thư mục',
          message: errorMsg,
        });
        return;
      }

      triggerNotification({
        type: 'success',
        title: 'Thành công',
        message: `Đã tạo thư mục "${trimmed}"`,
      });

      // Phát sự kiện để ContentsView gắn thư mục mới vào cuối cùng của danh sách hiện tại
      window.dispatchEvent(
        new CustomEvent('folder-created-optimistic', {
          detail: {
            folder: res.data || {
              name: trimmed,
              path: currentPath ? `${currentPath.replace(/^\/+|\/+$/g, '')}/${trimmed}` : trimmed,
              type: 'folder',
            },
            drive: activeDriveId,
            path: currentPath,
          },
        })
      );

      closeNewFolder();
    } catch (err) {
      const errMsg = err.message || 'Lỗi kết nối khi gửi yêu cầu tạo thư mục.';
      setError(errMsg);
      triggerNotification({
        type: 'error',
        title: 'Lỗi tạo thư mục',
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    folderName,
    hasServerConnection,
    serverConfig,
    activeDriveId,
    currentPath,
    triggerNotification,
    closeNewFolder,
  ]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    },
    [handleCreate, handleClose]
  );

  return {
    isOpen: isNewFolderOpen,
    folderName,
    setFolderName,
    error,
    isSubmitting,
    inputRef,
    displayLocationPath,
    handleClose,
    handleCreate,
    handleKeyDown,
  };
}
