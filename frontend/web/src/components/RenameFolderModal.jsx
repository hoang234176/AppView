import React, { useState, useEffect, useRef } from 'react';
import { Edit3, X, Check, Loader2 } from 'lucide-react';

export const RenameFolderModal = ({ isOpen, onClose, folder, onRename }) => {
  const [newName, setNewName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && folder) {
      setNewName(folder.name || '');
      setErrorMsg('');
      setIsSubmitting(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, folder]);

  if (!isOpen || !folder) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = newName.trim();

    if (!cleanName) {
      setErrorMsg('Vui lòng nhập tên thư mục mới.');
      return;
    }

    if (cleanName === folder.name) {
      onClose();
      return;
    }

    if (/[/\:*?"<>|]/.test(cleanName) || cleanName.includes('..')) {
      setErrorMsg('Tên thư mục chứa ký tự không hợp lệ (/ \\ : * ? " < > |).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const res = await onRename(folder, cleanName);
    setIsSubmitting(false);

    if (res && res.success) {
      onClose();
    } else {
      setErrorMsg(res?.message || 'Không thể đổi tên thư mục. Vui lòng thử lại.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
      <div className="bg-[#1c1d21] border border-[#383c42] rounded-[24px] p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-[#383c42]">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Edit3 className="w-4.5 h-4.5" />
            </div>
            Đổi tên thư mục
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl font-medium animate-fade-in">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              Tên mới cho thư mục <span className="text-yellow-400 font-mono">"{folder.name}"</span>:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Nhập tên mới..."
              className="w-full bg-[#202124] border border-[#383c42] focus:border-[#8ab4f8] rounded-[20px] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-google btn-google-surface text-xs"
              disabled={isSubmitting}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn-google btn-google-primary text-xs flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang đổi tên...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Xác nhận
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
