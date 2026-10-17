import React, { memo } from 'react';
import { FolderTreeSidebar } from '../components/FolderTreeSidebar';

/**
 * SidebarLayout — Area 1: Left Column Sidebar
 * Wraps FolderTree, Drive selector, and Server Configuration trigger.
 */
export const SidebarLayout = memo(({
  currentPath,
  treeData,
  folders,
  onNavigate,
  onFolderContextMenu,
  onEmptyContextMenu,
  onOpenConfig,
  drives,
  activeDrive,
  onSelectDrive,
}) => {
  return (
    <FolderTreeSidebar
      currentPath={currentPath}
      treeData={treeData}
      folders={folders}
      onNavigate={onNavigate}
      onFolderContextMenu={onFolderContextMenu}
      onEmptyContextMenu={onEmptyContextMenu}
      onOpenConfig={onOpenConfig}
      drives={drives}
      activeDrive={activeDrive}
      onSelectDrive={onSelectDrive}
    />
  );
});

SidebarLayout.displayName = 'SidebarLayout';
