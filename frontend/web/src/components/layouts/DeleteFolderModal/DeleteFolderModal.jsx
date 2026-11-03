import useDeleteFolderModal from '../../../hooks/useDeleteFolderModal';
import TrashIcon from '../../../assets/icons/TrashIcon';
import Loading from '../../common/Loading/Loading';
import './DeleteFolderModal.css';

/**
 * Component hiển thị Modal xác nhận xóa thư mục (Delete Folder)
 * Tuân thủ Quy tắc 10 (Pure presentational component), Quy tắc 11 (Zero blur/shadow), Quy tắc 14 (100% English) và Quy tắc 15 (No pointer)
 */
function DeleteFolderModal() {
  const {
    isOpen,
    isDeleting,
    error,
    folderName,
    handleClose,
    handleDelete,
    handleKeyDown,
  } = useDeleteFolderModal();

  if (!isOpen) return null;

  return (
    <div
      className="delete-folder-backdrop"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="presentation"
    >
      <div
        className="delete-folder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-folder-dialog-title"
        aria-describedby="delete-folder-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header với icon tròn đỏ cảnh báo và căn trái chuẩn macOS Alert */}
        <div className="delete-folder-dialog__header">
          <div className="delete-folder-dialog__icon-box">
            <TrashIcon className="delete-folder-dialog__icon" />
          </div>
          <h2 id="delete-folder-dialog-title" className="delete-folder-dialog__title">
            Delete Folder
          </h2>
          <p id="delete-folder-dialog-desc" className="delete-folder-dialog__desc">
            Are you sure you want to delete <span className="delete-folder-dialog__target-name">“{folderName}”</span>? This action cannot be undone.
          </p>
        </div>

        {/* Thông báo lỗi nếu xảy ra sự cố */}
        {error && (
          <p className="delete-folder-dialog__error-msg" role="alert">
            {error}
          </p>
        )}

        {/* Cặp nút bấm dạng viên thuốc (Pill Buttons) song song chuẩn macOS Alert */}
        <div className="delete-folder-dialog__footer">
          <button
            type="button"
            className="delete-folder-dialog__btn delete-folder-dialog__btn--cancel"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-folder-dialog__btn delete-folder-dialog__btn--delete"
            onClick={handleDelete}
            disabled={isDeleting}
            autoFocus
          >
            {isDeleting ? <Loading size="sm" text="" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteFolderModal;
