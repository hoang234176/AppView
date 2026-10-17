import { memo } from 'react';
import { SidebarBrand } from './SidebarBrand/SidebarBrand';
import { SidebarTree } from './SidebarTree/SidebarTree';
import { SidebarDrives } from './SidebarDrives/SidebarDrives';
import { SidebarSettings } from './SidebarSettings/SidebarSettings';
import './FolderTreeSidebar.css';

/**
 * FolderTreeSidebar — Main Desktop Sidebar assembled from modular sub-components:
 * 1. SidebarBrand (App logo & title)
 * 2. SidebarTree (Folder tree navigation & collapse all)
 * 3. SidebarDrives (Storage drives list with liquid wave indicators)
 * 4. SidebarSettings (Server settings button)
 */
export const FolderTreeSidebar = memo(({
  currentPath,
  treeData = [],
  folders = [],
  onNavigate,
  onOpenConfig,
  drives = [],
  activeDrive = 'SSD',
  onSelectDrive,
  onFolderContextMenu,
  onEmptyContextMenu,
}) => {
  return (
    <aside className="folder-tree-sidebar-aside tahoe-block">
      <div className="folder-tree-sidebar-inner">
        {/* Block 1: Logo and Brand Header */}
        <SidebarBrand onNavigate={onNavigate} />

        {/* Block 2: Folder Tree Navigation */}
        <SidebarTree
          currentPath={currentPath}
          treeData={treeData}
          folders={folders}
          activeDrive={activeDrive}
          onNavigate={onNavigate}
          onFolderContextMenu={onFolderContextMenu}
          onEmptyContextMenu={onEmptyContextMenu}
        />

        {/* Bottom Section: Block 3 (Drives) + Block 4 (Settings) */}
        <div className="folder-tree-sidebar-bottom">
          <SidebarDrives
            drives={drives}
            activeDrive={activeDrive}
            onSelectDrive={onSelectDrive}
            onNavigate={onNavigate}
          />

          <SidebarSettings onOpenConfig={onOpenConfig} />
        </div>
      </div>
    </aside>
  );
});

FolderTreeSidebar.displayName = 'FolderTreeSidebar';
