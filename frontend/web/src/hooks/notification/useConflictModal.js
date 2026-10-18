import { useNotificationContext } from '../../contexts/NotificationContext';

/**
 * useConflictModal — Hook for ConflictResolutionModal
 * Extracts conflict resolution state and handlers
 */
export function useConflictModal() {
  const {
    conflictModalData,
    onResolveConflicts,
    onCloseConflictModal,
  } = useNotificationContext();

  return {
    isOpen: conflictModalData?.isOpen || false,
    conflicts: conflictModalData?.conflicts || [],
    action: conflictModalData?.action || 'copy',
    onResolve: onResolveConflicts,
    onClose: onCloseConflictModal,
  };
}
