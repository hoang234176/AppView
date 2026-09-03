import React, { useEffect, useRef } from 'react';
import { ChevronRight, Home, Folder } from 'lucide-react';
import { parseBreadcrumbs } from '../utils/formatters';

export const Breadcrumbs = ({ currentPath, onNavigate, totalFolders = 0, totalPictures = 0, totalVideos = 0 }) => {
  const breadcrumbs = parseBreadcrumbs(currentPath);
  const navRef = useRef(null);

  // Auto-scroll to far-right whenever currentPath changes so the active subfolder is always visible
  useEffect(() => {
    if (navRef.current) {
      setTimeout(() => {
        if (navRef.current) {
          navRef.current.scrollTo({
            left: navRef.current.scrollWidth,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  }, [currentPath]);

  return (
    <div className="w-full px-4 sm:px-6 pt-4 pb-2">
      <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#202124]/40 p-3.5 sm:p-4 rounded-[24px] border border-[#383c42]/50 shadow-sm overflow-hidden">
        
        {/* Navigation Breadcrumb Pills (Auto-scrolling container) */}
        <nav 
          ref={navRef}
          className="flex items-center flex-nowrap gap-2 text-xs overflow-x-auto custom-scrollbar py-0.5 max-w-full w-full sm:w-auto scroll-smooth"
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isRoot = index === 0;

            return (
              <React.Fragment key={item.path || 'root'}>
                {index > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                )}
                
                <button
                  type="button"
                  onClick={(e) => {
                    onNavigate(item.path);
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[24px] text-xs font-semibold flex-shrink-0 transition-all ${
                    isLast 
                      ? 'bg-[#8ab4f8]/20 text-[#8ab4f8] border border-[#8ab4f8]/40 shadow-sm' 
                      : 'bg-[#202124] text-gray-300 hover:text-white hover:bg-[#2d2f31] border border-[#383c42]'
                  }`}
                >
                  {isRoot ? (
                    <Home className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                  )}
                  <span className="whitespace-nowrap max-w-[200px] sm:max-w-[320px] truncate">{item.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Stats info (Always displays F, P, V with tight spacing between number & letter) */}
        <div className="flex items-center gap-3 text-xs text-gray-400 self-end sm:self-center flex-shrink-0">
          <span className="bg-[#202124] px-3 py-1.5 rounded-[24px] border border-[#383c42] font-mono text-[11px] shadow-sm flex items-center gap-2">
            <span><strong className="text-yellow-400">{totalFolders}</strong><span className="text-gray-400 font-semibold ml-0.5">F</span></span>
            <span className="text-gray-500">•</span>
            <span><strong className="text-blue-400">{totalPictures}</strong><span className="text-gray-400 font-semibold ml-0.5">P</span></span>
            <span className="text-gray-500">•</span>
            <span><strong className="text-purple-400">{totalVideos}</strong><span className="text-gray-400 font-semibold ml-0.5">V</span></span>
          </span>
        </div>

      </div>
    </div>
  );
};
