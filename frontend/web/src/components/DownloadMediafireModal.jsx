import React, { useState, useEffect } from 'react';
import {
  Download,
  X,
  Key,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Clipboard,
  ClipboardCheck
} from 'lucide-react';
import { startArchiveDownload } from '../api/downloadApi';
import { canonicalDownloadDestination } from '../utils/downloadDestination';
import { FolderPicker } from './FolderPicker';

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
  const [pasted, setPasted] = useState(false);

  // Auto-preselect current path when modal opens
  useEffect(() => {
    if (isOpen) {
      setDestination(currentPath || '');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, currentPath]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setErrorMsg(null);
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setErrorMsg('Vui lòng nhập liên kết tải xuống.');
      return;
    }
    try {
      const parsed = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol) || !(parsed.hostname === 'mediafire.com' || parsed.hostname.endsWith('.mediafire.com'))) {
        setErrorMsg('Vui lòng nhập liên kết MediaFire hợp lệ.');
        return;
      }
    } catch {
      setErrorMsg('Vui lòng nhập liên kết MediaFire hợp lệ.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await startArchiveDownload(url.trim(), canonicalDownloadDestination(destination), password.trim() || null);

    setIsSubmitting(false);
    if (res.success) {
      onSuccess?.(res);
      onClose();
    } else {
      setErrorMsg(res.message || 'Lỗi khi khởi tạo task tải xuống');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in select-none">
      <div className="bg-[#1c1d21] border border-[#383c42] rounded-[28px] p-6 max-w-md w-full shadow-2xl space-y-4 animate-pop-fast">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#383c42]">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-500/15 rounded-full border border-blue-500/30 text-blue-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Tải file nén</h3>
              <p className="text-[11px] text-gray-400">MediaFire</p>
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
          {/* Download URL */}
          <div>
            <label className="block text-gray-300 font-semibold mb-1">
              Liên kết MediaFire:
            </label>
            <div className="relative flex items-center">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.mediafire.com/..."
                required
                disabled={isSubmitting}
                className="w-full bg-[#202124] border border-[#383c42] focus:border-blue-400 rounded-xl pl-3 pr-24 py-2 text-white font-mono placeholder-gray-500 outline-none"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                {url ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUrl('');
                      setErrorMsg(null);
                    }}
                    disabled={isSubmitting}
                    className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Xóa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors"
                  title="Dán từ Clipboard"
                >
                  {pasted ? (
                    <>
                      <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Đã dán</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Dán</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Folder Tree Selector */}
          <FolderPicker
            destination={destination}
            onChangeDestination={setDestination}
            treeData={treeData}
            onError={setErrorMsg}
            disabled={isSubmitting}
          />

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
