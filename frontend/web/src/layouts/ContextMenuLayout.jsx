import { memo } from 'react';
import {
  ContextMenuWrapper,
  EmptyContextMenu,
  FolderContextMenu,
} from '../components/layout/ContextMenuLayout';
import { useContextMenu } from '../hooks/contextMenu';

/**
 * ContextMenuLayout — Right-Click Flyout Management Layout
 * Dispatches to specialized menu components depending on contextMenu.mode ('empty' | 'folder').
 */
export const ContextMenuLayout = memo(({
  contextMenu: propContextMenu,
  onClose: propOnClose,
  onCreateFolder,
  onRenameFolder,
  onCopyFolder,
  onMoveFolder,
  onDeleteFolder,
  onRefresh,
} = {}) => {
  const hookData = useContextMenu();
  const contextMenu = propContextMenu !== undefined ? propContextMenu : hookData;
  const onClose = propOnClose || hookData.onClose;

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
