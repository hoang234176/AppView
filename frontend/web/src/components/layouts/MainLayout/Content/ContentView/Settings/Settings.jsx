import './Settings.css';
import useLayout from '../../../../../../hooks/useLayout';
import SettingsContent from './SettingsContent';
import SettingsActions from './SettingsActions';

function Settings() {
  const { isSettingsClosing } = useLayout();

  return (
    <div className={`settings-container ${isSettingsClosing ? 'settings-container--closing' : ''}`}>
      <SettingsContent />
      <SettingsActions />
    </div>
  );
}

export default Settings;
