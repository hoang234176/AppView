import React from 'react';
import { 
  X, 
  HardDrive, 
  Calendar, 
  Maximize2, 
  FileCode, 
  Image as ImageIcon,
  Film
} from 'lucide-react';
import { formatDate, formatFileSize, getThumbnailUrl, getVideoThumbnailUrl } from '../utils/formatters';

export const MediaInfoModal = ({ isOpen, onClose, item, type = 'picture' }) => {
  if (!isOpen || !item) return null;

  const isVideo = type === 'video' || item.type === 'video';
  const thumbUrl = isVideo ? getVideoThumbnailUrl(item) : getThumbnailUrl(item);

  const dimensionsStr = (item.width && item.height) 
    ? `${item.width} × ${item.height}` 
    : (item.resolution ? item.resolution : 'Không rõ');

  const extStr = item.extension 
    ? item.extension.toUpperCase() 
    : (item.name ? item.name.split('.').pop().toUpperCase() : 'UNKNOWN');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in">
      <div className="bg-[#1c1d21] border border-[#383c42] rounded-[28px] p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-[#383c42]">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isVideo 
                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' 
                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
            }`}>
              {isVideo ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            </div>
            Thông tin {isVideo ? 'Video' : 'Hình ảnh'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Media Preview Box */}
        <div className="bg-[#202124] border border-[#383c42] rounded-2xl p-3 flex items-start gap-3">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={item.name}
              className="w-14 h-14 object-cover rounded-xl border border-[#383c42] flex-shrink-0 bg-[#18191c]"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#18191c] border border-[#383c42] flex items-center justify-center flex-shrink-0 text-gray-500">
              {isVideo ? <Film className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
          )}

          <div className="flex min-h-14 min-w-0 flex-1 items-center">
            <h4 className="w-full text-xs font-bold leading-snug break-words text-white" title={item.name}>
              {item.name}
            </h4>
          </div>
        </div>

        {/* Info Grid Items */}
        <div className="bg-[#202124] border border-[#383c42] rounded-2xl p-3.5 space-y-2.5 text-xs">
          {/* File Size */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              Dung lượng tệp:
            </span>
            <span className="font-mono font-bold text-white">
              {formatFileSize(item.size)}
            </span>
          </div>

          <div className="h-px bg-[#383c42]/50 w-full" />

          {/* Dimensions / Resolution */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-2">
              <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
              Độ phân giải:
            </span>
            <span className="font-mono font-bold text-white">
              {dimensionsStr}
            </span>
          </div>

          <div className="h-px bg-[#383c42]/50 w-full" />

          {/* Format / Extension */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5 text-yellow-400" />
              Định dạng tệp:
            </span>
            <span className="font-mono font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-md text-[11px]">
              .{extStr}
            </span>
          </div>

          <div className="h-px bg-[#383c42]/50 w-full" />

          {/* Date Modified */}
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Ngày cập nhật:
            </span>
            <span className="font-mono font-bold text-white">
              {formatDate(item.mod_time)}
            </span>
          </div>
        </div>

        {/* Footer Close Button */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn-google btn-google-primary text-xs px-4 py-1.5"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
