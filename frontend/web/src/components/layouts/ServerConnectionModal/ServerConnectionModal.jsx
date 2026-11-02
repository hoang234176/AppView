import useLayout from '../../../hooks/useLayout';
import useServerConnectionModal from '../../../hooks/useServerConnectionModal';
import Loading from '../../common/Loading/Loading';
import ServerIcon from '../../../assets/icons/ServerIcon';
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
    isDismissed,
    handleConnect,
    handleCancel,
    handleKeyDown,
  } = useServerConnectionModal();

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className="server-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-modal-title"
    >
      <div className="server-modal-card">
        {/* Header căn trái theo chuẩn macOS Dialog */}
        <div className="server-modal-header">
          <div className="server-modal-icon-box">
            <ServerIcon className="server-modal-icon" />
          </div>
          <h2 id="server-modal-title" className="server-modal-title">
            Connect to Server
          </h2>
          <p className="server-modal-desc">
            AppView requires a connection to the Coordinator server.
          </p>
          <p className="server-modal-subdesc">
            Enter Host and Port to connect.
          </p>
        </div>

        {/* Form fields - Xếp chồng dọc 100% full width */}
        <div className="server-modal-form">
          <div className="server-modal-field">
            <input
              id="modal-server-host"
              type="text"
              className={`server-modal-input ${hostError ? 'server-modal-input--error' : ''}`}
              placeholder="Host (e.g. 127.0.0.1)"
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
              aria-label="Server Host"
            />
          </div>

          <div className="server-modal-field">
            <input
              id="modal-server-port"
              type="text"
              className={`server-modal-input ${portError ? 'server-modal-input--error' : ''}`}
              placeholder="Port (e.g. 8090)"
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
              aria-label="Server Port"
            />
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

        {/* Nút bấm xếp chồng dọc: Connect ở trên, Cancel ở dưới */}
        <div className="server-modal-actions">
          <button
            type="button"
            className="server-modal-btn server-modal-btn--primary"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            <span className="server-modal-btn__text">
              {isConnecting ? (
                <Loading text="" size="sm" className="server-modal-loading" />
              ) : (
                'Connect'
              )}
            </span>
          </button>
          <button
            type="button"
            className="server-modal-btn server-modal-btn--secondary"
            onClick={handleCancel}
            disabled={isConnecting}
          >
            Cancel
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
