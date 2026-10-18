import { memo } from 'react';
import { LightboxModal, VideoPlayerModal, MediaInfoModal } from '../components/layout/ViewerLayout';
import { useViewerContext } from '../contexts/ViewerContext';

/**
 * ViewerLayout — Area 9: Media Viewers & Player Modals
 * Encapsulates full-screen picture lightbox, video player modal, and media info inspector.
 */
export const ViewerLayout = memo(({
  // Lightbox
  lightbox: propLightbox,
  onCloseLightbox: propOnCloseLightbox,
  onSelectLightboxIndex: propOnSelectLightboxIndex,
  hasMore: propHasMore,
  isLoadingMore: propIsLoadingMore,
  onLoadMore: propOnLoadMore,

  // Video Player
  videoModalIndex: propVideoModalIndex,
  videos: propVideos,
  onCloseVideoModal: propOnCloseVideoModal,
  onSelectVideoIndex: propOnSelectVideoIndex,

  // Media Info
  infoModalData: propInfoModalData,
  onCloseInfoModal: propOnCloseInfoModal,
} = {}) => {
  const context = useViewerContext();

  const lightbox = propLightbox !== undefined ? propLightbox : context.lightbox;
  const onCloseLightbox = propOnCloseLightbox || context.onCloseLightbox;
  const onSelectLightboxIndex = propOnSelectLightboxIndex || context.onSelectLightboxIndex;
  const hasMore = propHasMore !== undefined ? propHasMore : context.hasMore;
  const isLoadingMore = propIsLoadingMore !== undefined ? propIsLoadingMore : context.isLoadingMore;
  const onLoadMore = propOnLoadMore || context.onLoadMore;

  const videoModalIndex = propVideoModalIndex !== undefined ? propVideoModalIndex : context.videoModalIndex;
  const videos = propVideos || context.videos;
  const onCloseVideoModal = propOnCloseVideoModal || context.onCloseVideoModal;
  const onSelectVideoIndex = propOnSelectVideoIndex || context.onSelectVideoIndex;

  const infoModalData = propInfoModalData !== undefined ? propInfoModalData : context.infoModalData;
  const onCloseInfoModal = propOnCloseInfoModal || context.onCloseInfoModal;
  return (
    <>
      {/* Lightbox Modal */}
      <LightboxModal
        pictures={lightbox?.pictures}
        currentIndex={lightbox?.index}
        onClose={onCloseLightbox}
        onSelectIndex={onSelectLightboxIndex}
        totalPictures={lightbox?.pictures?.length}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={onLoadMore}
      />

      {/* Video Player Modal */}
      <VideoPlayerModal
        videos={videos}
        currentIndex={videoModalIndex}
        onClose={onCloseVideoModal}
        onSelectIndex={onSelectVideoIndex}
      />

      {/* Media Info Dialog Modal */}
      <MediaInfoModal
        isOpen={infoModalData?.isOpen}
        onClose={onCloseInfoModal}
        item={infoModalData?.item}
        type={infoModalData?.type}
      />
    </>
  );
});

ViewerLayout.displayName = 'ViewerLayout';
