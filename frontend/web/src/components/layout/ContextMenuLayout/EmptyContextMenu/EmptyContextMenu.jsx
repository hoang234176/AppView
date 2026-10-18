import { memo } from 'react';
import { FolderPlus, RefreshCw } from 'lucide-react';
import { useEmptyContextMenu } from '../../../../hooks/contextMenu';

/**
 * EmptyContextMenu — Context menu shown when right-clicking on empty space
 */
export const EmptyContextMenu = memo(({
  onClose: propOnClose,
  onCreateFolder: propOnCreateFolder,
  onRefresh: propOnRefresh,
}) => {
  const hookData = useEmptyContextMenu();
  const onClose = propOnClose || hookData.onClose;
  const onCreateFolder = propOnCreateFolder || hookData.onCreateFolder;
  const onRefresh = propOnRefresh || hookData.onRefresh;

  return (
    <>
      {/* Empty Space Option: Create New Folder */}
      <button
        type="button"
        onClick={() => {
          if (onClose) onClose();
          if (onCreateFolder) onCreateFolder();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[14px] transition-colors cursor-pointer text-gray-200 hover:text-white hover:bg-blue-500/20"
      >
        <FolderPlus className="w-4 h-4 text-yellow-400" />
        <span>Tạo thư mục mới</span>
      </button>

      {/* Empty Space Option: Refresh */}
      {onRefresh && (
        <button
          type="button"
          onClick={() => {
            if (onClose) onClose();
            onRefresh();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[14px] transition-colors cursor-pointer text-gray-200 hover:text-white hover:bg-white/10"
        >
          <RefreshCw className="w-4 h-4 text-blue-400" />
          <span>Làm mới danh mục</span>
        </button>
      )}
    </>
  );
});

EmptyContextMenu.displayName = 'EmptyContextMenu';
