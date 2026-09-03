import React, { useState, useEffect, useMemo } from 'react';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  Home, 
  Image as ImageIcon,
  Search,
  ChevronsUp,
  X,
  Settings
} from 'lucide-react';
import { parseBreadcrumbs } from '../utils/formatters';

/**
 * Filter tree nodes recursively based on search query
 */
const filterTreeNodes = (nodes, query) => {
  if (!query || !query.trim()) return nodes;
  const q = query.toLowerCase().trim();

  return nodes.reduce((acc, node) => {
    const nameMatch = node.name?.toLowerCase().includes(q);
    const pathMatch = node.path?.toLowerCase().includes(q);
    const filteredChildren = Array.isArray(node.children) 
      ? filterTreeNodes(node.children, query) 
      : [];

    if (nameMatch || pathMatch || filteredChildren.length > 0) {
      acc.push({
        ...node,
        children: filteredChildren
      });
    }
    return acc;
  }, []);
};

/**
 * Recursive Tree Node Component with smooth hover & badges
 */
const TreeNodeItem = ({ node, depth = 1, currentPath, onNavigate, expandedNodes, toggleExpand, searchQuery }) => {
  const isSelected = node.path === currentPath;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const [childrenMounted, setChildrenMounted] = useState(false);
  
  // Auto expand node if user is searching
  const isExpanded = searchQuery.trim() !== '' ? true : !!expandedNodes[node.path];

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

  // Cấp đầu căn theo padding sidebar 12px; mỗi cấp con thụt 20px để phân
  // tầng rõ ràng mà không cần các đường connector gây rối giao diện.
  // depth 1 = 12px, depth 2 = 32px, depth 3 = 52px.
  const paddingLeftVal = depth * 20 - 8;

  return (
    <div className="select-none">
      <div 
        onClick={handleSelect}
        className={`group relative flex items-center justify-between gap-2 py-3 min-h-[44px] rounded-[24px] text-sm font-medium cursor-pointer transition-all ${
          isSelected 
            ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md' 
            : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
        }`}
        style={{ paddingLeft: `${paddingLeftVal}px`, paddingRight: '12px' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Expand / Collapse Chevron button */}
          {hasChildren ? (
            <button 
              onClick={handleToggle}
              className={`w-5 h-5 rounded-full hover:bg-black/20 flex items-center justify-center flex-shrink-0 transition-transform ${
                isSelected ? 'text-[#1c1d21]' : 'text-gray-400 hover:text-white'
              }`}
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} />
            </button>
          ) : (
            <span className="w-5 h-5 flex-shrink-0" />
          )}

          {/* Folder Icon */}
          {isExpanded ? (
            <FolderOpen className={`w-4.5 h-4.5 flex-shrink-0 ${isSelected ? 'text-[#1c1d21]' : 'text-yellow-400'}`} />
          ) : (
            <Folder className={`w-4.5 h-4.5 flex-shrink-0 ${isSelected ? 'text-[#1c1d21] fill-[#1c1d21]/20' : 'text-yellow-400 fill-yellow-400/20'}`} />
          )}

          {/* Folder Name */}
          <span className="truncate">{node.name}</span>
        </div>

        {/* Count Badge for subfolders */}
        {hasChildren && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
            isSelected 
              ? 'bg-[#1c1d21]/20 text-[#1c1d21] font-bold' 
              : 'bg-[#28292d] text-gray-400 group-hover:text-gray-200'
          }`}>
            {node.children.length}
          </span>
        )}
      </div>

      {/* Render Nested Subfolders Recursively */}
      {hasChildren && childrenMounted && (
        <div className={`tree-children mt-1 ${isExpanded ? 'tree-children-opening' : 'tree-children-closing'}`}>
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
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const FolderTreeSidebar = ({ 
  currentPath, 
  treeData = [], 
  folders = [], 
  onNavigate,
  onOpenConfig
}) => {
  const [expandedNodes, setExpandedNodes] = useState({});
  const [treeSearchQuery, setTreeSearchQuery] = useState('');

  const toggleExpand = (path, forceExpand = null) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [path]: forceExpand !== null ? forceExpand : !prev[path]
    }));
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  useEffect(() => {
    if (currentPath) {
      const parts = currentPath.split('/');
      const newExpanded = { ...expandedNodes };
      let accPath = '';
      parts.forEach((part) => {
        accPath = accPath ? `${accPath}/${part}` : part;
        newExpanded[accPath] = true;
      });
      setExpandedNodes(newExpanded);
    }
  }, [currentPath]);

  // Filter tree nodes based on treeSearchQuery
  const filteredTree = useMemo(() => {
    return filterTreeNodes(treeData, treeSearchQuery);
  }, [treeData, treeSearchQuery]);

  return (
    <aside 
      className="w-72 tahoe-block hidden md:flex flex-col justify-between flex-shrink-0 sticky top-2 z-20 overflow-hidden"
      style={{
        height: 'calc(100vh - 16px)',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div className="flex flex-col h-full w-full">
        
        {/* Header Logo */}
        <div 
          className="flex items-center gap-3.5 cursor-pointer group pb-3" 
          onClick={() => onNavigate('')}
          style={{ paddingLeft: '4px' }}
        >
          <div className="w-12 h-12 rounded-[24px] bg-gradient-to-br from-blue-500 via-green-500 to-yellow-500 p-0.5 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform flex-shrink-0">
            <div className="w-full h-full bg-[#1c1d21] rounded-[22px] flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">AppView</h1>
          </div>
        </div>

        {/* Sidebar Folder Quick Search Input */}
        <div className="relative mb-3 mt-1">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={treeSearchQuery}
            onChange={(e) => setTreeSearchQuery(e.target.value)}
            placeholder="Lọc cây thư mục..."
            className="w-full bg-[#202124] text-xs text-white placeholder-gray-500 pl-8 pr-7 py-2 rounded-[24px] border border-[#383c42] focus:outline-none focus:border-[#8ab4f8] transition-colors"
          />
          {treeSearchQuery && (
            <button
              onClick={() => setTreeSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Separator Line */}
        <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.12)', marginBottom: '12px', width: '100%' }}></div>

        {/* Category Header with Collapse All action */}
        <div className="flex items-center justify-between px-2 mb-2">
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#9aa0a6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Danh mục thư mục
          </span>
          {Object.keys(expandedNodes).length > 0 && (
            <button
              onClick={collapseAll}
              className="p-1 rounded-full text-gray-500 hover:text-gray-300 hover:bg-[#28292d] transition-colors flex items-center gap-1 text-[10px]"
              title="Thu gọn tất cả"
            >
              <ChevronsUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable Tree Area with Smooth Mask & Custom Scrollbar */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
          {/* Root Level Node */}
          <div 
            onClick={() => onNavigate('')}
            style={{ paddingLeft: '12px', paddingRight: '12px' }}
            className={`flex items-center gap-2.5 py-3.5 min-h-[46px] rounded-[24px] text-sm font-semibold cursor-pointer transition-all ${
              currentPath === '' 
                ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md' 
                : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
            }`}
          >
            <Home className={`w-4.5 h-4.5 flex-shrink-0 ${currentPath === '' ? 'text-[#1c1d21]' : 'text-blue-400'}`} />
            <span className="truncate">Thư viện gốc (Root)</span>
          </div>

          {/* Render Full Filtered Tree */}
          {Array.isArray(filteredTree) && filteredTree.length > 0 ? (
            <div className="flex flex-col gap-1.5 pt-1">
              {filteredTree.map((node) => (
                <TreeNodeItem
                  key={node.path || node.name}
                  node={node}
                  depth={1}
                  currentPath={currentPath}
                  onNavigate={onNavigate}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                  searchQuery={treeSearchQuery}
                />
              ))}
            </div>
          ) : treeSearchQuery ? (
            <div className="text-xs text-gray-500 text-center py-6">
              Không tìm thấy thư mục "{treeSearchQuery}"
            </div>
          ) : (
            /* Fallback */
            folders && folders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
                {folders.map((subfolder) => {
                  const isSelected = subfolder.path === currentPath;

                  return (
                    <div 
                      key={subfolder.path}
                      onClick={() => onNavigate(subfolder.path)}
                      className={`flex items-center gap-2.5 pr-3 py-3.5 min-h-[46px] rounded-[24px] text-sm font-medium cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md' 
                          : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
                      }`}
                      style={{ paddingLeft: '12px' }}
                    >
                      <Folder className={`w-4.5 h-4.5 flex-shrink-0 ${isSelected ? 'text-[#1c1d21] fill-[#1c1d21]/20' : 'text-yellow-400 fill-yellow-400/20'}`} />
                      <span className="truncate">{subfolder.name}</span>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Settings Button Horizontal Bar at Bottom of Left Nav Bar */}
        <div className="pt-3 border-t border-white/10 mt-2 select-none">
          <div
            onClick={onOpenConfig}
            className="bg-[#202124] hover:bg-[#28292d] border border-[#383c42] hover:border-blue-500/50 rounded-[20px] p-3 cursor-pointer transition-all flex items-center justify-between group shadow-lg"
            title="Cài đặt máy chủ"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 group-hover:bg-blue-600/30 group-hover:border-blue-400/60 transition-colors flex-shrink-0">
                <Settings className="absolute inset-0 m-auto block w-4 h-4 text-blue-400 origin-center transform-gpu transition-transform duration-500 group-hover:rotate-[360deg]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white group-hover:text-blue-300 truncate">
                  Cài đặt
                </h4>
                <p className="text-[10px] text-gray-400 truncate">
                  Máy chủ
                </p>
              </div>
            </div>
            
            {/* Gear Icon at the end (bánh răng) */}
            <div className="relative w-7 h-7 rounded-full bg-black/40 border border-white/10 text-gray-400 group-hover:text-white group-hover:border-blue-500/40 flex-shrink-0 transition-colors">
              <Settings className="absolute inset-0 m-auto block w-3.5 h-3.5 origin-center transform-gpu transition-transform duration-500 group-hover:rotate-[360deg]" />
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
};
