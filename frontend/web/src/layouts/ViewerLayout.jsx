import { memo } from 'react';
import { LightboxModal, VideoPlayerModal, MediaInfoModal } from '../components/layout/ViewerLayout';

/**
 * ViewerLayout — Area 9: Media Viewers & Player Modals
 * Encapsulates full-screen picture lightbox, video player modal, and media info inspector.
 */
export const ViewerLayout = memo(({
  // Lightbox
  lightbox,
  onCloseLightbox,
  onSelectLightboxIndex,
  hasMore,
  isLoadingMore,
  onLoadMore,

  // Video Player
  videoModalIndex,
  videos,
  onCloseVideoModal,
  onSelectVideoIndex,

  // Media Info
  infoModalData,
  onCloseInfoModal,
}) => {
  return (
    <>
      {/* Lightbox Modal */}
      {lightbox !== null && (
        <LightboxModal
          pictures={lightbox.pictures}
          currentIndex={lightbox.index}
          onClose={onCloseLightbox}
          onSelectIndex={onSelectLightboxIndex}
          totalPictures={lightbox.pictures.length}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
        />
      )}

      {/* Video Player Modal */}
      {videoModalIndex !== null && (
        <VideoPlayerModal
          videos={videos}
          currentIndex={videoModalIndex}
          onClose={onCloseVideoModal}
          onSelectIndex={onSelectVideoIndex}
        />
      )}

      {/* Media Info Dialog Modal */}
      {infoModalData && (
        <MediaInfoModal
          isOpen={infoModalData.isOpen}
          onClose={onCloseInfoModal}
          item={infoModalData.item}
          type={infoModalData.type}
        />
      )}
    </>
  );
});

ViewerLayout.displayName = 'ViewerLayout';
