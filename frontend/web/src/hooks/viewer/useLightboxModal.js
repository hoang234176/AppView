import { useViewerContext } from '../../contexts/ViewerContext';

/**
 * useLightboxModal — Hook for LightboxModal
 * Extracts lightbox state, pictures, pagination, and navigation callbacks
 */
export function useLightboxModal() {
  const {
    lightbox,
    onCloseLightbox,
    onSelectLightboxIndex,
    hasMore = false,
    isLoadingMore = false,
    onLoadMore,
  } = useViewerContext();

  return {
    isOpen: lightbox !== null && lightbox !== undefined,
    pictures: lightbox?.pictures || [],
    currentIndex: lightbox?.index ?? 0,
    totalPictures: lightbox?.pictures?.length || 0,
    onClose: onCloseLightbox,
    onSelectIndex: onSelectLightboxIndex,
    hasMore,
    isLoadingMore,
    onLoadMore,
  };
}
