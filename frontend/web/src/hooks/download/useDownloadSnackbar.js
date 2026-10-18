import { useDownloadContext } from '../../contexts/DownloadContext';

/**
 * useDownloadSnackbar — Hook for DownloadSnackbar
 * Extracts active download tasks, transfer tasks, and download summary
 */
export function useDownloadSnackbar() {
  const {
    downloadTasks = [],
    transferTasks = [],
    downloadSummary = null,
    onOpenDownloadPanel,
  } = useDownloadContext();

  return {
    tasks: downloadTasks,
    transferTasks,
    summary: downloadSummary,
    onOpenPanel: onOpenDownloadPanel,
  };
}
