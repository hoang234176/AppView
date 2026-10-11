import { useState, useEffect } from 'react';
import { 
  X, 
  Server,
  Check,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  Wifi,
  Cookie,
  AlertCircle
} from 'lucide-react';
import { saveServerConfig, getServerHost, validateCoordinatorHost } from '../api/axiosConfig';
import { fetchCoordinatorStorageInfo, verifyCookies } from '../api/downloadApi';

const formatStorage = (value) => {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
};

let hasAutoCheckedCookiesOnWeb = false;

export const SettingsModal = ({ isOpen, onClose, onRefreshFolder, onServerConfigSaved, onServerConfigFailed }) => {
  const [serverHost, setServerHost] = useState('');
  const [serverSavedMsg, setServerSavedMsg] = useState('');
  const [serverErrorMsg, setServerErrorMsg] = useState('');
  const [connectionState, setConnectionState] = useState('idle'); // 'idle' | 'checking' | 'connected' | 'failed'

  // Accordion Sections
  const [openSection1, setOpenSection1] = useState(false);
  const [openSection2, setOpenSection2] = useState(false);
  const [openSection3, setOpenSection3] = useState(false);

  // Social Cookies State (YouTube)
  const [cookieStatus, setCookieStatus] = useState("none"); // "loading" | "none" | "valid" | "expired"
  const [isYoutubeOpen, setIsYoutubeOpen] = useState(false);
  const [isVerifyingCookie, setIsVerifyingCookie] = useState(false);
  const [cookieVerifyMsg, setCookieVerifyMsg] = useState(null);

  const handleVerifyYoutubeCookie = async () => {
    setIsVerifyingCookie(true);
    setCookieVerifyMsg(null);
    const res = await verifyCookies("youtube");
    setIsVerifyingCookie(false);
    if (res.success && res.data?.valid) {
      setCookieStatus("valid");
      setCookieVerifyMsg({ type: "success", text: res.data.message || "✓ Cookie YouTube hợp lệ!" });
    } else {
      setCookieStatus("expired");
      const errMsg = res.data?.message || res.message || "Cookie không hợp lệ hoặc đã hết hạn.";
      setCookieVerifyMsg({ type: "error", text: errMsg });
    }
  };

  // Social Cookies State (TikTok)
  const [tiktokCookieStatus, setTiktokCookieStatus] = useState("none"); // "loading" | "none" | "valid" | "expired"
  const [isTiktokOpen, setIsTiktokOpen] = useState(false);
  const [isVerifyingTiktokCookie, setIsVerifyingTiktokCookie] = useState(false);
  const [tiktokCookieVerifyMsg, setTiktokCookieVerifyMsg] = useState(null);

  const handleVerifyTiktokCookie = async () => {
    setIsVerifyingTiktokCookie(true);
    setCookieVerifyMsg(null);
    const res = await verifyCookies("tiktok");
    setIsVerifyingTiktokCookie(false);
    if (res.success && res.data?.valid) {
      setTiktokCookieStatus("valid");
      setTiktokCookieVerifyMsg({ type: "success", text: res.data.message || "✓ Cookie TikTok hợp lệ!" });
    } else {
      setTiktokCookieStatus("expired");
      const errMsg = res.data?.message || res.message || "Cookie không hợp lệ hoặc đã hết hạn.";
      setTiktokCookieVerifyMsg({ type: "error", text: errMsg });
    }
  };

  // Social Cookies State (Facebook)
  const [fbCookieStatus, setFbCookieStatus] = useState("none"); // "loading" | "none" | "valid" | "expired"
  const [isFbOpen, setIsFbOpen] = useState(false);
  const [isVerifyingFbCookie, setIsVerifyingFbCookie] = useState(false);
  const [fbCookieVerifyMsg, setFbCookieVerifyMsg] = useState(null);

  const handleVerifyFbCookie = async () => {
    setIsVerifyingFbCookie(true);
    setFbCookieVerifyMsg(null);
    const res = await verifyCookies("facebook");
    setIsVerifyingFbCookie(false);
    if (res.success && res.data?.valid) {
      setFbCookieStatus("valid");
      setFbCookieVerifyMsg({ type: "success", text: res.data.message || "✓ Cookie Facebook hợp lệ!" });
    } else {
      setFbCookieStatus("expired");
      const errMsg = res.data?.message || res.message || "Cookie không hợp lệ hoặc đã hết hạn.";
      setFbCookieVerifyMsg({ type: "error", text: errMsg });
    }
  };

  // Social Cookies State (Instagram)
  const [igCookieStatus, setIgCookieStatus] = useState("none"); // "loading" | "none" | "valid" | "expired"
  const [isIgOpen, setIsIgOpen] = useState(false);
  const [isVerifyingIgCookie, setIsVerifyingIgCookie] = useState(false);
  const [igCookieVerifyMsg, setIgCookieVerifyMsg] = useState(null);

  const handleVerifyIgCookie = async () => {
    setIsVerifyingIgCookie(true);
    setIgCookieVerifyMsg(null);
    const res = await verifyCookies("instagram");
    setIsVerifyingIgCookie(false);
    if (res.success && res.data?.valid) {
      setIgCookieStatus("valid");
      setIgCookieVerifyMsg({ type: "success", text: res.data.message || "✓ Cookie Instagram hợp lệ!" });
    } else {
      setIgCookieStatus("expired");
      const errMsg = res.data?.message || res.message || "Cookie không hợp lệ hoặc đã hết hạn.";
      setIgCookieVerifyMsg({ type: "error", text: errMsg });
    }
  };

  // Social Cookies State (X / Twitter)
  const [xCookieStatus, setXCookieStatus] = useState("none"); // "loading" | "none" | "valid" | "expired"
  const [isXOpen, setIsXOpen] = useState(false);
  const [isVerifyingXCookie, setIsVerifyingXCookie] = useState(false);
  const [xCookieVerifyMsg, setXCookieVerifyMsg] = useState(null);

  const handleVerifyXCookie = async () => {
    setIsVerifyingXCookie(true);
    setXCookieVerifyMsg(null);
    const res = await verifyCookies("x");
    setIsVerifyingXCookie(false);
    if (res.success && res.data?.valid) {
      setXCookieStatus("valid");
      setXCookieVerifyMsg({ type: "success", text: res.data.message || "✓ Cookie X (Twitter) hợp lệ!" });
    } else {
      setXCookieStatus("expired");
      const errMsg = res.data?.message || res.message || "Cookie không hợp lệ hoặc đã hết hạn.";
      setXCookieVerifyMsg({ type: "error", text: errMsg });
    }
  };

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
		<div className="border border-[#383c42] rounded-[22px] bg-[#202124]/60 p-4 text-xs">
		  <div className="flex items-center justify-between font-bold text-gray-200 mb-3">
		    <span className="flex items-center gap-2 text-sm">
		      <HardDrive className="w-4 h-4 text-blue-400" />
		      Ổ đĩa lưu trữ
		    </span>
		    {storageInfo?.drives && storageInfo.drives.length > 0 && (
		      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
		        {storageInfo.drives.length} ổ đĩa
		      </span>
		    )}
		  </div>
		  {storageInfo ? (
		    <div className="space-y-3">
		      {storageInfo.drives && storageInfo.drives.length > 0 ? (
		        storageInfo.drives.map((drive) => {
		          const isConn = drive.available && drive.totalBytes > 0;
		          const p = isConn ? Math.round(drive.usedPercent || 0) : 0;
		          const iconTheme = !isConn
		            ? "bg-red-500/15 text-red-400 border-red-500/30"
		            : p >= 91
		            ? "bg-red-500/15 text-red-400 border-red-500/30"
		            : p >= 75
		            ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
		            : "bg-blue-500/15 text-blue-400 border-blue-500/30";
		          const badgeColor = !isConn
		            ? "bg-red-500/20 text-red-400 border-red-500/40"
		            : p >= 91
		            ? "bg-red-500/20 text-red-400 border-red-500/40"
		            : p >= 75
		            ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
		            : "bg-blue-500/20 text-blue-400 border-blue-500/40";
		          const barGrad = p >= 91
		            ? "from-red-500 to-rose-600"
		            : p >= 75
		            ? "from-amber-500 to-orange-500"
		            : "from-blue-500 to-indigo-500";
		          const usedColor = p >= 91 ? "text-red-400 font-bold" : p >= 75 ? "text-orange-400 font-bold" : "text-blue-400 font-bold";

		          return (
		            <div key={drive.id} className="p-3.5 rounded-2xl bg-[#18191c] border border-[#383c42]/60 shadow-sm space-y-2.5">
		              <div className="flex items-center justify-between">
		                <div className="flex items-center gap-2.5">
		                  <div className={`p-2 rounded-xl border ${iconTheme}`}>
		                    <HardDrive className="w-4 h-4" />
		                  </div>
		                  <div>
		                    <div className="font-bold text-sm text-white">
		                      {drive.displayName || drive.name || drive.id}
		                    </div>
		                  </div>
		                </div>
		                <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${badgeColor}`}>
		                  {isConn ? `${p}%` : "Ngắt kết nối"}
		                </div>
		              </div>
		              {isConn ? (
		                <>
		                  <div className="h-2 overflow-hidden rounded-full bg-[#101114]">
		                    <div className={`h-full bg-gradient-to-r ${barGrad} rounded-full`} style={{ width: `${Math.max(0, Math.min(100, p))}%` }} />
		                  </div>
		                  <div className="flex items-center justify-between text-[11.5px]">
		                    <span className="text-gray-400">Đã dùng: <strong className={usedColor}>{formatStorage(drive.usedBytes)}</strong></span>
		                    <span className="text-gray-400">Còn trống: <strong className="text-emerald-400 font-bold">{formatStorage(drive.availableBytes)}</strong></span>
		                  </div>
		                </>
		              ) : (
		                <p className="text-[11px] text-red-400/80 flex items-center gap-1.5 pt-0.5">
		                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
		                  Ổ đĩa đã ngắt kết nối hoặc không tìm thấy đường dẫn
		                </p>
		              )}
		            </div>
		          );
		        })
		      ) : (
		        <div>
		          <div className="flex justify-between font-bold text-white">
		            <span>{storageInfo.displayName}</span>
		            <span>{Math.round(storageInfo.usedPercent || 0)}%</span>
		          </div>
		          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#18191c]">
		            <div className="h-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, storageInfo.usedPercent || 0))}%` }} />
		          </div>
		          <p className="mt-2 text-gray-400">{formatStorage(storageInfo.usedBytes)} / {formatStorage(storageInfo.totalBytes)} đã dùng • {formatStorage(storageInfo.availableBytes)} còn trống</p>
		        </div>
		      )}
		    </div>
		  ) : (
		    <p className="mt-2 text-gray-500">Đang chờ Storage local kết nối…</p>
		  )}
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
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ease-in-out ${
                openSection1 ? 'rotate-180' : ''
              }`}
            />
          </button>

          <div
            className={`grid transition-all duration-200 ease-in-out ${
              openSection1 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
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
            </div>
          </div>
        </div>

        {/* Section 2: Cookie MXH */}
        <div className="border border-[#383c42] rounded-[20px] bg-[#202124]/60 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              const nextState = !openSection2;
              setOpenSection2(nextState);
              if (nextState && !hasAutoCheckedCookiesOnWeb) {
                hasAutoCheckedCookiesOnWeb = true;
                // Kick off independent verification for each platform without blocking each other
                handleVerifyYoutubeCookie();
                handleVerifyTiktokCookie();
                handleVerifyFbCookie();
                handleVerifyIgCookie();
                handleVerifyXCookie();
              }
            }}
            className="w-full flex items-center justify-between p-4 text-xs font-bold text-gray-200 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Cookie className="w-4 h-4 text-amber-400" />
              <span>2. Cookie MXH</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ease-in-out ${
                openSection2 ? 'rotate-180' : ''
              }`}
            />
          </button>

          <div
            className={`grid transition-all duration-200 ease-in-out ${
              openSection2 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="p-4 pt-0 space-y-3 text-xs border-t border-[#383c42]/40">
                {/* YouTube Card */}
                <div className="bg-[#18191c] border border-[#383c42]/60 rounded-xl overflow-hidden mt-3">
                  {/* Layer 0: Header Row */}
                  <div
                    onClick={() => setIsYoutubeOpen(!isYoutubeOpen)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm">YouTube</span>
                        {isVerifyingCookie && (
                          <span className="text-[11px] text-blue-400 flex items-center gap-1 font-medium mt-0.5">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Đang kiểm tra...
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isVerifyingCookie && (
                        cookieStatus === "valid" ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Hợp lệ
                          </span>
                        ) : cookieStatus === "expired" ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Hết hạn / Lỗi
                          </span>
                        ) : null
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 ml-1 transition-transform duration-200 ease-in-out ${
                          isYoutubeOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Layer 1: Body Container */}
                  <div
                    className={`overflow-hidden transition-all duration-200 ease-in-out ${
                      isYoutubeOpen ? "max-h-[500px] opacity-100 p-3 pt-0 space-y-3 border-t border-[#383c42]/40" : "max-h-0 opacity-0"
                    }`}
                  >
                    {/* Verification feedback message */}
                    {cookieVerifyMsg && (
                      <div
                        className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 mt-3 ${
                          cookieVerifyMsg.type === "success"
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                        }`}
                      >
                        {cookieVerifyMsg.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{cookieVerifyMsg.text}</span>
                      </div>
                    )}

                    {/* Action Buttons - hidden while verifying */}
                    {!isVerifyingCookie && (
                      <div className="pt-2 border-t border-[#383c42]/40 flex justify-end">
                        <button
                          type="button"
                          onClick={handleVerifyYoutubeCookie}
                          className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-xl transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Kiểm tra youtube.txt</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* TikTok Card */}
                <div className="bg-[#18191c] border border-[#383c42]/60 rounded-xl overflow-hidden mt-3">
                  {/* Layer 0: Header Row */}
                  <div
                    onClick={() => setIsTiktokOpen(!isTiktokOpen)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm">TikTok</span>
                        {isVerifyingTiktokCookie && (
                          <span className="text-[11px] text-blue-400 flex items-center gap-1 font-medium mt-0.5">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Đang kiểm tra...
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isVerifyingTiktokCookie && (
                        tiktokCookieStatus === "valid" ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Hợp lệ
                          </span>
                        ) : tiktokCookieStatus === "expired" ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Hết hạn / Lỗi
                          </span>
                        ) : null
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 ml-1 transition-transform duration-200 ease-in-out ${
                          isTiktokOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Layer 1: Body Container */}
                  <div
                    className={`overflow-hidden transition-all duration-200 ease-in-out ${
                      isTiktokOpen ? "max-h-[500px] opacity-100 p-3 pt-0 space-y-3 border-t border-[#383c42]/40" : "max-h-0 opacity-0"
                    }`}
                  >
                    {/* Verification feedback message */}
                    {tiktokCookieVerifyMsg && (
                      <div
                        className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 mt-3 ${
                          tiktokCookieVerifyMsg.type === "success"
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                        }`}
                      >
                        {tiktokCookieVerifyMsg.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{tiktokCookieVerifyMsg.text}</span>
                      </div>
                    )}

                    {/* Action Buttons - hidden while verifying */}
                    {!isVerifyingTiktokCookie && (
                      <div className="pt-2 border-t border-[#383c42]/40 flex justify-end">
                        <button
                          type="button"
                          onClick={handleVerifyTiktokCookie}
                          className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-xl transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Kiểm tra tiktok.txt</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Facebook Card */}
                <div className="bg-[#18191c] border border-[#383c42]/60 rounded-xl overflow-hidden mt-3">
                  {/* Header Row */}
                  <div
                    onClick={() => setIsFbOpen(!isFbOpen)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#1877F2]/15 border border-[#1877F2]/30 flex items-center justify-center text-[#1877F2] shrink-0">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm">Facebook</span>
                        {isVerifyingFbCookie && (
                          <span className="text-[11px] text-blue-400 flex items-center gap-1 font-medium mt-0.5">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Đang kiểm tra...
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isVerifyingFbCookie && (
                        fbCookieStatus === "valid" ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Hợp lệ
                          </span>
                        ) : fbCookieStatus === "expired" ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Hết hạn / Lỗi
                          </span>
                        ) : null
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 ml-1 transition-transform duration-200 ease-in-out ${
                          isFbOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Body Container */}
                  <div
                    className={`overflow-hidden transition-all duration-200 ease-in-out ${
                      isFbOpen ? "max-h-[500px] opacity-100 p-3 pt-0 space-y-3 border-t border-[#383c42]/40" : "max-h-0 opacity-0"
                    }`}
                  >
                    {/* Verification feedback message */}
                    {fbCookieVerifyMsg && (
                      <div
                        className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 mt-3 ${
                          fbCookieVerifyMsg.type === "success"
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                        }`}
                      >
                        {fbCookieVerifyMsg.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{fbCookieVerifyMsg.text}</span>
                      </div>
                    )}

                    {/* Action Buttons - hidden while verifying */}
                    {!isVerifyingFbCookie && (
                      <div className="pt-2 border-t border-[#383c42]/40 flex justify-end">
                        <button
                          type="button"
                          onClick={handleVerifyFbCookie}
                          className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-xl transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Kiểm tra facebook.txt</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Instagram Card */}
                <div className="bg-[#18191c] border border-[#383c42]/60 rounded-xl overflow-hidden mt-3">
                  {/* Header Row */}
                  <div
                    onClick={() => setIsIgOpen(!isIgOpen)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441 6.45-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm">Instagram</span>
                        {isVerifyingIgCookie && (
                          <span className="text-[11px] text-blue-400 flex items-center gap-1 font-medium mt-0.5">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Đang kiểm tra...
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isVerifyingIgCookie && (
                        igCookieStatus === "valid" ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Hợp lệ
                          </span>
                        ) : igCookieStatus === "expired" ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Hết hạn / Lỗi
                          </span>
                        ) : null
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 ml-1 transition-transform duration-200 ease-in-out ${
                          isIgOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Body Container */}
                  <div
                    className={`overflow-hidden transition-all duration-200 ease-in-out ${
                      isIgOpen ? "max-h-[500px] opacity-100 p-3 pt-0 space-y-3 border-t border-[#383c42]/40" : "max-h-0 opacity-0"
                    }`}
                  >
                    {/* Verification feedback message */}
                    {igCookieVerifyMsg && (
                      <div
                        className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 mt-3 ${
                          igCookieVerifyMsg.type === "success"
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                        }`}
                      >
                        {igCookieVerifyMsg.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{igCookieVerifyMsg.text}</span>
                      </div>
                    )}

                    {/* Action Buttons - hidden while verifying */}
                    {!isVerifyingIgCookie && (
                      <div className="pt-2 border-t border-[#383c42]/40 flex justify-end">
                        <button
                          type="button"
                          onClick={handleVerifyIgCookie}
                          className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-xl transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Kiểm tra instagram.txt</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* X (Twitter) Card */}
                <div className="bg-[#18191c] border border-[#383c42]/60 rounded-xl overflow-hidden mt-3">
                  {/* Header Row */}
                  <div
                    onClick={() => setIsXOpen(!isXOpen)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm">X (Twitter)</span>
                        {isVerifyingXCookie && (
                          <span className="text-[11px] text-blue-400 flex items-center gap-1 font-medium mt-0.5">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Đang kiểm tra...
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isVerifyingXCookie && (
                        xCookieStatus === "valid" ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Hợp lệ
                          </span>
                        ) : xCookieStatus === "expired" ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex-shrink-0 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Hết hạn / Lỗi
                          </span>
                        ) : null
                      )}
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isXOpen ? "rotate-180" : ""}`} />
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className={`border-t border-[#383c42]/60 p-3 space-y-3 ${isXOpen ? "block" : "hidden"}`}>
                    {/* Verification feedback message */}
                    {xCookieVerifyMsg && (
                      <div
                        className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
                          xCookieVerifyMsg.type === "success"
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                        }`}
                      >
                        {xCookieVerifyMsg.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{xCookieVerifyMsg.text}</span>
                      </div>
                    )}

                    {/* Action Buttons - hidden while verifying */}
                    {!isVerifyingXCookie && (
                      <div className="pt-2 border-t border-[#383c42]/40 flex justify-end">
                        <button
                          type="button"
                          onClick={handleVerifyXCookie}
                          className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-xl transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Kiểm tra x.txt</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

		{/* Section 3: Client Cache Cleanup */}
        <div className="border border-[#383c42] rounded-[20px] bg-[#202124]/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenSection3(!openSection3)}
            className="w-full flex items-center justify-between p-4 text-xs font-bold text-gray-200 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span>3. Dọn dẹp Bộ nhớ tạm</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ease-in-out ${
                openSection3 ? 'rotate-180' : ''
              }`}
            />
          </button>

          <div
            className={`grid transition-all duration-200 ease-in-out ${
              openSection3 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
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
            </div>
          </div>
		</div>
		</div>
      </div>
    </div>
  );
};
