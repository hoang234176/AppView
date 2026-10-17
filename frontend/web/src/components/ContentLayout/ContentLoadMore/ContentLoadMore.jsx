import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import './ContentLoadMore.css';

/**
 * ContentLoadMore — Pagination button with remaining item counter and loading spinner
 */
export const ContentLoadMore = memo(({
  hasMore,
  isLoadingMore,
  remainingCount,
  onLoadMore,
}) => {
  if (!hasMore) return null;

  return (
    <div className="content-load-more-wrapper flex justify-center pt-2 pb-4">
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
  );
});

ContentLoadMore.displayName = 'ContentLoadMore';
