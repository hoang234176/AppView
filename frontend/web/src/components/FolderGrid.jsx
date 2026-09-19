import React from 'react';
import { Folder, ArrowRight, Check } from 'lucide-react';
import { RollingNumber } from './common/RollingNumber';

const FolderCard = React.memo(({
  folder,
  isSelected,
  isSelectMode,
  onToggleSelect,
  onNavigate,
  onFolderContextMenu
}) => {
  return (
    <div
      onClick={() => {
        if (isSelectMode) {
          if (onToggleSelect) onToggleSelect(folder, 'folder');
        } else {
          onNavigate(folder.path);
        }
      }}
      onContextMenu={(e) => {
        if (isSelectMode) return;
        e.preventDefault();
        e.stopPropagation();
        if (onFolderContextMenu) {
          onFolderContextMenu(e, folder);
        }
      }}
      className={`group bg-[#202124] hover:bg-[#2d2f31] border rounded-[24px] p-4.5 cursor-pointer transition-[border-color,background-color] duration-150 flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 relative ${
        isSelected
          ? 'border-yellow-400 bg-yellow-500/10 ring-1 ring-yellow-400/30'
          : 'border-[#383c42] hover:border-[#8ab4f8]/60'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Select Checkbox in card */}
        {isSelectMode && (
          <div className="flex-shrink-0">
            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors duration-150 ${
              isSelected
                ? 'bg-yellow-400 border-yellow-400 text-[#1c1d21] shadow-sm'
                : 'border-gray-500 bg-black/30 group-hover:border-yellow-400'
            }`}>
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>
        )}

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

      {!isSelectMode && (
        <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
      )}
    </div>
  );
});

FolderCard.displayName = 'FolderCard';

export const FolderGrid = ({
  folders = [],
  totalCount,
  onNavigate,
  onFolderContextMenu,
  isSelectMode = false,
  selectedItems = new Map(),
  onToggleSelect,
  onToggleSelectAll,
}) => {
  if (!folders || folders.length === 0) return null;

  const countDisplay = totalCount && totalCount > folders.length ? `${folders.length}/${totalCount}` : folders.length;
  const isAllSelected = folders.length > 0 && folders.every((f) => selectedItems.has(`folder:${f.path}`));

  return (
    <section className="px-6 sm:px-8 pt-4 pb-2 max-w-7xl mx-auto mb-2">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Folder className="w-4 h-4 text-yellow-400 fill-yellow-400/20" /> Thư Mục <span className="text-xs font-mono text-gray-500">(<RollingNumber value={countDisplay} />)</span>
        </h2>

        {isSelectMode && (
          <div className="relative group">
            <button
              type="button"
              onClick={onToggleSelectAll}
              title={isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              aria-label={isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200 active:scale-90 shadow-sm ${
                isAllSelected
                  ? 'bg-yellow-400 border-yellow-400 text-[#1c1d21] shadow-yellow-400/20'
                  : 'bg-[#28292d] border-[#383c42] hover:border-yellow-400/60 hover:bg-[#383c42] text-gray-400 hover:text-white'
              }`}
            >
              <Check className={`w-3.5 h-3.5 stroke-[2.5] transition-all ${
                isAllSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-0 group-hover:opacity-60'
              }`} />
            </button>
            <div className="pointer-events-none absolute right-0 top-full mt-1.5 hidden group-hover:flex items-center whitespace-nowrap rounded-lg bg-[#18191c] px-2.5 py-1 text-[11px] font-medium text-gray-200 shadow-xl border border-[#383c42] z-30 animate-fade-in">
              {isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {folders.map((folder, idx) => (
          <FolderCard
            key={folder.path || idx}
            folder={folder}
            isSelected={Boolean(selectedItems.has(`folder:${folder.path}`))}
            isSelectMode={isSelectMode}
            onToggleSelect={onToggleSelect}
            onNavigate={onNavigate}
            onFolderContextMenu={onFolderContextMenu}
          />
        ))}
      </div>
    </section>
  );
};
