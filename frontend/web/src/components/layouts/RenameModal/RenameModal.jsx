import useRenameModal from '../../../hooks/useRenameModal';
import EditIcon from '../../../assets/icons/EditIcon';
import Loading from '../../common/Loading/Loading';
import './RenameModal.css';

/**
 * Component hiển thị Modal nhập tên mới để đổi tên thư mục (Rename Folder)
 * Tuân thủ Quy tắc 10 (Pure presentational component), Quy tắc 11 (Zero blur/shadow) và Quy tắc 14 (100% English)
 */
function RenameModal() {
  const {
    isOpen,
    folderName,
    setFolderName,
    error,
    isSubmitting,
    inputRef,
    handleClose,
    handleRename,
    handleKeyDown,
  } = useRenameModal();

  if (!isOpen) return null;

  return (
    <div
      className="rename-folder-backdrop"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="rename-folder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-folder-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header với icon tròn và căn trái chuẩn macOS Alert */}
        <div className="rename-folder-dialog__header">
          <div className="rename-folder-dialog__icon-box">
            <EditIcon className="rename-folder-dialog__icon" />
          </div>
          <h2 id="rename-folder-dialog-title" className="rename-folder-dialog__title">
            Rename Folder
          </h2>
          <p className="rename-folder-dialog__desc">
            Enter a new name for this folder.
          </p>
        </div>

        {/* Khối nhập tên mới */}
        <div className="rename-folder-dialog__body">
          <input
            ref={inputRef}
            id="rename-folder-name-input"
            type="text"
            className={`rename-folder-dialog__input ${error ? 'rename-folder-dialog__input--error' : ''}`}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            maxLength={255}
            autoComplete="off"
            spellCheck="false"
            aria-label="New folder name"
            placeholder="Folder name"
          />
          {error && <p className="rename-folder-dialog__error-msg">{error}</p>}
        </div>

        {/* Cặp nút bấm dạng viên thuốc (Pill Buttons) song song chuẩn macOS Shut Down Alert */}
        <div className="rename-folder-dialog__footer">
          <button
            type="button"
            className="rename-folder-dialog__btn rename-folder-dialog__btn--cancel"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rename-folder-dialog__btn rename-folder-dialog__btn--rename"
            onClick={handleRename}
            disabled={isSubmitting || !folderName.trim()}
          >
            {isSubmitting ? <Loading size="sm" text="" /> : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RenameModal;
