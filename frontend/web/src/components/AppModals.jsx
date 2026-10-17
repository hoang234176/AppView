import { memo } from 'react';
import { LightboxModal } from './LightboxModal';
import { VideoPlayerModal } from './VideoPlayerModal';
import { MobileNav } from './MobileNav';
import { RenameFolderModal } from './RenameFolderModal';
import { MediaInfoModal } from './MediaInfoModal';
import { BatchActionModal } from './BatchActionModal';

/**
 * AppModals — Encapsulates dialogs, modals, and global alerts
 * Keeps App.jsx clean and decoupled from modal rendering details.
 */
export const AppModals = memo(({
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

  // Mobile Navigation
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  currentPath,
  treeData,
  folders,
  onNavigate,
  onOpenConfig,
  drives,
  activeDrive,
  onSelectDrive,

  // Rename Folder Modal
  showRenameFolderModal,
  onCloseRenameFolderModal,
  targetFolder,
  onRenameFolderSubmit,

  // Media Info
  infoModalData,
  onCloseInfoModal,

  // Batch Action Modal
  batchModalState,
  onCloseBatchModal,
  selectedItems,
  onConfirmBatch,
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

      {/* Mobile Navigation Drawer */}
      <MobileNav
        isOpen={isMobileDrawerOpen}
        onClose={onCloseMobileDrawer}
        currentPath={currentPath}
        treeData={treeData}
        folders={folders}
        onNavigate={onNavigate}
        onOpenConfig={onOpenConfig}
        drives={drives}
        activeDrive={activeDrive}
        onSelectDrive={onSelectDrive}
      />

      {/* Rename Folder Dialog Modal */}
      <RenameFolderModal
        isOpen={showRenameFolderModal}
        onClose={onCloseRenameFolderModal}
        folder={targetFolder}
        onRename={onRenameFolderSubmit}
      />

      {/* Media Info Dialog Modal */}
      <MediaInfoModal
        isOpen={infoModalData.isOpen}
        onClose={onCloseInfoModal}
        item={infoModalData.item}
        type={infoModalData.type}
      />

      {/* Batch Action Modal for Select Mode & Single Item Actions */}
      <BatchActionModal
        isOpen={batchModalState.isOpen}
        action={batchModalState.action}
        onClose={onCloseBatchModal}
        items={
          batchModalState.items && batchModalState.items.length > 0
            ? batchModalState.items
            : Array.from(selectedItems.values())
        }
        treeData={treeData}
        currentPath={currentPath}
        drives={drives}
        activeDrive={activeDrive}
        onConfirm={onConfirmBatch}
      />
    </>
  );
});

AppModals.displayName = 'AppModals';
