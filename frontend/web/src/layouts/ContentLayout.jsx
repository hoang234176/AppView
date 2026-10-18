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
import { useContentStatus } from '../hooks/content';
import './ContentLayout.css';

/**
 * ContentLayout — Area 3: Main Content Canvas
 * Houses Breadcrumbs navigation, Empty/Loading/Error states,
 * Folder/Video/Picture Grids, and Load More pagination.
 */
export const ContentLayout = memo(() => {
  const { loading, errorInfo, hasContent, onEmptyContextMenu } = useContentStatus();

  return (
    <div className="content-canvas">
      {/* Breadcrumbs Navigation */}
      <div className="content-breadcrumbs-bar">
        <Breadcrumbs />
      </div>

      {/* Scrollable Content Body */}
      <main
        onContextMenu={onEmptyContextMenu}
        className="content-scroll-body custom-scrollbar"
      >
        {loading ? (
          <LoadingSkeleton />
        ) : errorInfo ? (
          <ErrorState />
        ) : !hasContent ? (
          <EmptyState />
        ) : (
          <div className="content-grids animate-fade-in">
            <FolderGrid />
            <VideoGrid />
            <PictureGrid />
            <ContentLoadMore />
          </div>
        )}
      </main>
    </div>
  );
});

ContentLayout.displayName = 'ContentLayout';
