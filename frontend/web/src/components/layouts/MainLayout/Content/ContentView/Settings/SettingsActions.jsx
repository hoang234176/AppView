import './SettingsActions.css';
import CheckIcon from '../../../../../../assets/icons/CheckIcon';
import XCloseIcon from '../../../../../../assets/icons/XCloseIcon';

function SettingsActions({ onClose, onSave, onSaveAndClose, isSaving = false }) {
  return (
    <div className="settings-actions">
      <button
        type="button"
        className="settings-btn settings-btn--close"
        onClick={onClose}
        disabled={isSaving}
      >
        <XCloseIcon className="settings-btn__icon" />
        <span className="settings-btn__text">Close</span>
      </button>

      <div className="settings-actions__right">
        <button
          type="button"
          className="settings-btn settings-btn--save"
          onClick={onSave}
          disabled={isSaving}
        >
          <CheckIcon className="settings-btn__icon" strokeWidth="2.4" />
          <span className="settings-btn__text">Save</span>
        </button>

        <button
          type="button"
          className="settings-btn settings-btn--save-close"
          onClick={onSaveAndClose}
          disabled={isSaving}
        >
          <CheckIcon className="settings-btn__icon" strokeWidth="2.4" />
          <span className="settings-btn__text">Save & Close</span>
        </button>
      </div>
    </div>
  );
}

export default SettingsActions;
