import { memo } from 'react';
import { HardDrive, ChevronDown, CheckCircle2, RefreshCw } from 'lucide-react';

/**
 * SettingsCache — Accordion section for Browser Cache size inspection and cleanup
 */
export const SettingsCache = memo(({
  isOpen,
  onToggle,
  cacheSizeText,
  cacheMsg,
  isClearingCache,
  onClearCache,
}) => {
  return (
    <div className="border border-[#383c42] rounded-[20px] bg-[#202124]/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-xs font-bold text-gray-200 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-amber-400" />
          <span>3. Dọn dẹp Bộ nhớ tạm</span>
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
                onClick={onClearCache}
                disabled={isClearingCache}
                className="flex items-center gap-1.5 px-4 py-1.5 font-bold text-black bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 rounded-xl shadow-lg shadow-amber-400/20 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isClearingCache ? 'animate-spin' : ''}`} />
                <span>Dọn dẹp Cache</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

SettingsCache.displayName = 'SettingsCache';
