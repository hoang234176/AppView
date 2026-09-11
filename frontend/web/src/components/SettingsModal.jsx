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
  Wifi,
  Cookie,
  AlertCircle,
  Clipboard
} from 'lucide-react';
import { saveServerConfig, getServerHost, validateCoordinatorHost } from '../api/axiosConfig';
import { fetchCoordinatorStorageInfo, getCookieStatus, verifyCookies, saveCookies } from '../api/downloadApi';

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
  const [openSection3, setOpenSection3] = useState(false);

  // Social Cookies State (YouTube)
  const [cookieStatus, setCookieStatus] = useState("loading"); // "loading" | "none" | "valid" | "expired"
  const [isYoutubeOpen, setIsYoutubeOpen] = useState(false);
  const [isCookieInputOpen, setIsCookieInputOpen] = useState(false);
  const [cookieFields, setCookieFields] = useState({
    LOGIN_INFO: "",
    SID: "",
    HSID: "",
    SSID: "",
    SAPISID: "",
    "__Secure-1PSID": "",
    "__Secure-3PSID": "",
  });
  const [isVerifyingCookie, setIsVerifyingCookie] = useState(false);
  const [isSavingCookie, setIsSavingCookie] = useState(false);
  const [isCookieVerified, setIsCookieVerified] = useState(false);
  const [cookieVerifyMsg, setCookieVerifyMsg] = useState(null);

  const fetchYoutubeCookieStatus = async () => {
    setCookieStatus("loading");
    const res = await getCookieStatus("youtube");
    if (res.success && res.data) {
      if (res.data.exists) {
        setCookieStatus("valid");
      } else {
        setCookieStatus("none");
      }
    } else {
      setCookieStatus("none");
    }
  };

  const handleCookieFieldChange = (key, value) => {
    setCookieFields((prev) => ({ ...prev, [key]: value }));
    setIsCookieVerified(false);
    setCookieVerifyMsg(null);
  };

  const handleVerifyYoutubeCookie = async () => {
    setIsVerifyingCookie(true);
    setCookieVerifyMsg(null);
    let payloadFields = null;
    if (isCookieInputOpen) {
      const hasAnyField = Object.values(cookieFields).some((v) => v && v.trim() !== "");
      if (!hasAnyField) {
        setIsVerifyingCookie(false);
        setCookieVerifyMsg({ type: "error", text: "Vui lòng nhập ít nhất một token cookie." });
        return;
      }
      payloadFields = cookieFields;
    }

    const res = await verifyCookies("youtube", payloadFields);
    setIsVerifyingCookie(false);
    if (res.success && res.data?.valid) {
      setIsCookieVerified(true);
      setCookieStatus("valid");
      setCookieVerifyMsg({ type: "success", text: res.data.message || "✓ Cookie hợp lệ!" });
    } else {
      setIsCookieVerified(false);
      if (!isCookieInputOpen) {
        setCookieStatus("expired");
      }
      const errMsg = res.data?.message || res.message || "Cookie không hợp lệ hoặc đã hết hạn.";
      setCookieVerifyMsg({ type: "error", text: errMsg });
    }
  };

  const handleSaveYoutubeCookie = async () => {
    if (!isCookieVerified || isSavingCookie) return;
    setIsSavingCookie(true);
    setCookieVerifyMsg(null);

    const res = await saveCookies("youtube", cookieFields);
    setIsSavingCookie(false);
    if (res.success) {
      setIsCookieInputOpen(false);
      setIsCookieVerified(false);
      setCookieStatus("valid");
      setCookieVerifyMsg({ type: "success", text: "Đã lưu cookie thành công!" });
      setTimeout(() => setCookieVerifyMsg(null), 3000);
    } else {
      setCookieVerifyMsg({ type: "error", text: res.message || "Không thể lưu cookie." });
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
      fetchYoutubeCookieStatus();
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
            onClick={() => setOpenSection2(!openSection2)}
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
                      <span className="font-bold text-white text-sm">YouTube</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {cookieStatus === "valid" ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Hợp lệ
                        </span>
                      ) : cookieStatus === "expired" ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Hết hạn / Lỗi
                        </span>
                      ) : cookieStatus === "loading" ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Đang tải...
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/30">
                          Chưa có cookie
                        </span>
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
                      isYoutubeOpen ? "max-h-[800px] opacity-100 p-3 pt-0 space-y-3 border-t border-[#383c42]/40" : "max-h-0 opacity-0"
                    }`}
                  >
                    {/* Layer 2: Sliding Input Container */}
                    <div
                      className={`overflow-hidden transition-all duration-200 ease-in-out ${
                        isCookieInputOpen ? "max-h-[500px] opacity-100 pt-2 pb-1" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] text-gray-400 mb-2">
                          Nhập các giá trị cookie từ tài khoản YouTube của bạn:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { key: "LOGIN_INFO", label: "LOGIN_INFO" },
                            { key: "SID", label: "SID" },
                            { key: "HSID", label: "HSID" },
                            { key: "SSID", label: "SSID" },
                            { key: "SAPISID", label: "SAPISID" },
                            { key: "__Secure-1PSID", label: "__Secure-1PSID" },
                            { key: "__Secure-3PSID", label: "__Secure-3PSID" },
                          ].map(({ key, label }) => (
                            <div key={key} className={key === "LOGIN_INFO" ? "sm:col-span-2" : ""}>
                              <label className="block text-[10px] font-mono text-gray-400 mb-0.5">
                                {label}
                              </label>
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  value={cookieFields[key] || ""}
                                  onChange={(e) => handleCookieFieldChange(key, e.target.value)}
                                  placeholder={`Nhập ${label}`}
                                  className="w-full bg-[#121316] border border-[#383c42] focus:border-red-500/60 rounded-lg pl-2.5 pr-20 py-1.5 text-xs text-white font-mono placeholder-gray-600 outline-none transition-colors"
                                />
                                <div className="absolute right-1 flex items-center gap-1">
                                  {cookieFields[key] ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCookieFieldChange(key, "")}
                                      className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                      title="Xóa"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const text = await navigator.clipboard.readText();
                                        if (text) handleCookieFieldChange(key, text.trim());
                                      } catch {
                                        // Clipboard error / permission denied
                                      }
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 transition-colors"
                                    title="Dán từ Clipboard"
                                  >
                                    <Clipboard className="w-3.5 h-3.5" />
                                    <span>Dán</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Verification / status feedback message */}
                    {cookieVerifyMsg && (
                      <div
                        className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
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

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#383c42]/40">
                      {isCookieInputOpen ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCookieInputOpen(false);
                            setIsCookieVerified(false);
                            setCookieVerifyMsg(null);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                        >
                          Hủy
                        </button>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleVerifyYoutubeCookie}
                          disabled={isVerifyingCookie}
                          className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 disabled:opacity-50 rounded-xl transition-all"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingCookie ? "animate-spin" : ""}`} />
                          <span>{isVerifyingCookie ? "Đang kiểm tra..." : "Kiểm tra cookie"}</span>
                        </button>

                        {isCookieInputOpen ? (
                          <button
                            type="button"
                            onClick={handleSaveYoutubeCookie}
                            disabled={!isCookieVerified || isSavingCookie}
                            className={`flex items-center gap-1.5 px-4 py-1.5 font-bold rounded-xl transition-all shadow-lg ${
                              isCookieVerified
                                ? "text-white bg-red-600 hover:bg-red-500 active:bg-red-700 shadow-red-600/30 ring-2 ring-red-400/50"
                                : "text-gray-500 bg-[#2a2b2f] cursor-not-allowed opacity-60"
                            }`}
                          >
                            {isSavingCookie ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Đang lưu...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Lưu cookie</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setIsCookieInputOpen(true);
                              setIsCookieVerified(false);
                              setCookieVerifyMsg(null);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 font-bold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-xl shadow-lg shadow-red-600/20 transition-all"
                          >
                            <Cookie className="w-3.5 h-3.5" />
                            <span>Nhập cookie</span>
                          </button>
                        )}
                      </div>
                    </div>
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
