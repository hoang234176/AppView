import useNewFolderModal from '../../../hooks/useNewFolderModal';
import NewFolderIcon from '../../../assets/icons/NewFolderIcon';
import Loading from '../../common/Loading/Loading';
import './NewFolderModal.css';

/**
 * Component hiển thị Modal nhập tên tạo thư mục mới (New Folder)
 * Tuân thủ Quy tắc 10 (Pure presentational component) & Quy tắc 11 (Zero blur/drop-shadow)
 */
function NewFolderModal() {
  const {
    isOpen,
    folderName,
    setFolderName,
    error,
    isSubmitting,
    inputRef,
    displayLocationPath,
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
        {/* Header với icon thư mục macOS và vị trí tạo */}
        <div className="new-folder-dialog__header">
          <div className="new-folder-dialog__icon-box">
            <NewFolderIcon className="new-folder-dialog__icon" />
          </div>
          <div className="new-folder-dialog__header-text">
            <h2 id="new-folder-dialog-title" className="new-folder-dialog__title">
              New Folder
            </h2>
            <p className="new-folder-dialog__location" title={`Vị trí: ${displayLocationPath}`}>
              <span className="new-folder-dialog__location-label">Where: </span>
              <span className="new-folder-dialog__location-val">{displayLocationPath}</span>
            </p>
          </div>
        </div>

        {/* Khối nhập tên thư mục */}
        <div className="new-folder-dialog__body">
          <label htmlFor="new-folder-name-input" className="new-folder-dialog__label">
            Folder Name
          </label>
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
            aria-label="Tên thư mục mới"
          />
          {error && <p className="new-folder-dialog__error-msg">{error}</p>}
        </div>

        {/* Nút hành động Cancel / Create */}
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
