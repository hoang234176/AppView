import { memo } from 'react';
import { Edit3, Folder, FolderInput, Trash2, Copy } from 'lucide-react';
import { useFolderContextMenu } from '../../../../hooks/contextMenu';

/**
 * FolderContextMenu — Context menu shown when right-clicking on a folder card or tree node
 */
export const FolderContextMenu = memo(({
  folder: propFolder,
  onClose: propOnClose,
  onRename: propOnRename,
  onCopy: propOnCopy,
  onMove: propOnMove,
  onDelete: propOnDelete,
}) => {
  const hookData = useFolderContextMenu();
  const folder = propFolder !== undefined ? propFolder : hookData.folder;
  const onClose = propOnClose || hookData.onClose;
  const onRename = propOnRename || hookData.onRename;
  const onCopy = propOnCopy || hookData.onCopy;
  const onMove = propOnMove || hookData.onMove;
  const onDelete = propOnDelete || hookData.onDelete;

  if (!folder) return null;

  return (
    <>
      {/* Header indicator showing target folder name */}
      <div className="px-3 py-1.5 text-[11px] text-gray-400 font-mono border-b border-[#383c42] flex items-center gap-1.5 truncate">
        <Folder className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
        <span className="truncate font-semibold text-gray-300">{folder.name}</span>
      </div>

      {/* Folder Context Menu Option: Rename */}
      <button
        type="button"
        onClick={() => {
          if (onClose) onClose();
          if (onRename) onRename(folder);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[14px] transition-colors cursor-pointer text-gray-200 hover:text-white hover:bg-blue-500/20"
      >
        <Edit3 className="w-4 h-4 text-blue-400" />
        <span>Đổi tên thư mục</span>
      </button>

      {/* Folder Context Menu Option: Copy */}
      <button
        type="button"
        onClick={() => {
          if (onClose) onClose();
          if (onCopy) onCopy(folder);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[14px] transition-colors cursor-pointer text-gray-200 hover:text-white hover:bg-blue-500/20"
      >
        <Copy className="w-4 h-4 text-blue-400" />
        <span>Sao chép thư mục</span>
      </button>

      {/* Folder Context Menu Option: Move */}
      <button
        type="button"
        onClick={() => {
          if (onClose) onClose();
          if (onMove) onMove(folder);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[14px] transition-colors cursor-pointer text-gray-200 hover:text-white hover:bg-amber-500/20"
      >
        <FolderInput className="w-4 h-4 text-amber-400" />
        <span>Di chuyển thư mục</span>
      </button>

      {/* Folder Context Menu Option: Delete */}
      <button
        type="button"
        onClick={() => {
          if (onClose) onClose();
          if (onDelete) onDelete(folder);
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-[14px] transition-colors cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/20"
      >
        <Trash2 className="w-4 h-4 text-red-400" />
        <span>Xóa thư mục</span>
      </button>
    </>
  );
});

FolderContextMenu.displayName = 'FolderContextMenu';
