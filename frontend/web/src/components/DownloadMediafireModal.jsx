import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
  Download, 
  X, 
  Key, 
  Folder, 
  FolderOpen,
  ChevronRight, 
  ChevronDown, 
  Home,
  AlertCircle, 
  Loader2,
  FolderInput,
  FolderPlus,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';
import { startArchiveDownload } from '../api/downloadApi';
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

export const DownloadMediafireModal = ({ 
  isOpen, 
  onClose, 
  currentPath = '', 
  treeData = [],
  onSuccess 
}) => {
  const [url, setUrl] = useState('');
  const [destination, setDestination] = useState(currentPath);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});

  // Quick Create Subfolder state
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Auto-preselect current path and expand ancestors when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialDest = currentPath || '';
      setDestination(initialDest);
      setErrorMsg(null);
      setIsSubmitting(false);
      setShowCreateFolder(false);
      setNewFolderName('');

      const newExpanded = {};
      if (initialDest) {
        const parts = initialDest.split('/');
        let accPath = '';
        parts.forEach((p) => {
          accPath = accPath ? `${accPath}/${p}` : p;
          newExpanded[accPath] = true;
        });
      }
      setExpandedNodes(newExpanded);
    }
  }, [isOpen, currentPath]);

  const handleToggleExpand = useCallback((nodePath, forceState) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodePath]: typeof forceState === 'boolean' ? forceState : !prev[nodePath]
    }));
  }, []);

  const handleSelectFolder = useCallback((folderPath) => {
    setDestination(folderPath);
  }, []);

  const handleCreateFolderSubmit = async (e) => {
    if (e) e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;

    setIsCreatingFolder(true);
    const res = await createNewFolder(destination, name);
    setIsCreatingFolder(false);

    if (res.success) {
      const newPath = destination ? `${destination}/${name}` : name;
      setDestination(newPath);
      setExpandedNodes((prev) => ({
        ...prev,
        [destination]: true,
        [newPath]: true,
      }));
      setNewFolderName('');
      setShowCreateFolder(false);
    } else {
      setErrorMsg(res.message || 'Không thể tạo thư mục');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setErrorMsg('Vui lòng nhập liên kết MediaFire.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await startArchiveDownload(url.trim(), destination.trim(), password.trim() || null);

    setIsSubmitting(false);

    if (res.success) {
      setUrl('');
      setPassword('');
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 animate-fade-in select-none">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1c1d21] border border-[#383c42] rounded-[28px] p-6 max-w-md w-full shadow-2xl space-y-4 animate-pop-fast"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#383c42]">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-500/15 rounded-full border border-blue-500/30 text-blue-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Tải tệp nén MediaFire</h3>
              <p className="text-[11px] text-gray-400">Tải & Tự động giải nén RAR/ZIP</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-[14px] text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* MediaFire URL */}
          <div>
            <label className="block text-gray-300 font-semibold mb-1">
              Liên kết MediaFire URL:
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.mediafire.com/file/..."
              required
              className="w-full bg-[#202124] border border-[#383c42] focus:border-blue-400 rounded-xl px-3 py-2 text-white font-mono placeholder-gray-500 outline-none"
            />
          </div>

          {/* Interactive Folder Tree Selector */}
          <div>
            <label className="block text-gray-300 font-semibold mb-1.5 flex items-center gap-1.5">
              <FolderInput className="w-4 h-4 text-amber-400" />
              Chọn thư mục lưu trữ:
            </label>

            <div className="max-h-44 overflow-y-auto custom-scrollbar bg-[#202124] border border-[#383c42] rounded-[20px] p-2 space-y-1">
              {/* Root option */}
              <div
                onClick={() => setDestination('')}
                className={`flex items-center gap-2 py-2 px-3 rounded-[18px] cursor-pointer text-xs font-medium transition-all ${
                  destination === ''
                    ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md'
                    : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
                }`}
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
                    onSelectFolder={handleSelectFolder}
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
                  onClick={() => setShowCreateFolder(!showCreateFolder)}
                  title="Tạo thư mục mới trong vị trí đang chọn"
                  className="p-1 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-all flex-shrink-0"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inline Create Subfolder Input */}
            {showCreateFolder && (
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

          {/* Password Input with type="password" & Toggle */}
          <div>
            <label className="block text-gray-300 font-semibold mb-1 flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-yellow-400" />
              Mật khẩu giải nén (nếu có):
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập password nếu tệp nén bị khóa..."
                className="w-full bg-[#202124] border border-[#383c42] focus:border-yellow-400 rounded-xl px-3 py-2 pr-10 text-white font-mono placeholder-gray-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#383c42]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 font-semibold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Bắt đầu tải</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
