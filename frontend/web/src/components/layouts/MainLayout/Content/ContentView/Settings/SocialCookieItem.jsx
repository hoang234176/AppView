import { memo } from 'react';
import Loading from '../../../../../common/Loading/Loading';
import ChevronRight from '../../../../../../assets/icons/ChevronRight';
import CheckIcon from '../../../../../../assets/icons/CheckIcon';
import RefreshIcon from '../../../../../../assets/icons/RefreshIcon';
import EditIcon from '../../../../../../assets/icons/EditIcon';
import TrashIcon from '../../../../../../assets/icons/TrashIcon';
import XCloseIcon from '../../../../../../assets/icons/XCloseIcon';

function SocialCookieItem({
  platform,
  Icon,
  cookieEntry = { status: 'empty', raw: '' },
  isEditing = false,
  draftVal = '',
  isReadyToSave = false,
  isCheckingDraft = false,
  hasDraftError = false,
  onToggleDrawer,
  onDraftChange,
  onSave,
  onCancel,
  onClear,
  onUpdate,
  onCheck,
  onDrawerCheck,
}) {
  const isUpdating = cookieEntry.status === 'updating' || cookieEntry.status === 'checking';

  let badgeLabel = 'Not Set';
  let badgeModifier = 'empty';
  if (isUpdating) {
    badgeLabel = 'Waiting';
    badgeModifier = 'updating';
  } else if (cookieEntry.status === 'active') {
    badgeLabel = 'Active';
    badgeModifier = 'active';
  } else if (cookieEntry.status === 'expired') {
    badgeLabel = 'Expired';
    badgeModifier = 'expired';
  }

  const handleRowAction = () => {
    if (onUpdate) {
      onUpdate(platform.id);
    } else if (onCheck) {
      onCheck(platform.id);
    }
  };

  return (
    <div className="social-cookies-item">
      {/* Hàng chính chia làm 3 khu vực: Left (Icon + Tên), Center (Trạng thái), Right (Actions) */}
      <div className="social-cookies-row">
        {/* 1. KHU VỰC LEFT: Icon squircle 24px + Tên nền tảng */}
        <div className="social-cookies-row__left">
          <div className={`social-platform-icon-box social-platform-icon-box--${platform.iconModifier}`}>
            <Icon className="social-platform-icon" />
          </div>
          <span className="social-platform-name">{platform.name}</span>
        </div>

        {/* 2. KHU VỰC CENTER: Huy hiệu trạng thái Cookie (đẩy lên trên và mờ dần khi mở Config) */}
        <div className={`social-cookies-row__center ${isEditing ? 'social-cookies-row__center--hidden' : ''}`}>
          <span className={`social-status-badge social-status-badge--${badgeModifier}`}>
            <span className="social-status-dot" aria-hidden="true" />
            <span key={badgeLabel} className="social-status-text">{badgeLabel}</span>
          </span>
        </div>

        {/* 3. KHU VỰC RIGHT: Cụm thao tác Update (đẩy lên trên và mờ dần khi mở Config) và nút Config */}
        <div className="social-cookies-row__right">
          <button
            type="button"
            className={`social-cookies-btn social-cookies-btn--update ${isEditing ? 'social-cookies-btn--update-hidden' : ''}`}
            onClick={handleRowAction}
            disabled={isUpdating || isEditing || cookieEntry.status === 'empty'}
            tabIndex={isEditing ? -1 : 0}
            title={
              isUpdating
                ? 'Updating cookies...'
                : cookieEntry.status === 'empty'
                ? 'No cookies configured to update. Click Config to set.'
                : 'Update and refresh cookies'
            }
          >
            <span key={isUpdating ? 'updating' : 'ready'} className="social-cookies-btn__fade-box">
              {isUpdating ? (
                <Loading text="" size="sm" className="social-cookies-btn-loading" />
              ) : (
                <>
                  <RefreshIcon className="social-cookies-btn__icon" strokeWidth="2.2" />
                  <span className="social-cookies-btn__text">Update</span>
                </>
              )}
            </span>
          </button>

          <button
            type="button"
            className={`social-cookies-btn social-cookies-btn--edit ${isEditing ? 'social-cookies-btn--edit-active' : ''}`}
            onClick={() => onToggleDrawer?.(platform.id)}
            aria-expanded={isEditing}
          >
            <EditIcon className="social-cookies-btn__icon" />
            <span className="social-cookies-btn__text">Config</span>
            <ChevronRight
              className={`social-cookies-btn__chevron ${isEditing ? 'social-cookies-btn__chevron--open' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Drawer trượt mở nhập Netscape Cookie */}
      <div className={`social-cookie-drawer ${isEditing ? 'social-cookie-drawer--open' : ''}`}>
        <div className="social-cookie-drawer-inner">
          <div className="social-cookie-drawer-body">
            <textarea
              className={`social-cookie-textarea ${hasDraftError ? 'social-cookie-textarea--error' : ''}`}
              placeholder={`# Netscape HTTP Cookie File\n# Paste ${platform.name} cookies here...`}
              value={draftVal}
              onChange={(e) => onDraftChange?.(platform.id, e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
            <div className="social-cookie-drawer-actions">
              <button
                type="button"
                className="social-cookie-drawer-btn social-cookie-drawer-btn--clear"
                onClick={() => onClear?.(platform.id)}
                disabled={!draftVal?.trim() || isCheckingDraft}
              >
                <TrashIcon className="social-cookie-drawer-btn__icon" />
                Clear
              </button>
              <div className="social-cookie-drawer-actions__right">
                <button
                  type="button"
                  className="social-cookie-drawer-btn social-cookie-drawer-btn--cancel"
                  onClick={() => onCancel?.(platform.id)}
                  disabled={isCheckingDraft}
                >
                  <XCloseIcon className="social-cookie-drawer-btn__icon" />
                  Cancel
                </button>
                <button
                  type="button"
                  className="social-cookie-drawer-btn social-cookie-drawer-btn--check"
                  onClick={() => onDrawerCheck?.(platform.id)}
                  disabled={!draftVal?.trim() || isCheckingDraft}
                >
                  {isCheckingDraft ? (
                    <Loading text="" size="sm" className="social-cookies-btn-loading" />
                  ) : (
                    <>
                      <CheckIcon className="social-cookie-drawer-btn__icon" strokeWidth="2.5" />
                      Check
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="social-cookie-drawer-btn social-cookie-drawer-btn--save"
                  onClick={() => onSave?.(platform.id)}
                  disabled={!isReadyToSave || isCheckingDraft}
                >
                  <CheckIcon className="social-cookie-drawer-btn__icon" strokeWidth="2.5" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(SocialCookieItem);
