import { useCallback } from 'react';
import { useContentContext } from '../../contexts/ContentContext';

export function useContentPictureGrid() {
  const {
    visiblePictures = [],
    totalPictures = 0,
    onOpenLightbox,
    onShowMediaInfo,
    onCopySingleItem,
    onOpenMoveItem,
    onDeleteMediaItem,
    isSelectMode = false,
    selectedItems = new Map(),
    onToggleSelectItem,
    onToggleSelectAllPictures,
  } = useContentContext();

  const onCopyItem = useCallback((pic) => {
    if (onCopySingleItem) {
      onCopySingleItem(pic, 'picture');
    }
  }, [onCopySingleItem]);

  const onMoveItem = useCallback((pic) => {
    if (onOpenMoveItem) {
      onOpenMoveItem(pic, 'picture');
    }
  }, [onOpenMoveItem]);

  return {
    pictures: visiblePictures,
    totalCount: totalPictures,
    onOpenLightbox,
    onShowInfo: onShowMediaInfo,
    onCopyItem,
    onMoveItem,
    onDeleteItem: onDeleteMediaItem,
    isSelectMode,
    selectedItems,
    onToggleSelect: onToggleSelectItem,
    onToggleSelectAll: onToggleSelectAllPictures,
  };
}
