import React, { useEffect, useRef } from 'react';
import { FolderPlus, RefreshCw, Edit3, Folder, FolderInput, Trash2 } from 'lucide-react';

export const ContextMenu = ({ 
  x, 
  y, 
  isOpen, 
  onClose, 
  mode = 'empty', 
  targetFolder = null,
  onCreateFolder, 
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onRefresh 
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuWidth = 220;
  const menuHeight = mode === 'folder' ? 140 : 120;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-[99999] bg-[#1c1d21] border border-[#383c42] rounded-[18px] p-1.5 shadow-2xl w-56 animate-fade-in space-y-1 select-none"
    >
      {mode === 'folder' && targetFolder ? (
        <>
          {/* Header indicator showing target folder name */}
          <div className="px-3 py-1.5 text-[11px] text-gray-400 font-mono border-b border-[#383c42] flex items-center gap-1.5 truncate">
            <Folder className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
            <span className="truncate font-semibold text-gray-300">{targetFolder.name}</span>
          </div>

          {/* Folder Context Menu Option: Rename */}
          <button
            onClick={() => {
              onClose();
              if (onRenameFolder) onRenameFolder(targetFolder);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-200 hover:text-white hover:bg-blue-500/20 rounded-[14px] transition-colors"
          >
            <Edit3 className="w-4 h-4 text-blue-400" />
            <span>Đổi tên thư mục</span>
          </button>

          {/* Folder Context Menu Option: Move */}
          <button
            onClick={() => {
              onClose();
              if (onMoveFolder) onMoveFolder(targetFolder);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-200 hover:text-white hover:bg-amber-500/20 rounded-[14px] transition-colors"
          >
            <FolderInput className="w-4 h-4 text-amber-400" />
            <span>Di chuyển thư mục</span>
          </button>

          {/* Folder Context Menu Option: Delete */}
          <button
            onClick={() => {
              onClose();
              if (onDeleteFolder) onDeleteFolder(targetFolder);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-[14px] transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Xóa thư mục</span>
          </button>
        </>
      ) : (
        <>
          {/* Empty Space Option: Create New Folder */}
          <button
            onClick={() => {
              onClose();
              if (onCreateFolder) onCreateFolder();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-gray-200 hover:text-white hover:bg-blue-500/20 rounded-[14px] transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-yellow-400" />
            <span>Tạo thư mục mới</span>
          </button>

          {/* Empty Space Option: Refresh */}
          {onRefresh && (
            <button
              onClick={() => {
                onClose();
                onRefresh();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-gray-200 hover:text-white hover:bg-white/10 rounded-[14px] transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-blue-400" />
              <span>Làm mới danh mục</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};
