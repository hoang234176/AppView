import { useViewerContext } from '../../contexts/ViewerContext';

/**
 * useVideoPlayerModal — Hook for VideoPlayerModal
 * Extracts video playlist, active video index, and selection callbacks
 */
export function useVideoPlayerModal() {
  const {
    videoModalIndex,
    videos = [],
    onCloseVideoModal,
    onSelectVideoIndex,
  } = useViewerContext();

  return {
    isOpen: videoModalIndex !== null && videoModalIndex !== undefined,
    videos,
    currentIndex: videoModalIndex ?? 0,
    onClose: onCloseVideoModal,
    onSelectIndex: onSelectVideoIndex,
  };
}
