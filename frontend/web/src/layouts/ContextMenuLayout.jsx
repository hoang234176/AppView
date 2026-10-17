import { memo } from 'react';
import {
  ContextMenuWrapper,
  EmptyContextMenu,
  FolderContextMenu,
} from '../components/layout/ContextMenuLayout';
import './ContextMenuLayout.css';

/**
 * ContextMenuLayout — Right-Click Flyout Management Layout
 * Dispatches to specialized menu components depending on contextMenu.mode ('empty' | 'folder').
 */
export const ContextMenuLayout = memo(({
  contextMenu, // { isOpen, x, y, mode, folder }
  onClose,
  onCreateFolder,
  onRenameFolder,
  onCopyFolder,
  onMoveFolder,
  onDeleteFolder,
  onRefresh,
}) => {
  if (!contextMenu?.isOpen) return null;

  return (
    <div className="context-menu-layout-container">
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
    </div>
  );
});

ContextMenuLayout.displayName = 'ContextMenuLayout';
