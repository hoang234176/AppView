import { useState, useRef, useEffect, useCallback } from 'react';
import useLayout from './useLayout';

/**
 * Custom Hook quản lý trạng thái, tọa độ hiển thị và sự kiện của FolderContextMenu
 * Tuân thủ Quy tắc 8, 9, 10, 14 và 15 của frontend/web/AGENTS.md
 */
export default function useFolderContextMenu() {
  const { openRenameFolder, openGetInfo, openDeleteFolder } = useLayout();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [targetFolder, setTargetFolder] = useState(null);
  const menuRef = useRef(null);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTargetFolder(null);
    window.dispatchEvent(new CustomEvent('folder-context-menu-closed'));
  }, []);

  // Lắng nghe sự kiện mở menu từ click chuột phải vào thư mục
  useEffect(() => {
    const handleOpen = (e) => {
      const { clientX, clientY, target } = e.detail || {};
      const menuWidth = 190;
      const approxHeight = 220;

      // Giới hạn trong khung nhìn (Viewport bounding)
      const x = Math.min(clientX, window.innerWidth - menuWidth - 12);
      const y = Math.min(clientY, window.innerHeight - approxHeight - 12);

      setMenuPos({
        x: Math.max(12, x),
        y: Math.max(12, y),
      });
      setTargetFolder(target || null);
      setIsOpen(true);
    };

    const handleExternalClose = () => {
      handleClose();
    };

    window.addEventListener('open-folder-context-menu', handleOpen);
    window.addEventListener('close-folder-context-menu', handleExternalClose);
    window.addEventListener('open-more-menu', handleExternalClose);
    window.addEventListener('close-more-menu', handleExternalClose);

    return () => {
      window.removeEventListener('open-folder-context-menu', handleOpen);
      window.removeEventListener('close-folder-context-menu', handleExternalClose);
      window.removeEventListener('open-more-menu', handleExternalClose);
      window.removeEventListener('close-more-menu', handleExternalClose);
    };
  }, [handleClose]);

  // Đóng menu khi click ra ngoài, cuộn trang hoặc bấm Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      handleClose();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    const handleScroll = () => {
      handleClose();
    };

    const handleResize = () => {
      handleClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, handleClose]);

  // Xử lý các hành động trên menu
  const handleAction = useCallback(
    (actionKey, folder) => {
      handleClose();
      if (actionKey === 'rename' && folder) {
        openRenameFolder(folder);
      } else if (actionKey === 'info' && folder) {
        openGetInfo(folder);
      } else if (actionKey === 'delete' && folder) {
        openDeleteFolder(folder);
      }
    },
    [handleClose, openRenameFolder, openGetInfo, openDeleteFolder]
  );

  return {
    isOpen,
    menuPos,
    targetFolder,
    menuRef,
    handleClose,
    handleAction,
  };
}
