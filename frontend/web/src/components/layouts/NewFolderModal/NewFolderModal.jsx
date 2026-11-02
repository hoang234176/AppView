import useNewFolderModal from '../../../hooks/useNewFolderModal';
import NewFolderIcon from '../../../assets/icons/NewFolderIcon';
import Loading from '../../common/Loading/Loading';
import './NewFolderModal.css';

/**
 * Component hiển thị Modal nhập tên tạo thư mục mới (New Folder)
 * Tuân thủ Quy tắc 10 (Pure presentational component), Quy tắc 11 (Zero blur/shadow) và Quy tắc 14 (100% English)
 */
function NewFolderModal() {
  const {
    isOpen,
    folderName,
    setFolderName,
    error,
    isSubmitting,
    inputRef,
    handleClose,
    handleCreate,
    handleKeyDown,
  } = useNewFolderModal();

  if (!isOpen) return null;

  return (
    <div
      className="new-folder-backdrop"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="new-folder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-folder-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header với icon tròn và căn trái chuẩn macOS Alert */}
        <div className="new-folder-dialog__header">
          <div className="new-folder-dialog__icon-box">
            <NewFolderIcon className="new-folder-dialog__icon" />
          </div>
          <h2 id="new-folder-dialog-title" className="new-folder-dialog__title">
            New Folder
          </h2>
          <p className="new-folder-dialog__desc">
            Enter a name for this new folder.
          </p>
        </div>

        {/* Khối nhập tên thư mục */}
        <div className="new-folder-dialog__body">
          <input
            ref={inputRef}
            id="new-folder-name-input"
            type="text"
            className={`new-folder-dialog__input ${error ? 'new-folder-dialog__input--error' : ''}`}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            placeholder="Untitled folder"
            maxLength={255}
            autoComplete="off"
            spellCheck="false"
            aria-label="New folder name"
          />
          {error && <p className="new-folder-dialog__error-msg">{error}</p>}
        </div>

        {/* Cặp nút bấm dạng viên thuốc (Pill Buttons) song song chuẩn macOS Shut Down Alert */}
        <div className="new-folder-dialog__footer">
          <button
            type="button"
            className="new-folder-dialog__btn new-folder-dialog__btn--cancel"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="new-folder-dialog__btn new-folder-dialog__btn--create"
            onClick={handleCreate}
            disabled={isSubmitting || !folderName.trim()}
          >
            {isSubmitting ? <Loading size="sm" text="" /> : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewFolderModal;
