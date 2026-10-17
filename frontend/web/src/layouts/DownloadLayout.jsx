import { memo } from 'react';
import {
  DownloadPanelModal,
  DownloadSnackbar,
} from '../components/layout/DownloadLayout';
import './DownloadLayout.css';

/**
 * DownloadLayout — Area 6: Download Management & Notification Layout
 * Encapsulates the download manager panel and background progress snackbar.
 */
export const DownloadLayout = memo(({
  // Download Manager Panel Modal
  showDownloadPanel,
  onCloseDownloadPanel,
  downloadTasks,
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
