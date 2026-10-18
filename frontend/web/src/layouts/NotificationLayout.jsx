import { memo } from 'react';
import {
  DisconnectedOverlay,
  ConflictResolutionModal,
  DeleteModal,
  ToastNotification,
} from '../components/layout/NotificationLayout';
import { useNotificationContext } from '../contexts/NotificationContext';

/**
 * NotificationLayout — Global Feedback, Confirmation & System Alert Layout
 * Centralizes all user-facing notifications, critical dialogs and system overlays:
 * 1. DisconnectedOverlay (Full-screen system connection alert)
 * 2. ConflictResolutionModal (Side-by-side file/folder duplicate comparison)
 * 3. DeleteModal (Permanent deletion confirmation)
 * 4. ToastNotification (Floating success feedback toast)
 */
export const NotificationLayout = memo(({
  // 1. Connection Overlay
  isConnected: propIsConnected,
  showConfigModal: propShowConfigModal,
  onOpenConfig: propOnOpenConfig,

  // 2. Conflict Resolution
  conflictModalData: propConflictModalData,
  onResolveConflicts: propOnResolveConflicts,
  onCloseConflictModal: propOnCloseConflictModal,

  // 3. Delete Confirmation
  deleteModalData: propDeleteModalData,
  onCloseDeleteModal: propOnCloseDeleteModal,
  onDeleteSuccess: propOnDeleteSuccess,

  // 4. Toast Feedback
  toastMessage: propToastMessage,
} = {}) => {
  const context = useNotificationContext();

  const isConnected = propIsConnected !== undefined ? propIsConnected : context.isConnected;
  const showConfigModal = propShowConfigModal !== undefined ? propShowConfigModal : context.showConfigModal;
  const onOpenConfig = propOnOpenConfig || context.onOpenConfig;

  const conflictModalData = propConflictModalData !== undefined ? propConflictModalData : context.conflictModalData;
  const onResolveConflicts = propOnResolveConflicts || context.onResolveConflicts;
  const onCloseConflictModal = propOnCloseConflictModal || context.onCloseConflictModal;

  const deleteModalData = propDeleteModalData !== undefined ? propDeleteModalData : context.deleteModalData;
  const onCloseDeleteModal = propOnCloseDeleteModal || context.onCloseDeleteModal;
  const onDeleteSuccess = propOnDeleteSuccess || context.onDeleteSuccess;

  const toastMessage = propToastMessage !== undefined ? propToastMessage : context.toastMessage;
  return (
    <>
      {/* 1. System Disconnected Overlay */}
      <DisconnectedOverlay
        isConnected={isConnected}
        showConfigModal={showConfigModal}
        onOpenConfig={onOpenConfig}
      />

      {/* 2. File / Folder Conflict Resolution Modal */}
      <ConflictResolutionModal
        isOpen={conflictModalData?.isOpen}
        conflicts={conflictModalData?.conflicts}
        action={conflictModalData?.action}
        onResolve={onResolveConflicts}
        onClose={onCloseConflictModal}
      />

      {/* 3. Delete Confirmation Dialog Modal */}
      <DeleteModal
        isOpen={deleteModalData?.isOpen}
        onClose={onCloseDeleteModal}
        targetItem={deleteModalData?.item}
        isFolder={deleteModalData?.isFolder}
        onSuccess={onDeleteSuccess}
      />

      {/* 4. Floating Toast Notification */}
      <ToastNotification message={toastMessage} />
    </>
  );
});

NotificationLayout.displayName = 'NotificationLayout';
