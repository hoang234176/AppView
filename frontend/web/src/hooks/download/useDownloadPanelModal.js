import { useDownloadContext } from '../../contexts/DownloadContext';

/**
 * useDownloadPanelModal — Hook for DownloadPanelModal
 * Extracts modal state, task list, and tabs from DownloadContext
 */
export function useDownloadPanelModal() {
  const {
    showDownloadPanel = false,
    onCloseDownloadPanel,
    downloadTasks = [],
    downloadPanelTab = 'active',
    onSelectedTabChange,
    onOpenAddModal,
    onDeleteTask,
  } = useDownloadContext();

  return {
    isOpen: showDownloadPanel,
    onClose: onCloseDownloadPanel,
    tasks: downloadTasks,
    selectedTab: downloadPanelTab,
    onSelectedTabChange,
    onOpenAddModal,
    onDeleteTask,
  };
}
