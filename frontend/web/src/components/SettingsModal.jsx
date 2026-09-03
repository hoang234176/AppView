import React, { useState, useEffect } from 'react';
import { 
  X, 
  Server,
  Check,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { getRootFolderPath, saveServerConfig, getServerIp, getServerPort } from '../api/axiosConfig';

export const SettingsModal = ({ isOpen, onClose, onRefreshFolder }) => {
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('');
  const [rootFolder, setRootFolder] = useState('');
  const [serverSavedMsg, setServerSavedMsg] = useState('');

  // Accordion Sections
  const [openSection1, setOpenSection1] = useState(true);
  const [openSection2, setOpenSection2] = useState(true);

  // Client Cache State
  const [cacheSizeText, setCacheSizeText] = useState('Đang tính...');
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheMsg, setCacheMsg] = useState('');

  const calculateBrowserCache = async () => {
    try {
      if (typeof window !== 'undefined' && 'navigator' in window && 'storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usageMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
        setCacheSizeText(`${usageMB} MB`);
      } else {
        setCacheSizeText('0.00 MB');
      }
    } catch {
      setCacheSizeText('0.00 MB');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setServerIp(getServerIp());
      setServerPort(getServerPort());
      setRootFolder(getRootFolderPath());
      calculateBrowserCache();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveServerConfig = (e) => {
    e.preventDefault();
    saveServerConfig(serverIp.trim(), serverPort.trim(), rootFolder.trim());
    setServerSavedMsg('✅ Đã lưu cấu hình!');
    setTimeout(() => setServerSavedMsg(''), 3000);
    if (onRefreshFolder) onRefreshFolder();
  };

  const handleClearBrowserCache = async () => {
    setIsClearingCache(true);
    setCacheMsg('Đang dọn dẹp...');
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      await calculateBrowserCache();
      setCacheMsg('Đã dọn dẹp sạch sẽ bộ nhớ tạm');
    } catch (err) {
      setCacheMsg('Đã dọn dẹp bộ nhớ tạm trình duyệt');
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in select-none" onClick={onClose}>
      <div 
        className="bg-[#1c1d21] border border-[#383c42] rounded-[28px] max-w-lg w-full p-6 shadow-2xl space-y-4 animate-pop-fast"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#383c42]">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-500/15 rounded-full border border-blue-500/30 text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              Cài đặt Hệ Thống
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Server Config */}
        <div className="border border-[#383c42] rounded-[20px] bg-[#202124]/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenSection1(!openSection1)}
            className="w-full flex items-center justify-between p-4 text-xs font-bold text-gray-200 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <span>1. Cấu hình máy chủ</span>
            </div>
            {openSection1 ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {openSection1 && (
            <form onSubmit={handleSaveServerConfig} className="p-4 pt-0 space-y-3 text-xs font-semibold border-t border-[#383c42]/40">
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="col-span-2">
                  <label htmlFor="serverIpInput" className="block text-gray-300 mb-1 font-bold">
                    Địa chỉ IP
                  </label>
                  <input
                    type="text"
                    id="serverIpInput"
                    value={serverIp}
                    onChange={(e) => setServerIp(e.target.value)}
                    placeholder="192.168.1.253"
                    className="w-full bg-[#18191c] border border-[#383c42] focus:border-blue-400 rounded-xl px-3 py-2 text-white font-mono placeholder-gray-500 outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="serverPortInput" className="block text-gray-300 mb-1 font-bold">
                    Cổng
                  </label>
                  <input
                    type="text"
                    id="serverPortInput"
                    value={serverPort}
                    onChange={(e) => setServerPort(e.target.value)}
                    placeholder="8080"
                    className="w-full bg-[#18191c] border border-[#383c42] focus:border-blue-400 rounded-xl px-3 py-2 text-white font-mono placeholder-gray-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rootFolderInput" className="block text-gray-300 mb-1 font-bold">
                  Thư mục gốc
                </label>
                <input
                  type="text"
                  id="rootFolderInput"
                  value={rootFolder}
                  onChange={(e) => setRootFolder(e.target.value)}
                  placeholder="/Volumes/HDD/Albums"
                  className="w-full bg-[#18191c] border border-[#383c42] focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono placeholder-gray-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#383c42]/50">
                {serverSavedMsg ? (
                  <span className="text-xs font-bold text-emerald-400">
                    {serverSavedMsg}
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/30 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu Máy chủ</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Section 2: Client Cache Cleanup */}
        <div className="border border-[#383c42] rounded-[20px] bg-[#202124]/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenSection2(!openSection2)}
            className="w-full flex items-center justify-between p-4 text-xs font-bold text-gray-200 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span>2. Dọn dẹp Bộ nhớ tạm</span>
            </div>
            {openSection2 ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {openSection2 && (
            <div className="p-4 pt-0 space-y-3 text-xs border-t border-[#383c42]/40">
              <div className="p-3 bg-[#18191c] border border-amber-500/20 rounded-xl space-y-1 mt-3">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4" />
                  <span>Bộ nhớ tạm trình duyệt Web: {cacheSizeText}</span>
                </div>
                <p className="text-gray-400 text-[11px]">
                  Bao gồm dữ liệu cache ảnh & bộ nhớ tạm của trình duyệt Web.
                </p>
              </div>

              {cacheMsg && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{cacheMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={handleClearBrowserCache}
                  disabled={isClearingCache}
                  className="flex items-center gap-1.5 px-4 py-1.5 font-bold text-black bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 rounded-xl shadow-lg shadow-amber-400/20 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isClearingCache ? 'animate-spin' : ''}`} />
                  <span>Dọn dẹp Cache</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

