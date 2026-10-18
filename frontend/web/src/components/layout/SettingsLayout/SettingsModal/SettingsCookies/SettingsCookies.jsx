import { memo } from 'react';
import { Cookie, ChevronDown, Check, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * SettingsCookies — Accordion section for social media cookies status and verification
 */
export const SettingsCookies = memo(({
  isOpen,
  onToggle,
  // YouTube
  cookieStatus,
  isYoutubeOpen,
  setIsYoutubeOpen,
  isVerifyingCookie,
  handleVerifyYoutubeCookie,
  // TikTok
  tiktokCookieStatus,
  isTiktokOpen,
  setIsTiktokOpen,
  isVerifyingTiktokCookie,
  handleVerifyTiktokCookie,
  // Facebook
  fbCookieStatus,
  isFbOpen,
  setIsFbOpen,
  isVerifyingFbCookie,
  handleVerifyFbCookie,
  // Instagram
  igCookieStatus,
  isIgOpen,
  setIsIgOpen,
  isVerifyingIgCookie,
  handleVerifyIgCookie,
  // X
  xCookieStatus,
  isXOpen,
  setIsXOpen,
  isVerifyingXCookie,
  handleVerifyXCookie,
}) => {
  return (
    <div className="border border-[#383c42] rounded-[20px] bg-[#202124]/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-xs font-bold text-gray-200 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Cookie className="w-4 h-4 text-amber-400" />
          <span>2. Cookie MXH</span>
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
          <div className="p-4 pt-0 space-y-3 text-xs border-t border-[#383c42]/40">
            {/* YouTube Card */}
            <div className="bg-[#18191c] border border-[#383c42]/60 rounded-xl overflow-hidden mt-3">
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

              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isYoutubeOpen ? "max-h-[500px] opacity-100 p-3 pt-0 border-t border-[#383c42]/40" : "max-h-0 opacity-0"
                }`}
              >
                {!isVerifyingCookie && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleVerifyYoutubeCookie}
                      className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-xl transition-all cursor-pointer"
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

              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isTiktokOpen ? "max-h-[500px] opacity-100 p-3 pt-0 border-t border-[#383c42]/40" : "max-h-0 opacity-0"
                }`}
              >
                {!isVerifyingTiktokCookie && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleVerifyTiktokCookie}
                      className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-xl transition-all cursor-pointer"
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

              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isFbOpen ? "max-h-[500px] opacity-100 p-3 pt-0 border-t border-[#383c42]/40" : "max-h-0 opacity-0"
                }`}
              >
                {!isVerifyingFbCookie && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleVerifyFbCookie}
                      className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-xl transition-all cursor-pointer"
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

              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isIgOpen ? "max-h-[500px] opacity-100 p-3 pt-0 border-t border-[#383c42]/40" : "max-h-0 opacity-0"
                }`}
              >
                {!isVerifyingIgCookie && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleVerifyIgCookie}
                      className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-xl transition-all cursor-pointer"
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

              <div className={`border-t border-[#383c42]/40 p-3 pt-0 ${isXOpen ? "block" : "hidden"}`}>
                {!isVerifyingXCookie && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleVerifyXCookie}
                      className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-xl transition-all cursor-pointer"
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
  );
});

SettingsCookies.displayName = 'SettingsCookies';
