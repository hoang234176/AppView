import { memo } from 'react';
import { Folder, FolderOpen, ChevronsUp } from 'lucide-react';
import { TreeNodeItem } from './TreeNodeItem';
import { useSidebarTree } from '../../../../hooks/sidebar';
import './SidebarTree.css';

/**
 * SidebarTree — Recursive and fallback folder list in sidebar
 */
export const SidebarTree = memo(({
  currentPath: propCurrentPath,
  treeData: propTreeData,
  folders: propFolders,
  activeDrive: propActiveDrive,
  onNavigate: propOnNavigate,
  onFolderContextMenu: propOnFolderContextMenu,
  onEmptyContextMenu: propOnEmptyContextMenu,
}) => {
  const hookData = useSidebarTree();

  const currentPath = propCurrentPath !== undefined ? propCurrentPath : hookData.currentPath;
  const treeData = propTreeData !== undefined ? propTreeData : hookData.treeData;
  const folders = propFolders !== undefined ? propFolders : hookData.folders;
  const activeDrive = propActiveDrive !== undefined ? propActiveDrive : hookData.activeDrive;
  const onNavigate = propOnNavigate || hookData.handleNavigate;
  const onFolderContextMenu = propOnFolderContextMenu || hookData.handleFolderContextMenu;
  const onEmptyContextMenu = propOnEmptyContextMenu || hookData.handleEmptyContextMenu;
  const { expandedNodes, toggleExpand, collapseAll } = hookData;


  return (
    <>
      {/* Subfolder Header with Collapse All */}
      <div className="sidebar-tree-header">
        <span className="sidebar-tree-header-title">
          <FolderOpen className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
          <span className="truncate">Thư mục trên {activeDrive}</span>
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-mono text-gray-400">
            {treeData?.length || folders?.length || 0} mục
          </span>
          {Object.keys(expandedNodes).length > 0 && (
            <button
              type="button"
              onClick={collapseAll}
              className="sidebar-tree-collapse-btn"
              title="Thu gọn tất cả"
            >
              <ChevronsUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Tree Area */}
      <div
        onContextMenu={(e) => {
          if (onEmptyContextMenu) {
            onEmptyContextMenu(e);
          }
        }}
        className="sidebar-tree-scroll-container space-y-1 custom-scrollbar"
      >
        {/* Render Full Tree */}
        {Array.isArray(treeData) && treeData.length > 0 ? (
          <div className="flex flex-col gap-1.5 pt-1">
            {treeData.map((node) => (
              <TreeNodeItem
                key={node.path || node.name}
                node={node}
                depth={1}
                currentPath={currentPath}
                onNavigate={onNavigate}
                expandedNodes={expandedNodes}
                toggleExpand={toggleExpand}
                onFolderContextMenu={onFolderContextMenu}
              />
            ))}
          </div>
        ) : (
          /* Fallback for flat folder list */
          folders && folders.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              {folders.map((subfolder) => {
                const isSelected = subfolder.path === currentPath;

                return (
                  <div
                    key={subfolder.path}
                    onClick={() => onNavigate(subfolder.path)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onFolderContextMenu) {
                        onFolderContextMenu(e, subfolder);
                      }
                    }}
                    className={`sidebar-tree-fallback-item ${
                      isSelected
                        ? 'sidebar-tree-fallback-selected'
                        : 'sidebar-tree-fallback-unselected'
                    }`}
                  >
                    <Folder
                      className={`w-4.5 h-4.5 flex-shrink-0 ${
                        isSelected
                          ? 'text-[#1c1d21] fill-[#1c1d21]/20'
                          : 'text-yellow-400 fill-yellow-400/20'
                      }`}
                    />
                    <span className="truncate">{subfolder.name}</span>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
});

SidebarTree.displayName = 'SidebarTree';
