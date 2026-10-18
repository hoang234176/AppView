import { useContextMenuContext } from '../../contexts/ContextMenuContext';

/**
 * useFolderContextMenu — Hook for FolderContextMenu
 * Extracts folder target and folder mutation handlers
 */
export function useFolderContextMenu() {
  const {
    contextMenu,
    onClose,
    onRenameFolder,
    onCopyFolder,
    onMoveFolder,
    onDeleteFolder,
  } = useContextMenuContext();

  return {
    folder: contextMenu?.folder || null,
    onClose,
    onRename: onRenameFolder,
    onCopy: onCopyFolder,
    onMove: onMoveFolder,
    onDelete: onDeleteFolder,
  };
}
