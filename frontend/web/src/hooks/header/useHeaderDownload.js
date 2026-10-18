import { useHeaderContext } from '../../contexts/HeaderContext';

export function useHeaderDownload() {
  const {
    onOpenDownloadPanel,
    activeDownloadCount = 0,
    downloadProgressPercent = 0,
    isDownloadingMode = true,
    hasPasswordError = false,
    isScanning = false,
    isConverting = false,
  } = useHeaderContext();

  return {
    onOpenDownloadPanel,
    activeDownloadCount,
    downloadProgressPercent,
    isDownloadingMode,
    hasPasswordError,
    isScanning,
    isConverting,
  };
}
