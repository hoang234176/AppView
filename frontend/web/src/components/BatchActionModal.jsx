import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  X,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Film,
  Copy,
  FolderInput,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Search,
  Loader2,
  HardDrive
} from 'lucide-react';
import { fetchFolderTree } from '../api/folderApi';
import { RollingNumber } from './common/RollingNumber';

const BatchTreeNodeItem = memo(({
  node,
  depth = 0,
  selectedFolder,
  expandedNodes,
  onSelectFolder,
  onToggleExpand,
  selectedFoldersSet,
  searchQuery = '',
}) => {
  if (!node) return null;

  // Prevent moving into any of the currently selected folders or their subfolders
  if (selectedFoldersSet && selectedFoldersSet.size > 0) {
    for (const p of selectedFoldersSet) {
      if (node.path === p || node.path.startsWith(p + '/')) {
        return null;
      }
    }
  }

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = searchQuery.trim() !== '' ? true : !!expandedNodes[node.path];
  const isSelected = selectedFolder === node.path;
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
            <BatchTreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFolder={selectedFolder}
              expandedNodes={expandedNodes}
              onSelectFolder={onSelectFolder}
              onToggleExpand={onToggleExpand}
              selectedFoldersSet={selectedFoldersSet}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
});

BatchTreeNodeItem.displayName = 'BatchTreeNodeItem';

export const BatchActionModal = ({
  isOpen,
  action, // 'copy' | 'move' | 'delete'
  onClose,
  items = [], // Array of { type: 'folder' | 'picture' | 'video', item }
  treeData = [],
  currentPath = '',
  drives = [],
  activeDrive = 'HDD',
  onConfirm,
  onSuccess,
}) => {
  const [selectedFolder, setSelectedFolder] = useState(currentPath || '');
  const [targetDrive, setTargetDrive] = useState(activeDrive || 'HDD');
  const [modalTreeData, setModalTreeData] = useState(treeData || []);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedFolder(currentPath || '');
      setTargetDrive(activeDrive || 'HDD');
      setSearchQuery('');
      setIsSubmitting(false);

      const newExpanded = {};
      if (currentPath) {
        const parts = currentPath.split('/');
        let accPath = '';
        parts.forEach((p) => {
          accPath = accPath ? `${accPath}/${p}` : p;
          newExpanded[accPath] = true;
        });
      }
      setExpandedNodes(newExpanded);
    }
  }, [isOpen, currentPath, activeDrive]);

  // Load tree data for the selected target drive
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    // When targetDrive matches activeDrive and treeData prop is provided, use it directly
    if (targetDrive === activeDrive && Array.isArray(treeData) && treeData.length > 0) {
      setModalTreeData(treeData);
      setIsLoadingTree(false);
      return;
    }

    const loadDriveTree = async () => {
      setIsLoadingTree(true);
      try {
        const res = await fetchFolderTree(targetDrive);
        if (!isCancelled && res && res.success) {
          setModalTreeData(res.data || []);
        } else if (!isCancelled) {
          setModalTreeData([]);
        }
      } catch (err) {
        console.error('Lỗi khi tải cây thư mục cho ổ đĩa:', targetDrive, err);
        if (!isCancelled) {
          setModalTreeData([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingTree(false);
        }
      }
    };

    loadDriveTree();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, targetDrive, activeDrive, treeData]);

  const filteredTree = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return modalTreeData;
    const q = searchQuery.toLowerCase().trim();
    const filter = (nodes) => {
      return nodes.reduce((acc, node) => {
        const nameMatch = node.name?.toLowerCase().includes(q);
        const pathMatch = node.path?.toLowerCase().includes(q);
        const filteredChildren = Array.isArray(node.children) ? filter(node.children) : [];
        if (nameMatch || pathMatch || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    return filter(modalTreeData);
  }, [modalTreeData, searchQuery]);

  const selectedFoldersSet = useMemo(() => {
    // Only exclude selected folders when moving/copying within the same drive
    if (targetDrive !== activeDrive) return new Set();
    return new Set(items.filter((i) => i.type === 'folder').map((i) => i.item.path));
  }, [items, targetDrive, activeDrive]);

  if (!isOpen || !action || items.length === 0) return null;

  const folderCount = items.filter((i) => i.type === 'folder').length;
  const pictureCount = items.filter((i) => i.type === 'picture').length;
  const videoCount = items.filter((i) => i.type === 'video').length;
  const totalCount = items.length;

  const handleToggleExpand = (path, forceState) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [path]: forceState !== undefined ? forceState : !prev[path],
    }));
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      if (onConfirm) {
        await onConfirm({
          action,
          selectedFolder,
          destDrive: targetDrive || activeDrive,
          items: items.map((entry) => ({
            type: entry.type,
            path: entry.item.path,
          })),
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDelete = action === 'delete';
  const isCopy = action === 'copy';
  const isMove = action === 'move';

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 animate-fade-in select-none">
      <div
        onClick={(e) => e.stopPropagation()}
        className={`[contain:layout_paint] bg-[#1c1d21] border ${
          isDelete ? 'border-red-500/40 max-w-lg' : 'border-[#383c42] max-w-xl'
        } rounded-[28px] p-6 w-full shadow-2xl space-y-4 animate-pop-fast`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#383c42]/50">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              isDelete
                ? 'bg-red-500/15 border-red-500/30 text-red-400'
                : isCopy
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}>
              {isDelete ? <Trash2 className="w-5 h-5" /> : isCopy ? <Copy className="w-5 h-5" /> : <FolderInput className="w-5 h-5" />}
            </div>
            <div>
              <h3 className={`text-base font-bold ${isDelete ? 'text-red-400' : 'text-white'}`}>
                {isDelete ? 'Xác nhận xóa các mục đã chọn' : isCopy ? 'Sao chép các mục đã chọn' : 'Di chuyển các mục đã chọn'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Tổng cộng <strong className="text-white font-semibold"><RollingNumber value={totalCount} /></strong> mục được chọn
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Items Breakdown Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {folderCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 font-medium">
              <Folder className="w-3.5 h-3.5" />
              <RollingNumber value={folderCount} /> thư mục
            </span>
          )}
          {pictureCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-medium">
              <ImageIcon className="w-3.5 h-3.5" />
              <RollingNumber value={pictureCount} /> hình ảnh
            </span>
          )}
          {videoCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 font-medium">
              <Film className="w-3.5 h-3.5" />
              <RollingNumber value={videoCount} /> video
            </span>
          )}
        </div>

        {/* Delete Confirmation Warning */}
        {isDelete ? (
          <div className="space-y-4 pt-1">
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-red-300 text-xs leading-relaxed">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Cảnh báo: Hành động không thể hoàn tác</p>
                <p className="text-red-400/80 mt-1">
                  Tất cả {totalCount} mục đã chọn (bao gồm các thư mục con và tệp tin bên trong) sẽ bị xóa vĩnh viễn.
                </p>
              </div>
            </div>

            {/* Scrollable list of items being deleted */}
            <div className="max-h-48 overflow-y-auto custom-scrollbar p-2 bg-[#121316] rounded-2xl border border-[#383c42]/60 space-y-1">
              {items.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/5">
                  {entry.type === 'folder' ? (
                    <Folder className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                  ) : entry.type === 'video' ? (
                    <Film className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  )}
                  <span className="truncate flex-1 font-mono text-[11px]">{entry.item.name || entry.item.path}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Move / Copy Destination Selector */
          <div className="space-y-3 pt-1">
            {drives && drives.length > 1 && (
              <div className="flex items-center justify-between text-xs pb-0.5">
                <span className="text-gray-400">Ổ đĩa đích:</span>
                <div className="flex items-center gap-1 bg-[#121316] p-1 rounded-xl border border-[#383c42]">
                  {drives.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        if (targetDrive !== d.id) {
                          setTargetDrive(d.id);
                          setSelectedFolder('');
                          setExpandedNodes({});
                        }
                      }}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        targetDrive === d.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <HardDrive className="w-3 h-3" />
                      <span>{d.name || d.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Chọn thư mục đích:</span>
              <span className="text-gray-300 font-mono text-[11px] truncate max-w-[240px]">
                {targetDrive ? `[${targetDrive}] ` : ''}{selectedFolder ? `/${selectedFolder}` : '/ (Thư mục gốc)'}
              </span>
            </div>

            {/* Search folder in tree */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm thư mục đích..."
                className="w-full bg-[#18191c] border border-[#383c42] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60"
              />
            </div>

            {/* Folder Tree Picker */}
            <div className="max-h-56 overflow-y-auto custom-scrollbar p-2 bg-[#121316] rounded-2xl border border-[#383c42]/60 space-y-1">
              {/* Root Folder Option */}
              <div
                onClick={() => setSelectedFolder('')}
                className={`flex items-center gap-2 py-2 px-3 rounded-[16px] cursor-pointer text-xs font-medium transition-all ${
                  selectedFolder === ''
                    ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md'
                    : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
                }`}
              >
                <HardDrive className={`w-4 h-4 ${selectedFolder === '' ? 'text-[#1c1d21]' : 'text-blue-400'}`} />
                <span>/ (Thư mục gốc)</span>
              </div>

              {/* Subfolders */}
              {isLoadingTree ? (
                <div className="flex items-center justify-center py-8 gap-2 text-xs text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Đang tải danh sách thư mục ổ đĩa {targetDrive}...</span>
                </div>
              ) : filteredTree.length > 0 ? (
                filteredTree.map((node) => (
                  <BatchTreeNodeItem
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedFolder={selectedFolder}
                    expandedNodes={expandedNodes}
                    onSelectFolder={setSelectedFolder}
                    onToggleExpand={handleToggleExpand}
                    selectedFoldersSet={selectedFoldersSet}
                    searchQuery={searchQuery}
                  />
                ))
              ) : (
                <div className="py-4 text-center text-xs text-gray-500">
                  {searchQuery ? 'Không tìm thấy thư mục phù hợp' : 'Không có thư mục nào trên ổ đĩa này'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#383c42]/50">
          <span className="text-[11px] text-gray-400">
            {!isDelete && (targetDrive !== activeDrive ? `Chuyển liên ổ đĩa (${activeDrive} → ${targetDrive})` : `Cùng ổ đĩa (${activeDrive})`)}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-[#28292d] hover:bg-[#383c42] rounded-xl transition-colors"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 ${
                isDelete
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : isCopy
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isDelete ? (
                <Trash2 className="w-4 h-4" />
              ) : isCopy ? (
                <Copy className="w-4 h-4" />
              ) : (
                <FolderInput className="w-4 h-4" />
              )}
              <span>
                {isDelete
                  ? <>Xác nhận xóa (<RollingNumber value={totalCount} />)</>
                  : isCopy
                  ? <>Sao chép vào đây (<RollingNumber value={totalCount} />)</>
                  : <>Di chuyển vào đây (<RollingNumber value={totalCount} />)</>}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
