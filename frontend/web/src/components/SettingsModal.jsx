import { useState, useEffect } from 'react';
import { 
  X, 
  Server,
  Check,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Wifi
} from 'lucide-react';
import { saveServerConfig, getServerHost, validateCoordinatorHost } from '../api/axiosConfig';
import { fetchCoordinatorStorageInfo } from '../api/downloadApi';

const formatStorage = (value) => {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
};

export const SettingsModal = ({ isOpen, onClose, onRefreshFolder, onServerConfigSaved, onServerConfigFailed }) => {
  const [serverHost, setServerHost] = useState('');
  const [serverSavedMsg, setServerSavedMsg] = useState('');
  const [serverErrorMsg, setServerErrorMsg] = useState('');
  const [connectionState, setConnectionState] = useState('idle'); // 'idle' | 'checking' | 'connected' | 'failed'

  // Accordion Sections
  const [openSection1, setOpenSection1] = useState(false);
  const [openSection2, setOpenSection2] = useState(false);

  // Client Cache State
  const [cacheSizeText, setCacheSizeText] = useState('Đang tính...');
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheMsg, setCacheMsg] = useState('');
  const [storageInfo, setStorageInfo] = useState(null);

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

  const loadStorageDetails = () => {
    fetchCoordinatorStorageInfo().then((result) => {
      if (result.success) setStorageInfo(result.data);
      else setStorageInfo(null);
    });
  };

  useEffect(() => {
    if (isOpen) {
      const currentHost = getServerHost();
      setServerHost(currentHost);
      setServerErrorMsg('');
      setServerSavedMsg('');
      calculateBrowserCache();

      setConnectionState('checking');
      validateCoordinatorHost(currentHost).then((res) => {
        if (res.success) {
          setConnectionState('connected');
          loadStorageDetails();
        } else {
          setConnectionState('failed');
          setStorageInfo(null);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveServerConfig = async (e) => {
    e.preventDefault();
    const host = serverHost.trim();
    setServerErrorMsg('');
    setServerSavedMsg('');

    if (!host) {
      setServerErrorMsg('Vui lòng nhập Server Host (hostname hoặc địa chỉ IP).');
      return;
    }

    setConnectionState('checking');
    const valResult = await validateCoordinatorHost(host);

    if (!valResult.success) {
      setConnectionState('failed');
      setServerErrorMsg(valResult.message);
      saveServerConfig(host);
      onServerConfigFailed?.(valResult.message);
      return;
    }

    saveServerConfig(host);
    setConnectionState('connected');
    setServerSavedMsg('✅ Đã kết nối và lưu cấu hình!');
    loadStorageDetails();

    onServerConfigSaved?.(host);
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
    } catch {
      setCacheMsg('Đã dọn dẹp bộ nhớ tạm trình duyệt');
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
	<div className="fixed inset-0 z-[100000] flex items-center justify-center overflow-hidden bg-black/80 px-4 py-[10vh] animate-fade-in select-none overscroll-contain" onClick={onClose} onWheelCapture={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()} role="presentation">
      <div 
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-[#383c42] bg-[#1c1d21] p-6 shadow-2xl animate-pop-fast"
        onClick={(e) => e.stopPropagation()}
		role="dialog"
		aria-modal="true"
		aria-label="Cài đặt hệ thống"
      >
		{/* Header stays fixed while Settings content scrolls internally. */}
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

		<div className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-4 pr-1 custom-scrollbar">
		{/* Storage Info */}
		<div className="border border-[#383c42] rounded-[20px] bg-[#202124]/60 p-4 text-xs">
		  <div className="flex items-center gap-2 font-bold text-gray-200"><HardDrive className="w-4 h-4 text-blue-400" />Storage</div>
		  {storageInfo ? <div className="mt-3"><div className="flex justify-between font-bold text-white"><span>{storageInfo.displayName}</span><span>{Math.round(storageInfo.usedPercent || 0)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#18191c]"><div className="h-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, storageInfo.usedPercent || 0))}%` }} /></div><p className="mt-2 text-gray-400">{formatStorage(storageInfo.usedBytes)} / {formatStorage(storageInfo.totalBytes)} đã dùng • {formatStorage(storageInfo.availableBytes)} còn trống</p></div> : <p className="mt-2 text-gray-500">Đang chờ Storage local kết nối…</p>}
		</div>

        {/* Section 1: Server Host */}
        <div className="border border-[#383c42] rounded-[20px] bg-[#202124]/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenSection1(!openSection1)}
            className="w-full flex items-center justify-between p-4 text-xs font-bold text-gray-200 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-blue-400" />
              <span>1. Kết nối máy chủ</span>
              {connectionState === 'connected' ? (
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              ) : connectionState === 'checking' ? (
                <span className="flex items-center gap-1 text-amber-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Đang kiểm tra...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Chưa kết nối
                </span>
              )}
            </div>
            {openSection1 ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {openSection1 && (
            <form onSubmit={handleSaveServerConfig} className="p-4 pt-0 space-y-3 text-xs font-semibold border-t border-[#383c42]/40">
              <div className="mt-3">
                <label htmlFor="serverHostInput" className="block text-gray-300 mb-1 font-bold">
                  Server Host
                </label>
                <input
                  type="text"
                  id="serverHostInput"
                  value={serverHost}
                  onChange={(e) => setServerHost(e.target.value)}
                  disabled={connectionState === 'checking'}
                  placeholder="HOANGs-MacBook-Pro.local or 192.168.1.x"
                  className="w-full bg-[#18191c] border border-[#383c42] focus:border-blue-400 rounded-xl px-3 py-2 text-white font-mono placeholder-gray-500 outline-none disabled:opacity-50"
                />
                <p className="mt-1.5 text-[11px] text-gray-500">
                  Nhập hostname .local hoặc địa chỉ IP. Port và đường dẫn được cấu hình tự động.
                </p>
              </div>

              {serverErrorMsg && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium">
                  ⚠️ {serverErrorMsg}
                </div>
              )}

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
                  disabled={connectionState === 'checking'}
                  className="flex items-center gap-1.5 px-4 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 rounded-xl shadow-lg shadow-blue-600/30 transition-all"
                >
                  {connectionState === 'checking' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang kiểm tra...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Lưu & Kết nối</span>
                    </>
                  )}
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
    </div>
  );
};
