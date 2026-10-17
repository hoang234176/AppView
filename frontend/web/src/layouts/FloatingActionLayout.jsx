import { memo } from 'react';
import {
  FabSpeedDial,
  CreateFolderModal,
  DownloadMediafireModal,
  DownloadMediaModal,
} from '../components/layout/FloatingActionLayout';
import './FloatingActionLayout.css';

/**
 * FloatingActionLayout — Area 4: Floating Action Button & Expanded Modals
 * Encapsulates the '+' SpeedDial button and its 3 expanded action modals:
 * 1. CreateFolderModal (Option 1: Tạo thư mục)
 * 2. DownloadMediafireModal (Option 2: Tải file nén MediaFire)
 * 3. DownloadMediaModal (Option 3: Tải ảnh/video mạng xã hội)
 */
export const FloatingActionLayout = memo(({
  // Fab SpeedDial Button Triggers
  onCreateFolder,
  onDownloadArchive,
  onDownloadMedia,

  // Option 1: Create Folder Modal
  showCreateFolderModal,
  onCloseCreateFolderModal,
  onCreateFolderSubmit,

  // Option 2: Download Mediafire Modal
  showDownloadMediafireModal,
  onCloseDownloadMediafireModal,
  onDownloadMediafireSuccess,

  // Option 3: Download Media Modal
  showDownloadMediaModal,
  onCloseDownloadMediaModal,
  downloadTasks,
  onCoordinatorJobCreated,
  onOpenSettings,

  // Shared Destination Context
  currentPath,
  treeData,
  activeDrive,
}) => {
  return (
    <>
      {/* '+' SpeedDial Button */}
      <FabSpeedDial
        onCreateFolder={onCreateFolder}
        onDownloadArchive={onDownloadArchive}
        onDownloadMedia={onDownloadMedia}
      />

      {/* Option 1: Create Folder Modal */}
      <CreateFolderModal
        isOpen={showCreateFolderModal}
        onClose={onCloseCreateFolderModal}
        onCreate={onCreateFolderSubmit}
      />

      {/* Option 2: Download Mediafire Modal */}
      <DownloadMediafireModal
        isOpen={showDownloadMediafireModal}
        onClose={onCloseDownloadMediafireModal}
        currentPath={currentPath}
        treeData={treeData}
        activeDrive={activeDrive}
        onSuccess={onDownloadMediafireSuccess}
      />

      {/* Option 3: Download Media Modal */}
      {showDownloadMediaModal && (
        <DownloadMediaModal
          currentPath={currentPath}
          treeData={treeData}
          activeDrive={activeDrive}
          downloadTasks={downloadTasks}
          onClose={onCloseDownloadMediaModal}
          onSuccess={onCoordinatorJobCreated}
          onOpenSettings={onOpenSettings}
        />
      )}
    </>
  );
});

FloatingActionLayout.displayName = 'FloatingActionLayout';
