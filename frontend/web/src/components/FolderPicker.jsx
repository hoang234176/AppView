import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Home,
  Loader2,
  FolderInput,
  FolderPlus,
  Check
} from 'lucide-react';
import { createNewFolder } from '../api/folderApi';

const TreeNodeItem = memo(({
  node,
  depth = 1,
  selectedFolder,
  expandedNodes,
  onSelectFolder,
  onToggleExpand
}) => {
  const isSelected = selectedFolder === node.path;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = !!expandedNodes[node.path];

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
        className={`group flex items-center justify-between gap-2 py-2 px-3 rounded-[18px] cursor-pointer text-xs font-medium transition-all ${
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
            />
          ))}
        </div>
      )}
    </div>
  );
});

export const FolderPicker = ({
  destination,
  onChangeDestination,
  treeData = [],
  onError,
  disabled = false,
  label = 'Chọn thư mục lưu trữ:',
}) => {
  const [expandedNodes, setExpandedNodes] = useState({});
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Initialize expanded nodes based on current destination
  useEffect(() => {
    if (destination) {
      const parts = destination.split('/');
      let accPath = '';
      const newExpanded = {};
      parts.forEach((p) => {
        accPath = accPath ? `${accPath}/${p}` : p;
        newExpanded[accPath] = true;
      });
      setExpandedNodes((prev) => ({ ...prev, ...newExpanded }));
    }
  }, [destination]);

  const handleToggleExpand = useCallback((nodePath, forceState) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodePath]: typeof forceState === 'boolean' ? forceState : !prev[nodePath]
    }));
  }, []);

  const handleCreateFolderSubmit = async (e) => {
    if (e) e.preventDefault();
    const name = newFolderName.trim();
    if (!name || disabled) return;

    setIsCreatingFolder(true);
    const res = await createNewFolder(destination, name);
    setIsCreatingFolder(false);

    if (res.success) {
      const newPath = destination ? `${destination}/${name}` : name;
      onChangeDestination(newPath);
      setExpandedNodes((prev) => ({
        ...prev,
        [destination]: true,
        [newPath]: true,
      }));
      setNewFolderName('');
      setShowCreateFolder(false);
    } else {
      if (onError) onError(res.message || 'Không thể tạo thư mục');
    }
  };

  return (
    <div>
      <label className="block text-gray-300 font-semibold mb-1.5 flex items-center gap-1.5">
        <FolderInput className="w-4 h-4 text-amber-400" />
        {label}
      </label>

      <div className="max-h-44 overflow-y-auto custom-scrollbar bg-[#202124] border border-[#383c42] rounded-[20px] p-2 space-y-1">
        {/* Root option */}
        <div
          onClick={() => { if (!disabled) onChangeDestination(''); }}
          className={`flex items-center gap-2 py-2 px-3 rounded-[18px] cursor-pointer text-xs font-medium transition-all ${
            destination === ''
              ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md'
              : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
          } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        >
          <Home className={`w-4 h-4 ml-5 flex-shrink-0 ${destination === '' ? 'text-[#1c1d21]' : 'text-blue-400'}`} />
          <span>Thư viện gốc (Root)</span>
        </div>

        {treeData && treeData.length > 0 ? (
          treeData.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={1}
              selectedFolder={destination}
              expandedNodes={expandedNodes}
              onSelectFolder={(path) => { if (!disabled) onChangeDestination(path); }}
              onToggleExpand={handleToggleExpand}
            />
          ))
        ) : (
          <div className="py-2 text-center text-[11px] text-gray-500">
            Không có thư mục con nào
          </div>
        )}
      </div>

      {/* Selected destination indicator with Create Subfolder button */}
      <div className="mt-1.5 bg-[#24252a] border border-[#383c42] rounded-xl px-3 py-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-400 flex-shrink-0">Vị trí lưu:</span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-bold text-amber-400 truncate max-w-[200px]">
            {destination === '' ? 'Thư viện gốc (Root)' : `/${destination}`}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowCreateFolder(!showCreateFolder)}
            title="Tạo thư mục mới trong vị trí đang chọn"
            className="p-1 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-all flex-shrink-0 disabled:opacity-50"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inline Create Subfolder Input */}
      {showCreateFolder && !disabled && (
        <div className="mt-2 p-2 bg-[#202124] border border-amber-500/40 rounded-xl flex items-center gap-2 animate-fade-in">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={`Tạo folder trong ${destination ? `/${destination}` : 'Root'}...`}
            className="flex-1 bg-[#16171a] border border-[#383c42] focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs text-white placeholder-gray-500 outline-none font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateFolderSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={handleCreateFolderSubmit}
            disabled={isCreatingFolder || !newFolderName.trim()}
            className="px-2.5 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
          >
            {isCreatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Tạo</span>
          </button>
        </div>
      )}
    </div>
  );
};
