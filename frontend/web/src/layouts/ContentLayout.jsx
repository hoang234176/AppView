import React, { memo } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { FolderGrid } from '../components/FolderGrid';
import { VideoGrid } from '../components/VideoGrid';
import { PictureGrid } from '../components/PictureGrid';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { FolderX, Loader2 } from 'lucide-react';

/**
 * ContentLayout — Area 3: Main Content Canvas
 * Houses Breadcrumbs navigation, Empty/Loading/Error states,
 * Folder/Video/Picture Grids, and Load More pagination.
 */
export const ContentLayout = memo(({
  currentPath,
  onNavigate,
  totalFolders,
  totalPictures,
  totalVideos,
  activeDrive,
  onEmptyContextMenu,
  loading,
  errorInfo,
  onRetry,
  hasContent,
  searchQuery,
  onClearSearch,
  visibleFolders,
  visibleVideos,
  visiblePictures,
  isSelectMode,
  selectedItems,
  onToggleSelectItem,
  onToggleSelectAllFolders,
  onToggleSelectAllVideos,
  onToggleSelectAllPictures,
  onFolderContextMenu,
  onOpenVideo,
  onOpenLightbox,
  onShowMediaInfo,
  onCopySingleItem,
  onOpenMoveItem,
  onDeleteMediaItem,
  hasMore,
  isLoadingMore,
  remainingCount,
  onLoadMore,
}) => {
  return (
    <div className="tahoe-block flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Breadcrumbs Navigation */}
      <div className="flex-shrink-0 bg-[#1c1d21] border-b border-[#383c42]/40 z-10">
        <Breadcrumbs
          currentPath={currentPath}
          onNavigate={onNavigate}
          totalFolders={totalFolders}
          totalPictures={totalPictures}
          totalVideos={totalVideos}
          activeDrive={activeDrive}
        />
      </div>

      {/* Scrollable Content Body */}
      <main
        onContextMenu={onEmptyContextMenu}
        className="flex-1 overflow-y-auto custom-scrollbar p-2 pb-4 min-h-0"
      >
        {loading ? (
          <LoadingSkeleton />
        ) : errorInfo ? (
          <ErrorState
            errorInfo={errorInfo}
            onRetry={onRetry}
          />
        ) : !hasContent ? (
          /* Empty state */
          <div className="max-w-md mx-auto my-16 p-8 text-center bg-[#28292d] rounded-[24px] border border-[#383c42] animate-fade-in space-y-4 shadow-md">
            <div className="w-14 h-14 rounded-[24px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
              <FolderX className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Thư mục này trống</h3>
              <p className="text-xs text-gray-400 mt-1">
                {searchQuery
                  ? `Không tìm thấy mục khớp với "${searchQuery}"`
                  : 'Chưa có thư mục con, hình ảnh hoặc video nào tại đường dẫn này.'}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={onClearSearch}
                className="btn-google btn-google-surface text-xs mt-2"
              >
                Xóa bộ lọc tìm kiếm
              </button>
            )}
          </div>
        ) : (
          /* Folders, Pictures, and Videos Grid */
          <div className="animate-fade-in space-y-6 pt-2">
            <FolderGrid
              folders={visibleFolders}
              totalCount={totalFolders}
              onNavigate={onNavigate}
              onFolderContextMenu={onFolderContextMenu}
              isSelectMode={isSelectMode}
              selectedItems={selectedItems}
              onToggleSelect={onToggleSelectItem}
              onToggleSelectAll={onToggleSelectAllFolders}
            />

            <VideoGrid
              videos={visibleVideos}
              totalCount={totalVideos}
              onOpenVideo={onOpenVideo}
              onShowInfo={onShowMediaInfo}
              onCopyItem={(vid) => onCopySingleItem(vid, 'video')}
              onMoveItem={(vid) => onOpenMoveItem(vid, 'video')}
              onDeleteItem={onDeleteMediaItem}
              isSelectMode={isSelectMode}
              selectedItems={selectedItems}
              onToggleSelect={onToggleSelectItem}
              onToggleSelectAll={onToggleSelectAllVideos}
            />

            <PictureGrid
              pictures={visiblePictures}
              totalCount={totalPictures}
              onOpenLightbox={onOpenLightbox}
              onShowInfo={onShowMediaInfo}
              onCopyItem={(pic) => onCopySingleItem(pic, 'picture')}
              onMoveItem={(pic) => onOpenMoveItem(pic, 'picture')}
              onDeleteItem={onDeleteMediaItem}
              isSelectMode={isSelectMode}
              selectedItems={selectedItems}
              onToggleSelect={onToggleSelectItem}
              onToggleSelectAll={onToggleSelectAllPictures}
            />

            {hasMore && (
              <div className="flex justify-center pt-2 pb-4">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="bg-[#202124] hover:bg-[#2d2f31] text-[#8ab4f8] border border-[#383c42] hover:border-[#8ab4f8] px-8 py-3 rounded-full text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2.5 hover:scale-105 active:scale-95 disabled:opacity-60"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span>Đang tải thêm...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm">Xem thêm</span>
                      <span className="text-[11px] font-mono bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                        +{remainingCount} mục
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
});

ContentLayout.displayName = 'ContentLayout';
