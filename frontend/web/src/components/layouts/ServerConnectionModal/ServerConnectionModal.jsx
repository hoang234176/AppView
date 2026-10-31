import useLayout from '../../../hooks/useLayout';
import useServerConnectionModal from '../../../hooks/useServerConnectionModal';
import Loading from '../../common/Loading/Loading';
import ServerIcon from '../../../assets/icons/ServerIcon';
import GlobeIcon from '../../../assets/icons/GlobeIcon';
import PlugIcon from '../../../assets/icons/PlugIcon';
import CheckIcon from '../../../assets/icons/CheckIcon';
import './ServerConnectionModal.css';

function ServerConnectionModalContent() {
  const {
    host,
    setHost,
    port,
    setPort,
    hostError,
    setHostError,
    portError,
    setPortError,
    rememberConnection,
    setRememberConnection,
    isConnecting,
    handleConnect,
    handleKeyDown,
  } = useServerConnectionModal();

  return (
    <div
      className="server-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-modal-title"
    >
      <div className="server-modal-card">
        {/* Header */}
        <div className="server-modal-header">
          <div className="server-modal-icon-box">
            <ServerIcon className="server-modal-icon" />
          </div>
          <h2 id="server-modal-title" className="server-modal-title">
            Connect Server
          </h2>
          <p className="server-modal-desc">
            Enter Host and Port to connect to the server.
          </p>
        </div>

        {/* Form fields */}
        <div className="server-modal-form">
          <div className="server-modal-row">
            <div className="server-modal-field server-modal-field--host">
              <label htmlFor="modal-server-host" className="server-modal-label">
                <GlobeIcon className="server-modal-field-icon" />
                <span>Host</span>
              </label>
              <input
                id="modal-server-host"
                type="text"
                className={`server-modal-input ${hostError ? 'server-modal-input--error' : ''}`}
                placeholder="127.0.0.1"
                value={host}
                onChange={(e) => {
                  setHost(e.target.value);
                  if (hostError || portError) {
                    setHostError(false);
                    setPortError(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            <div className="server-modal-field server-modal-field--port">
              <label htmlFor="modal-server-port" className="server-modal-label">
                <PlugIcon className="server-modal-field-icon" />
                <span>Port</span>
              </label>
              <input
                id="modal-server-port"
                type="text"
                className={`server-modal-input ${portError ? 'server-modal-input--error' : ''}`}
                placeholder="8090"
                value={port}
                onChange={(e) => {
                  setPort(e.target.value);
                  if (hostError || portError) {
                    setHostError(false);
                    setPortError(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Checkbox: Remember this connection */}
          <label className="server-modal-checkbox-row">
            <input
              type="checkbox"
              className="server-modal-checkbox-input"
              checked={rememberConnection}
              onChange={(e) => setRememberConnection(e.target.checked)}
            />
            <span
              className={`server-modal-checkbox-custom ${rememberConnection ? 'server-modal-checkbox-custom--checked' : ''}`}
              aria-hidden="true"
            >
              {rememberConnection && <CheckIcon className="server-modal-check-icon" />}
            </span>
            <span className="server-modal-checkbox-label">Remember this connection</span>
          </label>
        </div>

        {/* Connect Action Button */}
        <div className="server-modal-actions">
          <button
            type="button"
            className="server-modal-btn"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            <span className="server-modal-btn__text">
              {isConnecting ? (
                <Loading text="" size="sm" className="server-modal-loading" />
              ) : (
                <>
                  <PlugIcon className="server-modal-btn__icon" />
                  Connect
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ServerConnectionModal() {
  const { hasServerConnection, isInitialCheckDone } = useLayout();

  // Do not show modal if connection is already established or initial check hasn't finished
  if (hasServerConnection || !isInitialCheckDone) {
    return null;
  }

  return <ServerConnectionModalContent />;
}

export default ServerConnectionModal;
