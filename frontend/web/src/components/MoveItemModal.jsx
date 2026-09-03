import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  X, 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Check, 
  FolderInput, 
  Home,
  Search
} from 'lucide-react';
import { moveItem } from '../api/folderApi';

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

const TreeNodeItem = memo(({ 
  node, 
  depth = 1, 
  selectedFolder, 
  expandedNodes, 
  onSelectFolder, 
  onToggleExpand, 
  srcItem,
  searchQuery = ''
}) => {
  const isSelected = selectedFolder === node.path;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = searchQuery.trim() !== '' ? true : !!expandedNodes[node.path];

  // Prevent moving folder into itself or its own subfolder
  if (srcItem && srcItem.type === 'folder' && (node.path === srcItem.path || node.path.startsWith(srcItem.path + '/'))) {
    return null;
  }

  const paddingLeftVal = depth * 14 + 10;

  return (
    <div className="select-none space-y-1">
      <div
        onClick={() => {
          onSelectFolder(node.path);
          if (hasChildren && !isExpanded) {
            onToggleExpand(node.path, true);
          }
        }}
        style={{ paddingLeft: `${paddingLeftVal}px` }}
        className={`group flex items-center justify-between gap-2 py-2.5 px-3 rounded-[20px] cursor-pointer text-xs font-medium transition-all ${
          isSelected
            ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md'
            : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(node.path, !isExpanded);
              }}
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                isSelected ? 'text-[#1c1d21] hover:bg-black/20' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-5 h-5 flex-shrink-0" />
          )}

          {isExpanded ? (
            <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-[#1c1d21]' : 'text-yellow-400'}`} />
          ) : (
            <Folder className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-[#1c1d21] fill-[#1c1d21]/20' : 'text-yellow-400 fill-yellow-400/20'}`} />
          )}

          <span className="truncate">{node.name}</span>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFolder={selectedFolder}
              expandedNodes={expandedNodes}
              onSelectFolder={onSelectFolder}
              onToggleExpand={onToggleExpand}
              srcItem={srcItem}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export const MoveItemModal = ({ 
  isOpen, 
  onClose, 
  item, 
  treeData = [],
  currentPath = '',
  onMoveSuccess 
}) => {
  const [selectedFolder, setSelectedFolder] = useState(currentPath || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedNodes, setExpandedNodes] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Pre-select current path and expand ancestor nodes when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialPath = currentPath || '';
      setSelectedFolder(initialPath);
      setIsSubmitting(false);
      setErrorMsg('');
      setSearchQuery('');

      // Auto-expand parents leading up to currentPath
      const newExpanded = {};
      if (initialPath) {
        const parts = initialPath.split('/');
        let accPath = '';
        parts.forEach((p) => {
          accPath = accPath ? `${accPath}/${p}` : p;
          newExpanded[accPath] = true;
        });
      }
      setExpandedNodes(newExpanded);
    }
  }, [isOpen, currentPath, item]);

  const handleToggleExpand = useCallback((nodePath, forceState) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodePath]: typeof forceState === 'boolean' ? forceState : !prev[nodePath]
    }));
  }, []);

  const handleSelectFolder = useCallback((folderPath) => {
    setSelectedFolder(folderPath);
  }, []);

  const filteredTree = useMemo(() => {
    return filterTreeNodes(treeData, searchQuery);
  }, [treeData, searchQuery]);

  if (!isOpen || !item) return null;

  const handleMoveSubmit = async () => {
    if (item.type === 'folder' && (selectedFolder === item.path || selectedFolder.startsWith(item.path + '/'))) {
      setErrorMsg('Không thể di chuyển thư mục vào chính nó hoặc thư mục con của nó.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const res = await moveItem(item.path, selectedFolder);
    setIsSubmitting(false);

    if (res.success) {
      onMoveSuccess();
      onClose();
    } else {
      setErrorMsg(res.message || 'Lỗi khi di chuyển đối tượng.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fade-in">
      <div className="bg-[#1c1d21] border border-[#383c42] rounded-[28px] p-6 max-w-md w-full shadow-2xl space-y-4 animate-pop-fast">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-[#383c42]">
          <h3 className="text-base font-bold text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FolderInput className="w-4 h-4" />
            </div>
            Chọn thư mục lưu trữ
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-2xl font-medium">
            {errorMsg}
          </div>
        )}

        <div className="space-y-3">
          <span className="text-xs text-gray-400 block font-medium">
            Đối tượng cần di chuyển: <span className="text-white font-bold">{item.name}</span>
          </span>

          {/* Search tree input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm vị trí thư mục lưu trữ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#202124] border border-[#383c42] focus:border-[#8ab4f8] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-400 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Interactive Folder Tree Container */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar bg-[#202124] border border-[#383c42] rounded-[24px] p-2 space-y-1">
            {/* Root folder option */}
            <div
              onClick={() => setSelectedFolder('')}
              className={`flex items-center gap-2 py-2.5 px-3 rounded-[20px] cursor-pointer text-xs font-medium transition-all ${
                selectedFolder === ''
                  ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md'
                  : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
              }`}
            >
              <Home className={`w-4 h-4 ml-5 flex-shrink-0 ${selectedFolder === '' ? 'text-[#1c1d21]' : 'text-blue-400'}`} />
              <span>Thư viện gốc (Root)</span>
            </div>

            {filteredTree && filteredTree.length > 0 ? (
              filteredTree.map((node) => (
                <TreeNodeItem
                  key={node.path}
                  node={node}
                  depth={1}
                  selectedFolder={selectedFolder}
                  expandedNodes={expandedNodes}
                  onSelectFolder={handleSelectFolder}
                  onToggleExpand={handleToggleExpand}
                  srcItem={item}
                  searchQuery={searchQuery}
                />
              ))
            ) : (
              <div className="py-4 text-center text-xs text-gray-500">
                Không tìm thấy thư mục phù hợp
              </div>
            )}
          </div>
        </div>

        {/* Selected Target Folder Location Badge */}
        <div className="bg-[#24252a] border border-[#383c42] rounded-2xl px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-[11px] text-gray-400 font-medium">Vị trí đã chọn:</span>
          <span className="text-xs font-mono font-bold text-amber-400 truncate max-w-[260px]">
            {selectedFolder === '' ? 'Thư viện gốc (Root)' : `/${selectedFolder}`}
          </span>
        </div>

        {/* Bottom Button Bar */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-gray-300 hover:bg-white/5 transition-colors text-xs font-semibold"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleMoveSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg flex items-center gap-2 text-xs"
          >
            <Check className="w-4 h-4" />
            {isSubmitting ? 'Đang di chuyển...' : 'Xác nhận di chuyển'}
          </button>
        </div>

      </div>
    </div>
  );
};
