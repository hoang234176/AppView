import { useCallback } from 'react';
import { useContentContext } from '../../contexts/ContentContext';

export function useContentVideoGrid() {
  const {
    visibleVideos = [],
    totalVideos = 0,
    onOpenVideo,
    onShowMediaInfo,
    onCopySingleItem,
    onOpenMoveItem,
    onDeleteMediaItem,
    isSelectMode = false,
    selectedItems = new Map(),
    onToggleSelectItem,
    onToggleSelectAllVideos,
  } = useContentContext();

  const onCopyItem = useCallback((vid) => {
    if (onCopySingleItem) {
      onCopySingleItem(vid, 'video');
    }
  }, [onCopySingleItem]);

  const onMoveItem = useCallback((vid) => {
    if (onOpenMoveItem) {
      onOpenMoveItem(vid, 'video');
    }
  }, [onOpenMoveItem]);

  return {
    videos: visibleVideos,
    totalCount: totalVideos,
    onOpenVideo,
    onShowInfo: onShowMediaInfo,
    onCopyItem,
    onMoveItem,
    onDeleteItem: onDeleteMediaItem,
    isSelectMode,
    selectedItems,
    onToggleSelect: onToggleSelectItem,
    onToggleSelectAll: onToggleSelectAllVideos,
  };
}
