import React, { useState, useEffect, useRef } from 'react';
import { Plus, FolderPlus, Archive } from 'lucide-react';

export const FabSpeedDial = ({ onCreateFolder, onDownloadArchive }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (callback) => {
    setIsOpen(false);
    if (callback) callback();
  };

  return (
    <div ref={containerRef} className="fixed bottom-10 right-10 sm:bottom-12 sm:right-12 z-40 flex flex-col items-end gap-3 select-none">
      {/* SPEED DIAL OPTIONS (SLIDES OUT WHEN ACTIVE) */}
      {isOpen && (
        <div className="flex flex-col items-end gap-2.5 mb-1 animate-speed-dial-enter">
          {/* OPTION 1: TẢI FILE NÉN */}
          <button
            type="button"
            onClick={() => handleAction(onDownloadArchive)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#1c1d21] border border-[#383c42] hover:border-amber-400 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          >
            <span className="text-xs font-bold text-gray-200 group-hover:text-amber-300">Tải file nén</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Archive className="w-4 h-4" />
            </div>
          </button>

          {/* OPTION 2: TẠO THƯ MỤC */}
          <button
            type="button"
            onClick={() => handleAction(onCreateFolder)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#1c1d21] border border-[#383c42] hover:border-blue-400 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          >
            <span className="text-xs font-bold text-gray-200 group-hover:text-blue-300">Tạo thư mục</span>
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* MAIN FAB BUTTON (+) - ROTATES 45 DEGREES ON CLICK */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-14 h-14 rounded-full text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all duration-[400ms] cursor-pointer border border-blue-300/30 ${
          isOpen 
            ? 'bg-[#28292d] border-[#383c42] text-gray-300' 
            : 'bg-gradient-to-tr from-blue-600 to-blue-400 shadow-blue-500/30'
        }`}
        title={isOpen ? 'Đóng menu' : 'Thêm mới'}
      >
        <Plus className={`w-7 h-7 transition-transform duration-[400ms] ease-in-out ${isOpen ? 'transform rotate-45 text-rose-400' : ''}`} />
      </button>
    </div>
  );
};
