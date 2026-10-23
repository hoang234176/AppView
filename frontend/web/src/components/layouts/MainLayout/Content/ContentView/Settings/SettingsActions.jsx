import { useNavigate } from 'react-router-dom';
import useLayout from '../../../../../../hooks/useLayout';
import './SettingsActions.css';

function SettingsActions() {
  const { closeSettings } = useLayout();
  const navigate = useNavigate();

  const handleClose = () => {
    closeSettings(() => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    });
  };

  return (
    <div className="settings-actions">
      <button
        type="button"
        className="settings-btn settings-btn--close"
        onClick={handleClose}
      >
        <span className="settings-btn__text">Close</span>
      </button>

      <div className="settings-actions__right">
        <button
          type="button"
          className="settings-btn settings-btn--save"
        >
          <span className="settings-btn__text">Save</span>
        </button>

        <button
          type="button"
          className="settings-btn settings-btn--save-close"
          onClick={handleClose}
        >
          <span className="settings-btn__text">Save & Close</span>
        </button>
      </div>
    </div>
  );
}

export default SettingsActions;
