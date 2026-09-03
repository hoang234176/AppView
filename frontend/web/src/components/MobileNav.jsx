import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Home, 
  X,
  Settings
} from 'lucide-react';

/**
 * Mobile Recursive Tree Node Component
 */
const MobileTreeNodeItem = ({ node, depth = 1, currentPath, onNavigate, onCloseDrawer, expandedNodes, toggleExpand }) => {
  const isSelected = node.path === currentPath;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = !!expandedNodes[node.path];

  const handleToggle = (e) => {
    e.stopPropagation();
    toggleExpand(node.path);
  };

  const handleSelect = () => {
    onNavigate(node.path);
    onCloseDrawer();
  };

  const paddingLeftVal = depth * 12 + 12;

  return (
    <div className="select-none">
      <div 
        onClick={handleSelect}
        className={`flex items-center gap-2 py-3 min-h-[44px] rounded-[24px] text-sm font-medium cursor-pointer transition-all ${
          isSelected 
            ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md' 
            : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
        }`}
        style={{ paddingLeft: `${paddingLeftVal}px`, paddingRight: '12px' }}
      >
        {hasChildren ? (
          <button 
            onClick={handleToggle}
            className={`w-6 h-6 rounded-full hover:bg-black/20 flex items-center justify-center flex-shrink-0 transition-transform ${
              isSelected ? 'text-[#1c1d21]' : 'text-gray-400 hover:text-white'
            }`}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-6 h-6 flex-shrink-0" />
        )}

        {isExpanded ? (
          <FolderOpen className={`w-4.5 h-4.5 flex-shrink-0 ${isSelected ? 'text-[#1c1d21]' : 'text-yellow-400'}`} />
        ) : (
          <Folder className={`w-4.5 h-4.5 flex-shrink-0 ${isSelected ? 'text-[#1c1d21] fill-[#1c1d21]/20' : 'text-yellow-400 fill-yellow-400/20'}`} />
        )}

        <span className="truncate">{node.name}</span>
      </div>

      {hasChildren && isExpanded && (
        <div className="flex flex-col gap-1.5 mt-1">
          {node.children.map((childNode) => (
            <MobileTreeNodeItem
              key={childNode.path || childNode.name}
              node={childNode}
              depth={depth + 1}
              currentPath={currentPath}
              onNavigate={onNavigate}
              onCloseDrawer={onCloseDrawer}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const MobileNav = ({
  isOpen = false,
  onClose,
  currentPath,
  treeData = [],
  folders = [],
  onNavigate,
  onOpenConfig
}) => {
  const [expandedNodes, setExpandedNodes] = useState({});

  const toggleExpand = (path, forceExpand = null) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [path]: forceExpand !== null ? forceExpand : !prev[path]
    }));
  };

  if (!isOpen) return null;

  return (
    /* Slide-over Mobile Folder Tree Drawer Modal (Slides horizontally from Left to Right) */
    <div className="md:hidden fixed inset-0 z-50 flex animate-fade-in">
      {/* Dark backdrop overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/75"
      />

      {/* Drawer content: Animated Slide-in from Left */}
      <div className="relative w-80 max-w-[85vw] bg-[#1c1d21] border-r border-[#383c42] h-full flex flex-col p-4 shadow-2xl z-10 animate-slide-in-left">
        {/* Drawer Header: Displays ONLY 'DANH MỤC THƯ MỤC' and Close Button */}
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-[#383c42] flex-shrink-0">
          <span className="font-extrabold text-sm text-gray-300 uppercase tracking-widest px-1">
            Danh mục thư mục
          </span>

          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            title="Đóng danh mục"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Folder Tree Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
          {/* Root Node */}
          <div 
            onClick={() => {
              onNavigate('');
              onClose();
            }}
            className={`flex items-center gap-3 py-3 min-h-[44px] rounded-[24px] text-sm font-semibold cursor-pointer transition-all ${
              currentPath === '' 
                ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md' 
                : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
            }`}
            style={{ paddingLeft: '12px', paddingRight: '12px' }}
          >
            <Home className="w-4.5 h-4.5 text-blue-400 flex-shrink-0" />
            <span className="truncate">Thư viện gốc (Root)</span>
          </div>

          {/* Recursive Tree Data */}
          {Array.isArray(treeData) && treeData.length > 0 ? (
            <div className="flex flex-col gap-1.5 pt-1">
              {treeData.map((node) => (
                <MobileTreeNodeItem
                  key={node.path || node.name}
                  node={node}
                  depth={1}
                  currentPath={currentPath}
                  onNavigate={onNavigate}
                  onCloseDrawer={onClose}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                />
              ))}
            </div>
          ) : (
            folders && folders.length > 0 && (
              <div className="pt-1 space-y-1">
                {folders.map((subfolder) => {
                  const isSelected = subfolder.path === currentPath;

                  return (
                    <div 
                      key={subfolder.path}
                      onClick={() => {
                        onNavigate(subfolder.path);
                        onClose();
                      }}
                      className={`flex items-center gap-2.5 py-3 min-h-[44px] rounded-[24px] text-sm font-medium cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md' 
                          : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
                      }`}
                      style={{ paddingLeft: '12px' }}
                    >
                      <Folder className="w-4.5 h-4.5 text-yellow-400 fill-yellow-400/20 flex-shrink-0" />
                      <span className="truncate">{subfolder.name}</span>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Bottom Settings Button in Mobile Drawer */}
        {onOpenConfig && (
          <div className="pt-3 mt-4 border-t border-[#383c42] flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                onOpenConfig();
                onClose();
              }}
              className="w-full flex items-center justify-between p-3 rounded-[24px] bg-[#28292d] hover:bg-[#383c42] text-gray-200 text-xs font-semibold border border-[#383c42] transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4.5 h-4.5 text-blue-400" />
                <span>Cài đặt Máy chủ</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
