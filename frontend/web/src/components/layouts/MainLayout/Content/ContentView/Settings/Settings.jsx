import './Settings.css';
import useServerSettings from '../../../../../../hooks/useServerSettings';
import Loading from '../../../../../common/Loading/Loading';
import SettingsContent from './SettingsContent';
import SettingsActions from './SettingsActions';

function Settings() {
  const {
    host,
    setHost,
    port,
    setPort,
    hostError,
    portError,
    isConnecting,
    isSaving,
    isSettingsClosing,
    handleConnect,
    handleSave,
    handleSaveAndClose,
    handleClose,
  } = useServerSettings();

  return (
    <div className={`settings-container ${isSettingsClosing ? 'settings-container--closing' : ''}`}>
      <div className="settings-content-wrapper">
        <SettingsContent
          host={host}
          setHost={setHost}
          port={port}
          setPort={setPort}
          hostError={hostError}
          portError={portError}
          isConnecting={isConnecting}
          onConnect={handleConnect}
        />
        {isSaving && (
          <div className="settings-content-overlay" aria-live="polite">
            <Loading text="" size="md" />
          </div>
        )}
      </div>

      <SettingsActions
        onClose={handleClose}
        onSave={handleSave}
        onSaveAndClose={handleSaveAndClose}
        isSaving={isSaving}
      />
    </div>
  );
}

export default Settings;
