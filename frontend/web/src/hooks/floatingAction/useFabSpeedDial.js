import { useFloatingActionContext } from '../../contexts/FloatingActionContext';

export function useFabSpeedDial() {
  const {
    onCreateFolder,
    onDownloadArchive,
    onDownloadMedia,
  } = useFloatingActionContext();

  return {
    onCreateFolder,
    onDownloadArchive,
    onDownloadMedia,
  };
}
