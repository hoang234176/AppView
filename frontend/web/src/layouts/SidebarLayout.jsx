import { memo } from 'react';
import {
  SidebarBrand,
  SidebarTree,
  SidebarDrives,
  SidebarSettings,
} from '../components/layout/SidebarLayout';
import './SidebarLayout.css';

/**
 * SidebarLayout — Area 1: Left Column Sidebar
 * Modular assembly of SidebarBrand, SidebarTree, SidebarDrives, and SidebarSettings.
 */
export const SidebarLayout = memo(() => {
  return (
    <aside className="folder-tree-sidebar-aside tahoe-block">
      <div className="folder-tree-sidebar-inner">
        {/* Block 1: Logo and Brand Header */}
        <SidebarBrand />

        {/* Block 2: Folder Tree Navigation */}
        <SidebarTree />

        {/* Bottom Section: Block 3 (Drives) + Block 4 (Settings) */}
        <div className="folder-tree-sidebar-bottom">
          <SidebarDrives />
          <SidebarSettings />
        </div>
      </div>
    </aside>
  );
});

SidebarLayout.displayName = 'SidebarLayout';
