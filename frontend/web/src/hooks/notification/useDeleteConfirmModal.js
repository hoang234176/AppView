import { useNotificationContext } from '../../contexts/NotificationContext';

/**
 * useDeleteConfirmModal — Hook for DeleteModal
 * Extracts item deletion modal state and success callback
 */
export function useDeleteConfirmModal() {
  const {
    deleteModalData,
    onCloseDeleteModal,
    onDeleteSuccess,
  } = useNotificationContext();

  return {
    isOpen: deleteModalData?.isOpen || false,
    targetItem: deleteModalData?.item || null,
    isFolder: deleteModalData?.isFolder || false,
    onClose: onCloseDeleteModal,
    onSuccess: onDeleteSuccess,
  };
}
