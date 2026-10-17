import { useState, useEffect, memo } from 'react';
import { Folder, FolderOpen, ChevronRight } from 'lucide-react';
import { RollingNumber } from '../../../common/RollingNumber';
import './TreeNodeItem.css';

/**
 * Recursive Tree Node Component with smooth hover & badges
 */
export const TreeNodeItem = memo(({
  node,
  depth = 1,
  currentPath,
  onNavigate,
  expandedNodes,
  toggleExpand,
  onFolderContextMenu,
}) => {
  const isSelected = node.path === currentPath;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const [childrenMounted, setChildrenMounted] = useState(false);

  const isExpanded = !!expandedNodes[node.path];

  useEffect(() => {
    if (isExpanded) {
      setChildrenMounted(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setChildrenMounted(false), 200);
    return () => window.clearTimeout(timer);
  }, [isExpanded]);

  const handleToggle = (e) => {
    e.stopPropagation();
    toggleExpand(node.path);
  };

  const handleSelect = () => {
    onNavigate(node.path);
    if (hasChildren && !isExpanded) {
      toggleExpand(node.path, true);
    }
  };

  // Cấp đầu căn theo padding sidebar 12px; mỗi cấp con thụt 20px để phân tầng
  const paddingLeftVal = depth * 20 - 8;

  return (
    <div className="select-none">
      <div
        onClick={handleSelect}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onFolderContextMenu) {
            onFolderContextMenu(e, { name: node.name, path: node.path });
          }
        }}
        className={`group tree-node-item ${
          isSelected ? 'tree-node-item-selected' : 'tree-node-item-unselected'
        }`}
        style={{ paddingLeft: `${paddingLeftVal}px`, paddingRight: '12px' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Expand / Collapse Chevron button */}
          {hasChildren ? (
            <button
              type="button"
              onClick={handleToggle}
              className={`tree-node-chevron-btn ${
                isSelected ? 'text-[#1c1d21]' : 'text-gray-400 hover:text-white'
              }`}
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${
                  isExpanded ? 'rotate-90' : 'rotate-0'
                }`}
              />
            </button>
          ) : (
            <span className="w-5 h-5 flex-shrink-0" />
          )}

          {/* Folder Icon */}
          {isExpanded ? (
            <FolderOpen
              className={`w-4.5 h-4.5 flex-shrink-0 ${
                isSelected ? 'text-[#1c1d21]' : 'text-yellow-400'
              }`}
            />
          ) : (
            <Folder
              className={`w-4.5 h-4.5 flex-shrink-0 ${
                isSelected
                  ? 'text-[#1c1d21] fill-[#1c1d21]/20'
                  : 'text-yellow-400 fill-yellow-400/20'
              }`}
            />
          )}

          {/* Folder Name */}
          <span className="truncate">{node.name}</span>
        </div>

        {/* Count Badge for subfolders */}
        {hasChildren && (
          <span
            className={`tree-node-badge ${
              isSelected ? 'tree-node-badge-selected' : 'tree-node-badge-unselected'
            }`}
          >
            <RollingNumber value={node.children.length} />
          </span>
        )}
      </div>

      {/* Render Nested Subfolders Recursively */}
      {hasChildren && childrenMounted && (
        <div
          className={`tree-children mt-1 ${
            isExpanded ? 'tree-children-opening' : 'tree-children-closing'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-1.5">
              {node.children.map((childNode) => (
                <TreeNodeItem
                  key={childNode.path || childNode.name}
                  node={childNode}
                  depth={depth + 1}
                  currentPath={currentPath}
                  onNavigate={onNavigate}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                  onFolderContextMenu={onFolderContextMenu}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

TreeNodeItem.displayName = 'TreeNodeItem';
