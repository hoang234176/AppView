import { memo } from 'react';
import { FolderX } from 'lucide-react';
import { useContentStatus } from '../../../../hooks/content';
import './EmptyState.css';

/**
 * EmptyState — Feedback state displayed when current folder or search has no items
 */
export const EmptyState = memo(({
  searchQuery: propSearchQuery,
  onClearSearch: propOnClearSearch,
}) => {
  const hookData = useContentStatus();
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : hookData.searchQuery;
  const onClearSearch = propOnClearSearch || hookData.onClearSearch;

  return (
    <div className="content-empty-state-wrapper animate-fade-in space-y-4">
      <div className="content-empty-state-icon">
        <FolderX className="w-7 h-7" />
      </div>
      <div>
        <h3 className="content-empty-state-title text-base font-semibold text-white">Thư mục này trống</h3>
        <p className="content-empty-state-desc text-xs text-gray-400 mt-1">
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
  );
});

EmptyState.displayName = 'EmptyState';
