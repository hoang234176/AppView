import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  HardDrive,
  ArrowRight,
  Film,
  Image as ImageIcon,
  Folder,
  CheckSquare,
  Square,
} from 'lucide-react';
import { FileTypeIcon } from './icons/FileTypeIcon';

export const ConflictResolutionModal = ({
  isOpen,
  conflicts = [],
  action = 'copy',
  onResolve, // ({ resolutions, defaultResolution }) => void
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [applyToAll, setApplyToAll] = useState(false);
  const [resolutions, setResolutions] = useState({}); // { [path or fileName]: 'keep_both' | 'overwrite' | 'skip' }

  if (!isOpen || !conflicts || conflicts.length === 0) return null;

  const currentConflict = conflicts[currentIndex] || conflicts[0];
  const total = conflicts.length;
  const isLast = currentIndex >= total - 1;

  const getMediaThumbnail = (side, type) => {
    if (!side) return null;
    const isVid = type === 'video' || /\.(mp4|mkv|webm|avi|mov|flv|wmv|m4v)$/i.test(side.name);
    const isPic = type === 'picture' || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(side.name);
    const isDir = side.is_dir || type === 'folder';

    if (isDir) {
      return (
        <div className="w-full h-44 flex flex-col items-center justify-center bg-[#121316] rounded-xl border border-[#2b2d33]">
          <Folder className="w-16 h-16 text-yellow-400 fill-yellow-400/20" />
        </div>
      );
    }

    if (side.thumbnail_url && (isVid || isPic)) {
      return (
        <div className="relative w-full h-44 bg-[#121316] rounded-xl overflow-hidden border border-[#2b2d33] flex items-center justify-center">
          <img
            src={side.thumbnail_url}
            alt={side.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden w-full h-full flex items-center justify-center bg-[#121316]">
            {isVid ? (
              <Film className="w-12 h-12 text-blue-400" />
            ) : (
              <ImageIcon className="w-12 h-12 text-emerald-400" />
            )}
          </div>
          {isVid && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10 flex items-center gap-1 text-[10px] font-semibold text-white">
              <Film className="w-3 h-3 text-blue-400" />
              <span>Video</span>
            </div>
          )}
          {isPic && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10 flex items-center gap-1 text-[10px] font-semibold text-white">
              <ImageIcon className="w-3 h-3 text-emerald-400" />
              <span>Ảnh</span>
            </div>
          )}
        </div>
      );
    }

    if (isVid) {
      return (
        <div className="w-full h-44 flex flex-col items-center justify-center bg-[#121316] rounded-xl border border-[#2b2d33]">
          <Film className="w-16 h-16 text-blue-400" />
        </div>
      );
    }

    if (isPic) {
      return (
        <div className="w-full h-44 flex flex-col items-center justify-center bg-[#121316] rounded-xl border border-[#2b2d33]">
          <ImageIcon className="w-16 h-16 text-emerald-400" />
        </div>
      );
    }

    return (
      <div className="w-full h-44 flex flex-col items-center justify-center bg-[#121316] rounded-xl border border-[#2b2d33]">
        <FileTypeIcon filename={side.name} className="w-16 h-16" />
      </div>
    );
  };

  const handleAction = (choice) => {
    // choice: 'skip' | 'overwrite' | 'keep_both'
    const updated = {
      ...resolutions,
      [currentConflict.file_name]: choice,
    };
    if (currentConflict.src?.path) {
      updated[currentConflict.src.path] = choice;
    }

    if (applyToAll || isLast) {
      onResolve({
        resolutions: updated,
        defaultResolution: choice,
      });
      return;
    }

    setResolutions(updated);
    setCurrentIndex((prev) => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl bg-[#1c1d21] border border-[#383c42] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2d33]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">
                Tệp đã tồn tại: "{currentConflict.file_name}"
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {total > 1 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#28292d] text-gray-300 border border-[#383c42]">
                {currentIndex + 1} / {total}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Comparison Body: Side-by-Side Thumbnails */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Left: Destination (Existing) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Tệp hiện tại</span>
              </div>

              {getMediaThumbnail(currentConflict.dest, currentConflict.type)}

              <div
                className="text-xs font-mono text-gray-300 truncate"
                title={currentConflict.dest?.name || currentConflict.file_name}
              >
                {currentConflict.dest?.name || currentConflict.file_name}
              </div>
            </div>

            {/* Right: Source (Incoming) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Tệp chuyển đến</span>
              </div>

              {getMediaThumbnail(currentConflict.src, currentConflict.type)}

              <div
                className="text-xs font-mono text-gray-300 truncate"
                title={currentConflict.src?.name || currentConflict.file_name}
              >
                {currentConflict.src?.name || currentConflict.file_name}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#17181c] border-t border-[#2b2d33] flex flex-col gap-3">
          {/* Apply to remaining conflicts checkbox */}
          {total > 1 && !isLast && (
            <div
              onClick={() => setApplyToAll(!applyToAll)}
              className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-400 hover:text-gray-200 transition-colors w-fit"
            >
              {applyToAll ? (
                <CheckSquare className="w-4 h-4 text-blue-400" />
              ) : (
                <Square className="w-4 h-4 text-gray-500" />
              )}
              <span>Áp dụng cho các tệp trùng tiếp theo</span>
            </div>
          )}

          {/* 3 Action Buttons */}
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => handleAction('skip')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-300 bg-[#28292d] hover:bg-[#383c42] hover:text-white transition-all active:scale-95"
            >
              Bỏ qua
            </button>

            <button
              type="button"
              onClick={() => handleAction('overwrite')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-300 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 transition-all active:scale-95"
            >
              Ghi đè
            </button>

            <button
              type="button"
              onClick={() => handleAction('keep_both')}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all active:scale-95"
            >
              Giữ cả hai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
