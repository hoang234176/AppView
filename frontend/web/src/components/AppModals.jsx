import React, { memo } from 'react';
import { LightboxModal } from './LightboxModal';
import { VideoPlayerModal } from './VideoPlayerModal';
import { MobileNav } from './MobileNav';
import { ContextMenu } from './ContextMenu';
import { DeleteModal } from './DeleteModal';
import { CreateFolderModal } from './CreateFolderModal';
import { RenameFolderModal } from './RenameFolderModal';
import { DownloadMediaModal } from './DownloadMediaModal';
import { DownloadMediafireModal } from './DownloadMediafireModal';
import { DownloadPanelModal } from './DownloadPanelModal';
import { DownloadSnackbar } from './DownloadSnackbar';
import { SettingsModal } from './SettingsModal';
import { MediaInfoModal } from './MediaInfoModal';
import { BatchActionModal } from './BatchActionModal';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { CheckCircle2 } from 'lucide-react';

/**
 * AppModals — Encapsulates dialogs, modals, context menus, and global alerts
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

  // Context Menu
  contextMenu,
  onCloseContextMenu,
  onCreateFolder,
  onRenameFolder,
  onCopyFolder,
  onMoveFolder,
  onDeleteFolder,
  onRefresh,

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

  // Download Modals & Panel
  showDownloadMediaModal,
  onCloseDownloadMediaModal,
  downloadTasks,
  onCoordinatorJobCreated,
  showDownloadMediafireModal,
  onCloseDownloadMediafireModal,
  onDownloadMediafireSuccess,
  showDownloadPanel,
  onCloseDownloadPanel,
  downloadPanelTab,
  onSelectedTabChange,
  onOpenAddModal,
  onDeleteTask,
  transferTasks,
  downloadSummary,
  onOpenDownloadPanel,

  // Disconnection & Settings
  isConnected,
  showConfigModal,
  setShowConfigModal,
  onCloseConfigModal,
  onServerConfigSaved,
  onServerConfigFailed,

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

      {/* Custom Context Menu */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isOpen={contextMenu.isOpen}
        onClose={onCloseContextMenu}
        mode={contextMenu.mode}
        targetFolder={contextMenu.folder}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onCopyFolder={onCopyFolder}
        onMoveFolder={onMoveFolder}
        onDeleteFolder={onDeleteFolder}
        onRefresh={onRefresh}
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

      {/* Download Media (Instagram, Facebook, TikTok, YouTube) Modal */}
      {showDownloadMediaModal && (
        <DownloadMediaModal
          currentPath={currentPath}
          treeData={treeData}
          activeDrive={activeDrive}
          downloadTasks={downloadTasks}
          onClose={onCloseDownloadMediaModal}
          onSuccess={onCoordinatorJobCreated}
          onOpenSettings={() => setShowConfigModal(true)}
        />
      )}

      {/* Download Mediafire Archive Modal */}
      <DownloadMediafireModal
        isOpen={showDownloadMediafireModal}
        onClose={onCloseDownloadMediafireModal}
        currentPath={currentPath}
        treeData={treeData}
        activeDrive={activeDrive}
        onSuccess={onDownloadMediafireSuccess}
      />

      {/* Download Manager Panel Modal */}
      <DownloadPanelModal
        isOpen={showDownloadPanel}
        onClose={onCloseDownloadPanel}
        tasks={downloadTasks}
        selectedTab={downloadPanelTab}
        onSelectedTabChange={onSelectedTabChange}
        onOpenAddModal={onOpenAddModal}
        onDeleteTask={onDeleteTask}
      />

      {/* Compact Bottom Snackbar */}
      <DownloadSnackbar
        tasks={downloadTasks}
        transferTasks={transferTasks}
        summary={downloadSummary}
        onOpenPanel={onOpenDownloadPanel}
      />

      {/* A failed health check invalidates every server-backed surface */}
      {!isConnected && !showConfigModal && (
        <div
          className="fixed inset-0 z-[99990] flex items-center justify-center bg-[#1c1d21]/75 p-6 backdrop-brightness-75"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-sm rounded-2xl border border-red-500/35 bg-[#202124] p-5 text-center shadow-2xl">
            <h2 className="text-sm font-bold text-white">Chưa kết nối máy chủ</h2>
            <p className="mt-2 text-xs text-gray-400">
              Cần kết nối Coordinator hợp lệ trước khi duyệt thư mục, mở media hoặc tải xuống.
            </p>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
            >
              Mở cài đặt kết nối
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showConfigModal}
        onClose={onCloseConfigModal}
        onRefreshFolder={onRefresh}
        onServerConfigSaved={onServerConfigSaved}
        onServerConfigFailed={onServerConfigFailed}
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
