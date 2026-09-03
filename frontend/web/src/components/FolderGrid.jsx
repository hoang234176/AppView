import React from 'react';
import { Folder, ArrowRight } from 'lucide-react';

export const FolderGrid = ({ folders = [], totalCount, onNavigate, onFolderContextMenu }) => {
  if (!folders || folders.length === 0) return null;

  const countDisplay = totalCount && totalCount > folders.length ? `${folders.length}/${totalCount}` : folders.length;

  return (
    <section className="px-6 sm:px-8 pt-4 pb-2 max-w-7xl mx-auto mb-2">
      <div className="flex items-center gap-2 mb-4 px-1">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Folder className="w-4 h-4 text-yellow-400 fill-yellow-400/20" /> Thư Mục <span className="text-xs font-mono text-gray-500">({countDisplay})</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {folders.map((folder, idx) => (
          <div
            key={folder.path || idx}
            onClick={() => onNavigate(folder.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onFolderContextMenu) {
                onFolderContextMenu(e, folder);
              }
            }}
            className="group bg-[#202124] hover:bg-[#2d2f31] border border-[#383c42] hover:border-[#8ab4f8]/60 rounded-[24px] p-4.5 cursor-pointer transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-[24px] bg-yellow-500/10 border border-yellow-500/20 group-hover:bg-yellow-500/15 group-hover:border-yellow-400/35 flex items-center justify-center flex-shrink-0 transition-colors">
                <Folder className="w-6 h-6 text-yellow-400 fill-yellow-400/20" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-200 group-hover:text-yellow-300 truncate">
                  {folder.name}
                </h3>
                <p className="text-xs text-gray-400 truncate mt-0.5 font-mono">
                  {folder.path}
                </p>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
          </div>
        ))}
      </div>
    </section>
  );
};
