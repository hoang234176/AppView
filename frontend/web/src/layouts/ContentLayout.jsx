import { memo } from 'react';
import {
  Breadcrumbs,
  FolderGrid,
  VideoGrid,
  PictureGrid,
  LoadingSkeleton,
  ErrorState,
  EmptyState,
  ContentLoadMore,
} from '../components/layout/ContentLayout';
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
          <EmptyState
            searchQuery={searchQuery}
            onClearSearch={onClearSearch}
          />
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

            <ContentLoadMore
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              remainingCount={remainingCount}
              onLoadMore={onLoadMore}
            />
          </div>
        )}
      </main>
    </div>
  );
});

ContentLayout.displayName = 'ContentLayout';
