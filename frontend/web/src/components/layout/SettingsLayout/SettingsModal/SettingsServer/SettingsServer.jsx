import { memo } from 'react';
import { Wifi, ChevronDown, RefreshCw, Check } from 'lucide-react';

/**
 * SettingsServer — Accordion section for Server Host IP/Port connection configuration
 */
export const SettingsServer = memo(({
  isOpen,
  onToggle,
  connectionState,
  serverHost,
  setServerHost,
  serverErrorMsg,
  serverSavedMsg,
  onSubmit,
}) => {
  return (
    <div className="border border-[#383c42] rounded-[20px] bg-[#202124]/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-xs font-bold text-gray-200 hover:bg-white/5 transition-colors cursor-pointer"
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
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <form onSubmit={onSubmit} className="p-4 pt-0 space-y-3 text-xs font-semibold border-t border-[#383c42]/40">
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
                className="flex items-center gap-1.5 px-4 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
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
  );
});

SettingsServer.displayName = 'SettingsServer';
