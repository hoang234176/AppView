import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useLayout from './useLayout';
import { deleteFolderApi } from '../api/apiCoordinator';
import { resolveCoordinatorHostPort } from '../utils/cookieUtils';

/**
 * Custom Hook quản lý dữ liệu, trạng thái và nghiệp vụ của DeleteFolderModal
 * Tuân thủ Quy tắc 8 (try-catch-finally), 9 (Notification), 10 (Logic in hooks), 14 (100% English) và 15 (No-pointer cursor)
 */
export default function useDeleteFolderModal() {
  const location = useLocation();
  const navigate = useNavigate();
  const { driveId } = useParams();

  const {
    isDeleteFolderOpen,
    closeDeleteFolder,
    deleteTarget,
    serverConfig,
    hasServerConnection,
    triggerNotification,
  } = useLayout();

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [prevIsOpen, setPrevIsOpen] = useState(isDeleteFolderOpen);

  // Đặt lại lỗi và trạng thái loading khi mở lại Modal
  if (prevIsOpen !== isDeleteFolderOpen) {
    setPrevIsOpen(isDeleteFolderOpen);
    if (isDeleteFolderOpen) {
      setError('');
      setIsDeleting(false);
    }
  }

  // Xác định thông tin thư mục mục tiêu cần xóa
  const targetInfo = useMemo(() => {
    let drive = deleteTarget?.drive || driveId || '';
    if (!drive) {
      const pathParts = location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0 && pathParts[0] !== 'settings') {
        if (pathParts[0] === 'drives' && pathParts.length > 1) {
          drive = decodeURIComponent(pathParts[1]);
        } else {
          drive = decodeURIComponent(pathParts[0]);
        }
      }
    }
    if (drive === 'drive-1' || !drive) drive = 'HDD';
    if (drive === 'drive-2') drive = 'SSD';

    const rawPath = String(deleteTarget?.path || '').trim();
    const cleanPath = rawPath.replace(/^\/+|\/+$/g, '');
    const name = deleteTarget?.name || (cleanPath ? cleanPath.split('/').pop() : drive);

    return {
      drive,
      path: cleanPath,
      name,
    };
  }, [deleteTarget, driveId, location.pathname]);

  const handleClose = useCallback(() => {
    if (isDeleting) return;
    setError('');
    closeDeleteFolder();
  }, [isDeleting, closeDeleteFolder]);

  // Xử lý xác nhận xóa thư mục
  const handleDelete = useCallback(async () => {
    if (!hasServerConnection) {
      const msg = 'Lost connection to server.';
      setError(msg);
      triggerNotification({
        type: 'error',
        title: 'Delete Failed',
        message: msg,
      });
      return;
    }

    const { host, port } = resolveCoordinatorHostPort(serverConfig);
    if (!host || !port) {
      const msg = 'Missing server connection information.';
      setError(msg);
      triggerNotification({
        type: 'error',
        title: 'Delete Failed',
        message: msg,
      });
      return;
    }

    const { drive, path, name } = targetInfo;
    if (!path || path === '/' || path === '.') {
      const msg = 'Cannot delete root drive folder.';
      setError(msg);
      triggerNotification({
        type: 'error',
        title: 'Delete Failed',
        message: msg,
      });
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      const res = await deleteFolderApi(host, port, {
        drive,
        path,
      });

      if (!res.ok) {
        const errorMsg = res.error || 'Failed to delete folder.';
        setError(errorMsg);
        triggerNotification({
          type: 'error',
          title: 'Delete Failed',
          message: errorMsg,
        });
        return;
      }

      // Thông báo thành công
      triggerNotification({
        type: 'success',
        title: 'Deleted',
        message: `Folder "${name}" was deleted successfully.`,
      });

      // Phát sự kiện toàn cục để SidebarTree và ContentsView cập nhật lại
      window.dispatchEvent(
        new CustomEvent('folder-deleted', {
          detail: {
            drive,
            path,
            name,
          },
        })
      );
      window.dispatchEvent(new CustomEvent('refresh-tree'));

      // Kiểm tra nếu người dùng đang đứng ở chính thư mục vừa xóa (hoặc thư mục con bên trong)
      const currentSearchParams = new URLSearchParams(location.search);
      const currentNavPath = (currentSearchParams.get('path') || '').replace(/^\/+|\/+$/g, '');

      if (currentNavPath === path || currentNavPath.startsWith(`${path}/`)) {
        const parentPath = path.includes('/')
          ? path.slice(0, path.lastIndexOf('/'))
          : '';
        const targetUrl = parentPath
          ? `/drives/${encodeURIComponent(drive)}?path=${encodeURIComponent(parentPath)}`
          : `/drives/${encodeURIComponent(drive)}`;
        navigate(targetUrl, { replace: true });
      }

      closeDeleteFolder();
    } catch (err) {
      const errMsg = err.message || 'An unexpected error occurred while deleting folder.';
      setError(errMsg);
      triggerNotification({
        type: 'error',
        title: 'Delete Failed',
        message: errMsg,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [
    hasServerConnection,
    serverConfig,
    targetInfo,
    triggerNotification,
    location.search,
    navigate,
    closeDeleteFolder,
  ]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleDelete();
      }
    },
    [handleClose, handleDelete]
  );

  return {
    isOpen: isDeleteFolderOpen,
    isDeleting,
    error,
    folderName: targetInfo.name,
    folderPath: targetInfo.path,
    folderDrive: targetInfo.drive,
    handleClose,
    handleDelete,
    handleKeyDown,
  };
}
