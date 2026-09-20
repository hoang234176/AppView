import React from 'react';
import { Folder, ArrowRight, Check } from 'lucide-react';
import { RollingNumber } from './common/RollingNumber';

const FolderCard = React.memo(({
  folder,
  isSelected,
  isSelectMode,
  onToggleSelect,
  onNavigate,
  onFolderContextMenu,
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
      className={`group relative bg-[#202124] border rounded-[24px] shadow-sm hover:shadow-xl cursor-pointer transition-[border-color,background-color,box-shadow] duration-150 flex flex-col hover:-translate-y-1 aspect-square ${
        isSelected
          ? 'border-yellow-400 ring-2 ring-yellow-400/30 bg-yellow-500/10'
          : 'border-[#383c42] hover:border-yellow-400/70'
      }`}
    >
      {/* Select Checkbox — top-left corner over icon area */}
      {isSelectMode && (
        <div className="absolute top-2.5 left-2.5 z-20">
          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors duration-150 shadow-md ${
            isSelected
              ? 'bg-yellow-400 border-yellow-400 text-[#1c1d21] scale-105'
              : 'border-white/70 bg-black/60 hover:border-white'
          }`}>
            {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
          </div>
        </div>
      )}

      {/*
        Icon area — flex-1 fills remaining space after footer.
        Total card = aspect-square → icon area becomes a short rectangle.
        Layout: flex-col with a fixed 12px top spacer, then icon centered
        in the remaining space. 12px is always ≥5% of icon area height
        at any viewport size.
      */}
      <div className="relative flex-1 min-h-0 bg-yellow-500/[0.07] overflow-hidden flex flex-col items-center rounded-t-[24px] border-b border-yellow-500/10 group-hover:bg-yellow-500/[0.12] transition-colors duration-200">
        {/* Hard spacer — icon top edge is always ≥12px from container top */}
        <div className="h-3 w-full flex-shrink-0" />
        {/* Remaining space: icon centered inside */}
        <div className="flex-1 flex items-center justify-center">
          <Folder className="w-[104px] h-[104px] text-yellow-400 fill-yellow-400/20 group-hover:scale-110 transition-transform duration-300 drop-shadow-sm" />
        </div>
      </div>

      {/* Footer — fixed height, takes the bottom slice of the square card */}
      <div className="px-3.5 py-3.5 bg-[#202124] rounded-b-[24px] flex items-center gap-2">
        <h3
          className="text-xs font-semibold text-gray-200 group-hover:text-yellow-300 truncate min-w-0 flex-1"
          title={folder.name}
        >
          {folder.name}
        </h3>

        {!isSelectMode && (
          <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-yellow-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        )}
      </div>
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
          <Folder className="w-4 h-4 text-yellow-400 fill-yellow-400/20" /> Thư Mục{' '}
          <span className="text-xs font-mono text-gray-500">
            (<RollingNumber value={countDisplay} />)
          </span>
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
              <Check
                className={`w-3.5 h-3.5 stroke-[2.5] transition-all ${
                  isAllSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-0 group-hover:opacity-60'
                }`}
              />
            </button>
            <div className="pointer-events-none absolute right-0 top-full mt-1.5 hidden group-hover:flex items-center whitespace-nowrap rounded-lg bg-[#18191c] px-2.5 py-1 text-[11px] font-medium text-gray-200 shadow-xl border border-[#383c42] z-30 animate-fade-in">
              {isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </div>
          </div>
        )}
      </div>

      {/* Same column count as PictureGrid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
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
