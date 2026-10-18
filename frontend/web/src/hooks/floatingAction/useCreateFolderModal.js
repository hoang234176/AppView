import { useFloatingActionContext } from '../../contexts/FloatingActionContext';

export function useCreateFolderModal() {
  const {
    showCreateFolderModal = false,
    onCloseCreateFolderModal,
    onCreateFolderSubmit,
  } = useFloatingActionContext();

  return {
    isOpen: showCreateFolderModal,
    onClose: onCloseCreateFolderModal,
    onCreate: onCreateFolderSubmit,
  };
}
