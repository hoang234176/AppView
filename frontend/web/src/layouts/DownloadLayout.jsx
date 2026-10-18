import { memo } from 'react';
import {
  DownloadPanelModal,
  DownloadSnackbar,
} from '../components/layout/DownloadLayout';
import { useDownloadContext } from '../contexts/DownloadContext';

/**
 * DownloadLayout — Area 6: Download Management & Notification Layout
 * Encapsulates the download manager panel and background progress snackbar.
 */
export const DownloadLayout = memo(({
  // Download Manager Panel Modal
  showDownloadPanel: propShowDownloadPanel,
  onCloseDownloadPanel: propOnCloseDownloadPanel,
  downloadTasks: propDownloadTasks,
  downloadPanelTab: propDownloadPanelTab,
  onSelectedTabChange: propOnSelectedTabChange,
  onOpenAddModal: propOnOpenAddModal,
  onDeleteTask: propOnDeleteTask,

  // Download & Transfer Snackbar
  transferTasks: propTransferTasks,
  downloadSummary: propDownloadSummary,
  onOpenDownloadPanel: propOnOpenDownloadPanel,
} = {}) => {
  const context = useDownloadContext();

  const showDownloadPanel = propShowDownloadPanel !== undefined ? propShowDownloadPanel : context.showDownloadPanel;
  const onCloseDownloadPanel = propOnCloseDownloadPanel || context.onCloseDownloadPanel;
  const downloadTasks = propDownloadTasks || context.downloadTasks;
  const downloadPanelTab = propDownloadPanelTab || context.downloadPanelTab;
  const onSelectedTabChange = propOnSelectedTabChange || context.onSelectedTabChange;
  const onOpenAddModal = propOnOpenAddModal || context.onOpenAddModal;
  const onDeleteTask = propOnDeleteTask || context.onDeleteTask;

  const transferTasks = propTransferTasks || context.transferTasks;
  const downloadSummary = propDownloadSummary || context.downloadSummary;
  const onOpenDownloadPanel = propOnOpenDownloadPanel || context.onOpenDownloadPanel;

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
