import React from 'react';

export const LoadingSkeleton = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-8 py-4 space-y-10 animate-fade-in">
      {/* Folder Skeleton */}
      <div className="space-y-4">
        <div className="h-5 w-32 skeleton rounded-md"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 skeleton rounded-2xl"></div>
          ))}
        </div>
      </div>

      {/* Picture Skeleton */}
      <div className="space-y-4">
        <div className="h-5 w-32 skeleton rounded-md"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-56 skeleton rounded-2xl"></div>
          ))}
        </div>
      </div>
    </div>
  );
};
