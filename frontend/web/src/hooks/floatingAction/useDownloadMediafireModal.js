import { useFloatingActionContext } from '../../contexts/FloatingActionContext';

export function useDownloadMediafireModal() {
  const {
    showDownloadMediafireModal = false,
    onCloseDownloadMediafireModal,
    currentPath = '',
    treeData = [],
    activeDrive = '',
    onDownloadMediafireSuccess,
  } = useFloatingActionContext();

  return {
    isOpen: showDownloadMediafireModal,
    onClose: onCloseDownloadMediafireModal,
    currentPath,
    treeData,
    activeDrive,
    onSuccess: onDownloadMediafireSuccess,
  };
}
