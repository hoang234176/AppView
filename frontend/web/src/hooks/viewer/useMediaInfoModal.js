import { useViewerContext } from '../../contexts/ViewerContext';

/**
 * useMediaInfoModal — Hook for MediaInfoModal
 * Extracts media item, media type, and modal state
 */
export function useMediaInfoModal() {
  const {
    infoModalData,
    onCloseInfoModal,
  } = useViewerContext();

  return {
    isOpen: infoModalData?.isOpen || false,
    item: infoModalData?.item || null,
    type: infoModalData?.type || 'picture',
    onClose: onCloseInfoModal,
  };
}
