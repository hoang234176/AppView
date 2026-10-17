import { memo } from 'react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { FolderGrid } from '../components/FolderGrid';
import { VideoGrid } from '../components/VideoGrid';
import { PictureGrid } from '../components/PictureGrid';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { FolderX, Loader2 } from 'lucide-react';
import './ContentLayout.css';

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
    <div className="content-canvas">
      {/* Breadcrumbs Navigation */}
      <div className="content-breadcrumbs-bar">
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
        className="content-scroll-body custom-scrollbar"
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
          <div className="content-empty-state animate-fade-in space-y-4">
            <div className="content-empty-icon">
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
          <div className="content-grids animate-fade-in">
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
                  className="content-load-more-btn"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span>Đang tải thêm...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm">Xem thêm</span>
                      <span className="content-load-more-badge">
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
