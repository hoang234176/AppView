import { memo } from 'react';
import { LightboxModal } from './LightboxModal';
import { VideoPlayerModal } from './VideoPlayerModal';
import { MobileNav } from './MobileNav';
import { DeleteModal } from './DeleteModal';
import { CreateFolderModal } from './CreateFolderModal';
import { RenameFolderModal } from './RenameFolderModal';
import { MediaInfoModal } from './MediaInfoModal';
import { BatchActionModal } from './BatchActionModal';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { CheckCircle2 } from 'lucide-react';

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

  // Delete Modal
  deleteModalData,
  onCloseDeleteModal,
  onDeleteSuccess,

  // Create & Rename Folder Modals
  showCreateFolderModal,
  onCloseCreateFolderModal,
  onCreateFolderSubmit,
  showRenameFolderModal,
  onCloseRenameFolderModal,
  targetFolder,
  onRenameFolderSubmit,

  // Media Info
  infoModalData,
  onCloseInfoModal,

  // Batch & Conflict
  batchModalState,
  onCloseBatchModal,
  selectedItems,
  onConfirmBatch,
  conflictModalData,
  onResolveConflicts,
  onCloseConflictModal,

  // Toast
  toastMessage,
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

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={deleteModalData.isOpen}
        onClose={onCloseDeleteModal}
        targetItem={deleteModalData.item}
        isFolder={deleteModalData.isFolder}
        onSuccess={onDeleteSuccess}
      />

      {/* Create Folder Dialog Modal */}
      <CreateFolderModal
        isOpen={showCreateFolderModal}
        onClose={onCloseCreateFolderModal}
        onCreate={onCreateFolderSubmit}
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

      {/* Conflict Resolution Modal with Side-by-Side Thumbnail Comparison */}
      <ConflictResolutionModal
        isOpen={conflictModalData.isOpen}
        conflicts={conflictModalData.conflicts}
        action={conflictModalData.action}
        onResolve={onResolveConflicts}
        onClose={onCloseConflictModal}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[999999] flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#1c1d21] border border-blue-500/40 text-white text-xs font-semibold shadow-2xl animate-pop-fast">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
});

AppModals.displayName = 'AppModals';
