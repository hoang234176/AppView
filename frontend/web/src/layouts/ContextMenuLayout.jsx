import { memo } from 'react';
import {
  ContextMenuWrapper,
  EmptyContextMenu,
  FolderContextMenu,
} from '../components/layout/ContextMenuLayout';
import { useContextMenuContext } from '../contexts/ContextMenuContext';

/**
 * ContextMenuLayout — Right-Click Flyout Management Layout
 * Dispatches to specialized menu components depending on contextMenu.mode ('empty' | 'folder').
 */
export const ContextMenuLayout = memo(({
  contextMenu: propContextMenu,
  onClose: propOnClose,
  onCreateFolder: propOnCreateFolder,
  onRenameFolder: propOnRenameFolder,
  onCopyFolder: propOnCopyFolder,
  onMoveFolder: propOnMoveFolder,
  onDeleteFolder: propOnDeleteFolder,
  onRefresh: propOnRefresh,
} = {}) => {
  const context = useContextMenuContext();
  const contextMenu = propContextMenu !== undefined ? propContextMenu : context.contextMenu;
  const onClose = propOnClose || context.onClose;
  const onCreateFolder = propOnCreateFolder || context.onCreateFolder;
  const onRenameFolder = propOnRenameFolder || context.onRenameFolder;
  const onCopyFolder = propOnCopyFolder || context.onCopyFolder;
  const onMoveFolder = propOnMoveFolder || context.onMoveFolder;
  const onDeleteFolder = propOnDeleteFolder || context.onDeleteFolder;
  const onRefresh = propOnRefresh || context.onRefresh;

  if (!contextMenu?.isOpen) return null;

  return (
    <ContextMenuWrapper
      x={contextMenu.x}
      y={contextMenu.y}
      mode={contextMenu.mode}
      onClose={onClose}
    >
      {contextMenu.mode === 'folder' && contextMenu.folder && (
        <FolderContextMenu
          folder={contextMenu.folder}
          onClose={onClose}
          onRename={onRenameFolder}
          onCopy={onCopyFolder}
          onMove={onMoveFolder}
          onDelete={onDeleteFolder}
        />
      )}

      {contextMenu.mode === 'empty' && (
        <EmptyContextMenu
          onClose={onClose}
          onCreateFolder={onCreateFolder}
          onRefresh={onRefresh}
        />
      )}
    </ContextMenuWrapper>
  );
});

ContextMenuLayout.displayName = 'ContextMenuLayout';
