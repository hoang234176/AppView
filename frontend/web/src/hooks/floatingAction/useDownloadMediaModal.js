import { useFloatingActionContext } from '../../contexts/FloatingActionContext';

export function useDownloadMediaModal() {
  const {
    showDownloadMediaModal = false,
    onCloseDownloadMediaModal,
    currentPath = '',
    treeData = [],
    activeDrive = '',
    downloadTasks = [],
    onCoordinatorJobCreated,
    onOpenSettings,
  } = useFloatingActionContext();

  return {
    isOpen: showDownloadMediaModal,
    onClose: onCloseDownloadMediaModal,
    currentPath,
    treeData,
    activeDrive,
    downloadTasks,
    onSuccess: onCoordinatorJobCreated,
    onOpenSettings,
  };
}
