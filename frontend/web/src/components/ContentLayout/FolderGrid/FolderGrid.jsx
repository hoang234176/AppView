import { memo, useState } from 'react';
import { Folder, ArrowRight, Check, Image as ImageIcon, Film } from 'lucide-react';
import { WindowsFolderIcon } from '../../icons/WindowsFolderIcon';
import { RollingNumber } from '../../common/RollingNumber';
import { useVirtualGrid } from '../../../utils/useVirtualGrid';
import './FolderGrid.css';

const FolderCard = memo(({
  folder,
  isSelected,
  isSelectMode,
  onToggleSelect,
  onNavigate,
  onFolderContextMenu,
}) => {
  const [isCardHovered, setIsCardHovered] = useState(false);

  const pictureCount = folder.picture_count ?? folder.pictureCount ?? 0;
  const videoCount = folder.video_count ?? folder.videoCount ?? 0;
  const hasCounts = pictureCount > 0 || videoCount > 0;

  const tooltipTitle = hasCounts
    ? `${folder.name} (${[
        pictureCount > 0 ? `${pictureCount} ảnh` : '',
        videoCount > 0 ? `${videoCount} video` : '',
      ]
        .filter(Boolean)
        .join(', ')})`
    : folder.name;

  return (
    <div
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
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
      className={`folder-card group relative flex flex-col hover:-translate-y-1 aspect-square ${
        isSelected
          ? 'folder-card-selected'
          : 'border-[#383c42] hover:border-yellow-400/70'
      }`}
    >
      {/* Select Checkbox — top-left corner over icon area */}
      {isSelectMode && (
        <div className="folder-card-checkbox">
          <div className={`folder-card-checkbox-box ${
            isSelected
              ? 'bg-yellow-400 border-yellow-400 text-[#1c1d21] scale-105'
              : 'border-white/70 bg-black/60 hover:border-white'
          }`}>
            {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
          </div>
        </div>
      )}

      {/* Media Count Badges — top-right corner stacked vertically */}
      {hasCounts && (
        <div className="folder-card-counts">
          {pictureCount > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-medium text-blue-300 shadow-sm">
              <ImageIcon className="w-2.5 h-2.5 stroke-[2.5]" />
              {pictureCount}
            </span>
          )}
          {videoCount > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-medium text-rose-300 shadow-sm">
              <Film className="w-2.5 h-2.5 stroke-[2.5]" />
              {videoCount}
            </span>
          )}
        </div>
      )}

      {/* Icon area */}
      <div className="folder-card-icon-area">
        {/* Hard spacer — icon top edge is always ≥12px from container top */}
        <div className="h-3 w-full flex-shrink-0" />
        {/* Remaining space: icon centered inside */}
        <div className="flex-1 flex items-center justify-center">
          <WindowsFolderIcon
            previews={folder.previews || []}
            size={102}
            mode="adaptive"
            isHovered={isCardHovered}
          />
        </div>
      </div>

      {/* Footer — fixed height, takes the bottom slice of the square card */}
      <div className="folder-card-footer">
        <h3
          className="text-xs font-semibold text-gray-200 group-hover:text-yellow-300 truncate min-w-0 flex-1"
          title={tooltipTitle}
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

export const FolderGrid = memo(({
  folders = [],
  totalCount,
  onNavigate,
  onFolderContextMenu,
  isSelectMode = false,
  selectedItems = new Map(),
  onToggleSelect,
  onToggleSelectAll,
}) => {
  const folderCount = folders ? folders.length : 0;
  const {
    containerRef,
    cols,
    rowHeight,
    totalHeight,
    visibleRowIndices,
    isVirtualized,
  } = useVirtualGrid({ totalItems: folderCount, type: 'folder' });

  if (!folders || folders.length === 0) return null;

  const countDisplay = totalCount && totalCount > folders.length ? `${folders.length}/${totalCount}` : folders.length;
  const isAllSelected = folders.length > 0 && folders.every((f) => selectedItems.has(`folder:${f.path}`));

  return (
    <section className="folder-grid-section">
      <div className="folder-grid-header">
        <h2 className="folder-grid-title">
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
              className={`folder-grid-select-all-btn ${
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

      {/* If virtualized: absolute row positioning (zero layout shifts). Otherwise: standard CSS grid */}
      {isVirtualized ? (
        <div
          ref={containerRef}
          className="relative w-full"
          style={{ height: `${totalHeight}px` }}
        >
          {visibleRowIndices.map((rowIndex) => {
            const rowTop = rowIndex * rowHeight;
            const rowItems = folders.slice(rowIndex * cols, (rowIndex + 1) * cols);

            return (
              <div
                key={rowIndex}
                className="absolute left-0 right-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5"
                style={{ top: `${rowTop}px` }}
              >
                {rowItems.map((folder, colIdx) => {
                  const idx = rowIndex * cols + colIdx;
                  return (
                    <FolderCard
                      key={folder.path || idx}
                      folder={folder}
                      isSelected={Boolean(selectedItems.has(`folder:${folder.path}`))}
                      isSelectMode={isSelectMode}
                      onToggleSelect={onToggleSelect}
                      onNavigate={onNavigate}
                      onFolderContextMenu={onFolderContextMenu}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5"
        >
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
      )}
    </section>
  );
});

FolderGrid.displayName = 'FolderGrid';
