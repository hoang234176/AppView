import { memo } from 'react';
import { BatchActionModal, RenameFolderModal } from '../components/layout/FileOperationLayout';

/**
 * FileOperationLayout — Area 10: File Operations & Batch Dialogs
 * Encapsulates batch action modal (move/copy) and rename folder dialog modal.
 */
export const FileOperationLayout = memo(({
  // Rename Folder Modal
  showRenameFolderModal,
  onCloseRenameFolderModal,
  targetFolder,
  onRenameFolderSubmit,

  // Batch Action Modal
  batchModalState,
  onCloseBatchModal,
  selectedItems,
  treeData,
  currentPath,
  drives,
  activeDrive,
  onConfirmBatch,
}) => {
  return (
    <>
      {/* Rename Folder Dialog Modal */}
      <RenameFolderModal
        isOpen={showRenameFolderModal}
        onClose={onCloseRenameFolderModal}
        folder={targetFolder}
        onRename={onRenameFolderSubmit}
      />

      {/* Batch Action Modal for Select Mode & Single Item Actions */}
      {batchModalState && (
        <BatchActionModal
          isOpen={batchModalState.isOpen}
          action={batchModalState.action}
          onClose={onCloseBatchModal}
          items={
            batchModalState.items && batchModalState.items.length > 0
              ? batchModalState.items
              : Array.from(selectedItems ? selectedItems.values() : [])
          }
          treeData={treeData}
          currentPath={currentPath}
          drives={drives}
          activeDrive={activeDrive}
          onConfirm={onConfirmBatch}
        />
      )}
    </>
  );
});

FileOperationLayout.displayName = 'FileOperationLayout';
