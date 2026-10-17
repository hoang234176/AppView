import { memo } from 'react';
import { X, Copy, FolderInput, Trash2, CheckCircle2 } from 'lucide-react';
import { RollingNumber } from '../../common/RollingNumber';
import './HeaderSelectMode.css';

/**
 * HeaderSelectBar — Full toolbar when multiple-select mode is active
 */
export const HeaderSelectBar = memo(({
  onExitSelectMode,
  selectedCount = 0,
  onBatchCopy,
  onBatchMove,
  onBatchDelete,
}) => {
  return (
    <div className="flex-1 flex items-center justify-between gap-3 animate-fade-in">
      {/* Left: Button X to exit select mode + Count of selected items */}
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={onExitSelectMode}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#383c42] bg-[#28292d] text-gray-300 hover:text-white hover:border-red-500/60 hover:bg-red-500/10 transition-all duration-200 active:scale-95 shadow-sm"
          title="Thoát chế độ chọn"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-bold text-white tracking-tight">
            Đã chọn <span className="text-blue-400 font-mono text-base sm:text-lg"><RollingNumber value={selectedCount} /></span> mục
          </span>
        </div>
      </div>

      {/* Right: 3 Round Action Buttons (Sao chép, Di chuyển, Xóa) */}
      <div className="flex items-center gap-2">
        {/* Nút Sao chép */}
        <button
          type="button"
          onClick={onBatchCopy}
          disabled={selectedCount === 0}
          title="Sao chép các mục đã chọn"
          className="group flex h-10 w-10 items-center justify-center rounded-full border border-[#383c42] bg-[#28292d] text-blue-400 hover:text-white hover:bg-blue-500/20 hover:border-blue-500/60 transition-all duration-200 active:scale-95 disabled:opacity-35 disabled:hover:bg-[#28292d] disabled:hover:border-[#383c42] disabled:hover:text-blue-400 shadow-sm"
        >
          <Copy className="h-4.5 w-4.5" />
        </button>

        {/* Nút Di chuyển */}
        <button
          type="button"
          onClick={onBatchMove}
          disabled={selectedCount === 0}
          title="Di chuyển các mục đã chọn"
          className="group flex h-10 w-10 items-center justify-center rounded-full border border-[#383c42] bg-[#28292d] text-amber-400 hover:text-white hover:bg-amber-500/20 hover:border-amber-500/60 transition-all duration-200 active:scale-95 disabled:opacity-35 disabled:hover:bg-[#28292d] disabled:hover:border-[#383c42] disabled:hover:text-amber-400 shadow-sm"
        >
          <FolderInput className="h-4.5 w-4.5" />
        </button>

        {/* Nút Xóa */}
        <button
          type="button"
          onClick={onBatchDelete}
          disabled={selectedCount === 0}
          title="Xóa các mục đã chọn"
          className="group flex h-10 w-10 items-center justify-center rounded-full border border-[#383c42] bg-[#28292d] text-red-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/60 transition-all duration-200 active:scale-95 disabled:opacity-35 disabled:hover:bg-[#28292d] disabled:hover:border-[#383c42] disabled:hover:text-red-400 shadow-sm"
        >
          <Trash2 className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
});

HeaderSelectBar.displayName = 'HeaderSelectBar';

/**
 * HeaderSelectButton — Trigger button to enter select mode (in normal mode header)
 */
export const HeaderSelectButton = memo(({ onEnterSelectMode }) => {
  return (
    <button
      type="button"
      onClick={onEnterSelectMode}
      title="Chọn nhiều mục"
      className="group flex h-10 w-10 items-center justify-center rounded-full border border-[#383c42] bg-[#28292d] text-gray-300 hover:text-white hover:border-[#8ab4f8]/60 transition-colors duration-200 active:scale-95 shadow-sm"
    >
      <CheckCircle2 className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
    </button>
  );
});

HeaderSelectButton.displayName = 'HeaderSelectButton';

/**
 * HeaderSelectMode — Unified component handling both select mode bar and trigger button
 */
export const HeaderSelectMode = memo((props) => {
  if (props.isSelectMode) {
    return <HeaderSelectBar {...props} />;
  }
  return <HeaderSelectButton onEnterSelectMode={props.onEnterSelectMode} />;
});

HeaderSelectMode.displayName = 'HeaderSelectMode';
