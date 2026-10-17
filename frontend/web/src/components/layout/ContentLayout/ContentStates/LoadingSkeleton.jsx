import { memo } from 'react';
import './LoadingSkeleton.css';

/**
 * LoadingSkeleton — Placeholder shimmer loading state for folders and media cards
 */
export const LoadingSkeleton = memo(() => {
  return (
    <div className="loading-skeleton-container animate-fade-in">
      {/* Folder Skeleton */}
      <div className="loading-skeleton-section">
        <div className="loading-skeleton-title skeleton" />
        <div className="loading-skeleton-folders-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="loading-skeleton-folder-card skeleton" />
          ))}
        </div>
      </div>

      {/* Picture Skeleton */}
      <div className="loading-skeleton-section">
        <div className="loading-skeleton-title skeleton" />
        <div className="loading-skeleton-pictures-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="loading-skeleton-picture-card skeleton" />
          ))}
        </div>
      </div>
    </div>
  );
});

LoadingSkeleton.displayName = 'LoadingSkeleton';
