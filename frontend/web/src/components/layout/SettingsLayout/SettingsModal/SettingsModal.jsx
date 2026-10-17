import { useState, useEffect, memo } from 'react';
import { X, Server } from 'lucide-react';
import { saveServerConfig, getServerHost, validateCoordinatorHost } from '../../../../api/axiosConfig';
import { fetchCoordinatorStorageInfo, verifyCookies } from '../../../../api/downloadApi';
import { SettingsStorage } from './SettingsStorage/SettingsStorage';
import { SettingsServer } from './SettingsServer/SettingsServer';
import { SettingsCookies } from './SettingsCookies/SettingsCookies';
import { SettingsCache } from './SettingsCache/SettingsCache';
import './SettingsModal.css';

let hasAutoCheckedCookiesOnWeb = false;

/**
 * SettingsModal — Modal dialog containing server, storage, cookies, and cache settings
 */
export const SettingsModal = memo(({ isOpen, onClose, onRefreshFolder, onServerConfigSaved, onServerConfigFailed }) => {
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

  const handleVerifyYoutubeCookie = async () => {
    setIsVerifyingCookie(true);
    const res = await verifyCookies("youtube");
    setIsVerifyingCookie(false);
    if (res.success && res.data?.valid) {
      setCookieStatus("valid");
    } else {
      setCookieStatus("expired");
    }
  };

  // Social Cookies State (TikTok)
  const [tiktokCookieStatus, setTiktokCookieStatus] = useState("none");
  const [isTiktokOpen, setIsTiktokOpen] = useState(false);
  const [isVerifyingTiktokCookie, setIsVerifyingTiktokCookie] = useState(false);

  const handleVerifyTiktokCookie = async () => {
    setIsVerifyingTiktokCookie(true);
    const res = await verifyCookies("tiktok");
    setIsVerifyingTiktokCookie(false);
    if (res.success && res.data?.valid) {
      setTiktokCookieStatus("valid");
    } else {
      setTiktokCookieStatus("expired");
    }
  };

  // Social Cookies State (Facebook)
  const [fbCookieStatus, setFbCookieStatus] = useState("none");
  const [isFbOpen, setIsFbOpen] = useState(false);
  const [isVerifyingFbCookie, setIsVerifyingFbCookie] = useState(false);

  const handleVerifyFbCookie = async () => {
    setIsVerifyingFbCookie(true);
    const res = await verifyCookies("facebook");
    setIsVerifyingFbCookie(false);
    if (res.success && res.data?.valid) {
      setFbCookieStatus("valid");
    } else {
      setFbCookieStatus("expired");
    }
  };

  // Social Cookies State (Instagram)
  const [igCookieStatus, setIgCookieStatus] = useState("none");
  const [isIgOpen, setIsIgOpen] = useState(false);
  const [isVerifyingIgCookie, setIsVerifyingIgCookie] = useState(false);

  const handleVerifyIgCookie = async () => {
    setIsVerifyingIgCookie(true);
    const res = await verifyCookies("instagram");
    setIsVerifyingIgCookie(false);
    if (res.success && res.data?.valid) {
      setIgCookieStatus("valid");
    } else {
      setIgCookieStatus("expired");
    }
  };

  // Social Cookies State (X / Twitter)
  const [xCookieStatus, setXCookieStatus] = useState("none");
  const [isXOpen, setIsXOpen] = useState(false);
  const [isVerifyingXCookie, setIsVerifyingXCookie] = useState(false);

  const handleVerifyXCookie = async () => {
    setIsVerifyingXCookie(true);
    const res = await verifyCookies("x");
    setIsVerifyingXCookie(false);
    if (res.success && res.data?.valid) {
      setXCookieStatus("valid");
    } else {
      setXCookieStatus("expired");
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

      // Check current connection state
      if (currentHost) {
        setConnectionState('checking');
        validateCoordinatorHost(currentHost)
          .then((isValid) => {
            setConnectionState(isValid ? 'connected' : 'failed');
            if (isValid) loadStorageDetails();
          })
          .catch(() => setConnectionState('failed'));
      } else {
        setConnectionState('idle');
      }
    }
  }, [isOpen]);

  const handleSaveServerConfig = async (e) => {
    e.preventDefault();
    setServerErrorMsg('');
    setServerSavedMsg('');

    const rawHost = serverHost.trim();
    if (!rawHost) {
      setServerErrorMsg('Vui lòng nhập địa chỉ máy chủ');
      return;
    }

    setConnectionState('checking');

    // 1. Validate Coordinator host first (checks :8090/health)
    const isValid = await validateCoordinatorHost(rawHost);
    if (!isValid) {
      setConnectionState('failed');
      setServerErrorMsg(
        `Không thể kết nối đến Coordinator tại "${rawHost}:8090". Vui lòng kiểm tra lại địa chỉ và đảm bảo Coordinator đang chạy.`
      );
      onServerConfigFailed?.(rawHost);
      return;
    }

    // 2. Host is valid, save to localStorage
    const host = saveServerConfig(rawHost);
    setConnectionState('connected');
    setServerSavedMsg('✓ Đã kết nối và lưu cấu hình thành công!');
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

  if (!isOpen) return null;

  return (
    <div
      className="settings-modal-backdrop animate-fade-in"
      onClick={onClose}
      onWheelCapture={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
      role="presentation"
    >
      <div 
        className="settings-modal-container animate-pop-fast"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cài đặt hệ thống"
      >
        {/* Header stays fixed while Settings content scrolls internally. */}
        <div className="settings-modal-header">
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
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="settings-modal-body custom-scrollbar">
          {/* Storage Info */}
          <SettingsStorage storageInfo={storageInfo} />

          {/* Section 1: Server Host */}
          <SettingsServer
            isOpen={openSection1}
            onToggle={() => setOpenSection1(!openSection1)}
            connectionState={connectionState}
            serverHost={serverHost}
            setServerHost={setServerHost}
            serverErrorMsg={serverErrorMsg}
            serverSavedMsg={serverSavedMsg}
            onSubmit={handleSaveServerConfig}
          />

          {/* Section 2: Cookie MXH */}
          <SettingsCookies
            isOpen={openSection2}
            onToggle={() => {
              const nextState = !openSection2;
              setOpenSection2(nextState);
              if (nextState && !hasAutoCheckedCookiesOnWeb) {
                hasAutoCheckedCookiesOnWeb = true;
                handleVerifyYoutubeCookie();
                handleVerifyTiktokCookie();
                handleVerifyFbCookie();
                handleVerifyIgCookie();
                handleVerifyXCookie();
              }
            }}
            cookieStatus={cookieStatus}
            isYoutubeOpen={isYoutubeOpen}
            setIsYoutubeOpen={setIsYoutubeOpen}
            isVerifyingCookie={isVerifyingCookie}
            handleVerifyYoutubeCookie={handleVerifyYoutubeCookie}
            tiktokCookieStatus={tiktokCookieStatus}
            isTiktokOpen={isTiktokOpen}
            setIsTiktokOpen={setIsTiktokOpen}
            isVerifyingTiktokCookie={isVerifyingTiktokCookie}
            handleVerifyTiktokCookie={handleVerifyTiktokCookie}
            fbCookieStatus={fbCookieStatus}
            isFbOpen={isFbOpen}
            setIsFbOpen={setIsFbOpen}
            isVerifyingFbCookie={isVerifyingFbCookie}
            handleVerifyFbCookie={handleVerifyFbCookie}
            igCookieStatus={igCookieStatus}
            isIgOpen={isIgOpen}
            setIsIgOpen={setIsIgOpen}
            isVerifyingIgCookie={isVerifyingIgCookie}
            handleVerifyIgCookie={handleVerifyIgCookie}
            xCookieStatus={xCookieStatus}
            isXOpen={isXOpen}
            setIsXOpen={setIsXOpen}
            isVerifyingXCookie={isVerifyingXCookie}
            handleVerifyXCookie={handleVerifyXCookie}
          />

          {/* Section 3: Client Cache Cleanup */}
          <SettingsCache
            isOpen={openSection3}
            onToggle={() => setOpenSection3(!openSection3)}
            cacheSizeText={cacheSizeText}
            cacheMsg={cacheMsg}
            isClearingCache={isClearingCache}
            onClearCache={handleClearBrowserCache}
          />
        </div>
      </div>
    </div>
  );
});

SettingsModal.displayName = 'SettingsModal';
