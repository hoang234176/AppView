import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { deleteFolder, deleteFile } from '../api/folderApi';

export const DeleteModal = ({ isOpen, onClose, targetItem, isFolder = false, onSuccess }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen || !targetItem) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg(null);

    const itemPath = targetItem.path || '';
    const res = isFolder ? await deleteFolder(itemPath) : await deleteFile(itemPath);

    setIsDeleting(false);

    if (res.success) {
      onClose();
      if (onSuccess) onSuccess(res.message);
    } else {
      setErrorMsg(res.message || 'Không thể xóa phần tử này.');
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 animate-fade-in select-none">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="[contain:layout_paint] bg-[#1c1d21] border border-red-500/30 rounded-[28px] p-6 max-w-md w-full shadow-2xl space-y-5 animate-pop-fast"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/15 rounded-full border border-red-500/30 text-red-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-400">
                Xác nhận xóa {isFolder ? 'thư mục' : 'tệp'}
              </h3>
              <p className="text-xs text-gray-400 truncate max-w-[240px]">
                {targetItem.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-[14px] text-xs text-red-400 font-medium">
            {errorMsg}
          </div>
        )}

        <div className="text-sm text-gray-300 space-y-2">
          <p>
            Bạn có chắc chắn muốn xóa {isFolder ? 'thư mục' : 'tệp'}{' '}
            <span className="font-bold text-yellow-400 font-mono">"{targetItem.name}"</span> không?
          </p>
          {isFolder && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-[14px] text-xs text-red-300">
              ⚠️ Thao tác này sẽ xóa toàn bộ các thư mục con và tệp bên trong. Không thể hoàn tác!
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#383c42]">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 rounded-[14px] transition-colors"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-[14px] shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận xóa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
