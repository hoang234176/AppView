import { memo } from 'react';
import { FolderPlus, RefreshCw } from 'lucide-react';
import './EmptyContextMenu.css';

/**
 * EmptyContextMenu — Context menu shown when right-clicking on empty space
 */
export const EmptyContextMenu = memo(({
  onClose,
  onCreateFolder,
  onRefresh,
}) => {
  return (
    <>
      {/* Empty Space Option: Create New Folder */}
      <button
        type="button"
        onClick={() => {
          onClose();
          if (onCreateFolder) onCreateFolder();
        }}
        className="empty-context-menu-btn text-gray-200 hover:text-white hover:bg-blue-500/20"
      >
        <FolderPlus className="w-4 h-4 text-yellow-400" />
        <span>Tạo thư mục mới</span>
      </button>

      {/* Empty Space Option: Refresh */}
      {onRefresh && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onRefresh();
          }}
          className="empty-context-menu-btn text-gray-200 hover:text-white hover:bg-white/10"
        >
          <RefreshCw className="w-4 h-4 text-blue-400" />
          <span>Làm mới danh mục</span>
        </button>
      )}
    </>
  );
});

EmptyContextMenu.displayName = 'EmptyContextMenu';
