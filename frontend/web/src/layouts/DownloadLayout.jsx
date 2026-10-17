import { memo } from 'react';
import { DownloadMediaModal } from '../components/DownloadMediaModal';
import { DownloadMediafireModal } from '../components/DownloadMediafireModal';
import { DownloadPanelModal } from '../components/DownloadPanelModal';
import { DownloadSnackbar } from '../components/DownloadSnackbar';
import './DownloadLayout.css';

/**
 * DownloadLayout — Area 6: Download Management & Notification Layout
 * Encapsulates the social media download modal, mediafire archive download modal,
 * download manager panel, and background progress snackbar.
 */
export const DownloadLayout = memo(({
  // Download Media Modal (Facebook, YouTube, TikTok, Instagram, X)
  showDownloadMediaModal,
  onCloseDownloadMediaModal,
  currentPath,
  treeData,
  activeDrive,
  downloadTasks,
  onCoordinatorJobCreated,
  onOpenSettings,

  // Download Mediafire Modal
  showDownloadMediafireModal,
  onCloseDownloadMediafireModal,
  onDownloadMediafireSuccess,

  // Download Manager Panel Modal
  showDownloadPanel,
  onCloseDownloadPanel,
  downloadPanelTab,
  onSelectedTabChange,
  onOpenAddModal,
  onDeleteTask,

  // Download & Transfer Snackbar
  transferTasks,
  downloadSummary,
  onOpenDownloadPanel,
}) => {
  return (
    <>
      {/* Download Media (Instagram, Facebook, TikTok, YouTube) Modal */}
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
    </>
  );
});

DownloadLayout.displayName = 'DownloadLayout';
