import useGetInfoModal from '../../../hooks/useGetInfoModal';
import InfoCircleIcon from '../../../assets/icons/InfoCircleIcon';
import Loading from '../../common/Loading/Loading';
import './GetInfoModal.css';

/**
 * Component hiển thị Modal xem thông tin chi tiết thư mục (Get Info)
 * Tuân thủ Quy tắc 10 (Pure presentational component), Quy tắc 11 (Zero blur/shadow) và Quy tắc 14 (100% English)
 */
function GetInfoModal() {
  const {
    isOpen,
    isLoading,
    infoData,
    showBytes,
    showDetailContains,
    toggleSizeFormat,
    toggleContainsFormat,
    handleClose,
    handleKeyDown,
  } = useGetInfoModal();

  if (!isOpen) return null;

  return (
    <div
      className="get-info-backdrop"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="presentation"
    >
      <div
        className="get-info-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="get-info-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header với icon tròn và căn trái chuẩn macOS Alert */}
        <div className="get-info-dialog__header">
          <div className="get-info-dialog__icon-box">
            <InfoCircleIcon className="get-info-dialog__icon" />
          </div>
          <h2 id="get-info-dialog-title" className="get-info-dialog__title">
            Get Info
          </h2>
        </div>

        {/* Khối hiển thị chi tiết thông số (Specs List) */}
        <div className="get-info-dialog__body">
          {isLoading ? (
            <div className="get-info-dialog__loading">
              <Loading size="sm" text="Calculating..." />
            </div>
          ) : (
            <div className="get-info-dialog__specs">
              <div className="get-info-dialog__row">
                <span className="get-info-dialog__label">Name</span>
                <span className="get-info-dialog__val">{infoData.name || '—'}</span>
              </div>
              <div className="get-info-dialog__row">
                <span className="get-info-dialog__label">Kind</span>
                <span className="get-info-dialog__val">{infoData.kind}</span>
              </div>
              <div
                className="get-info-dialog__row get-info-dialog__row--clickable"
                onClick={toggleSizeFormat}
                title="Click to toggle between formatted size and bytes"
              >
                <span className="get-info-dialog__label">Size</span>
                <span className="get-info-dialog__val">
                  {showBytes ? infoData.sizeBytes : infoData.sizeFormatted}
                </span>
              </div>
              <div className="get-info-dialog__row">
                <span className="get-info-dialog__label">Path</span>
                <span className="get-info-dialog__val get-info-dialog__val--path" title={infoData.whereText}>
                  {infoData.whereText || '—'}
                </span>
              </div>
              <div
                className="get-info-dialog__row get-info-dialog__row--clickable"
                onClick={toggleContainsFormat}
                title="Click to toggle between total items and detailed breakdown"
              >
                <span className="get-info-dialog__label">Contains</span>
                <span className="get-info-dialog__val">
                  {showDetailContains ? infoData.containsDetail : infoData.containsSummary}
                </span>
              </div>
              <div className="get-info-dialog__row">
                <span className="get-info-dialog__label">Modified</span>
                <span className="get-info-dialog__val">{infoData.modifiedText}</span>
              </div>
            </div>
          )}
        </div>

        {/* Nút đóng dạng viên thuốc chuẩn macOS (Pill Button) */}
        <div className="get-info-dialog__footer">
          <button
            type="button"
            className="get-info-dialog__btn"
            onClick={handleClose}
            autoFocus
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default GetInfoModal;
