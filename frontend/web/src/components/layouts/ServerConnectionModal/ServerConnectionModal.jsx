import { useState } from 'react';
import useLayout from '../../../hooks/useLayout';
import Loading from '../../common/Loading/Loading';
import ServerIcon from '../../../assets/icons/ServerIcon';
import GlobeIcon from '../../../assets/icons/GlobeIcon';
import PlugIcon from '../../../assets/icons/PlugIcon';
import CheckIcon from '../../../assets/icons/CheckIcon';
import { checkCoordinatorHealth } from '../../../api/coordinatorApi';
import './ServerConnectionModal.css';

function ServerConnectionModalContent() {
  const {
    setHasServerConnection,
    initialConnectionError,
    initialServerValues,
  } = useLayout();

  const [host, setHost] = useState(initialServerValues?.host || '');
  const [port, setPort] = useState(initialServerValues?.port || '');
  const [hostError, setHostError] = useState(false);
  const [portError, setPortError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialConnectionError || '');
  const [rememberConnection, setRememberConnection] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    const targetHost = host.trim();
    const targetPort = port.trim();

    let hasEmptyError = false;

    if (!targetHost) {
      setHostError(true);
      hasEmptyError = true;
    } else {
      setHostError(false);
    }

    if (!targetPort) {
      setPortError(true);
      hasEmptyError = true;
    } else {
      setPortError(false);
    }

    if (hasEmptyError) {
      setErrorMessage('Please enter both Host and Port.');
      return;
    }

    // 1. Validate Host / IP format
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(targetHost);
    if (isIPv4) {
      const parts = targetHost.split('.').map(Number);
      if (parts.some((p) => p < 0 || p > 255)) {
        setHostError(true);
        setErrorMessage('Invalid IP address! Each octet must be between 0 and 255.');
        return;
      }
    } else if (!/^[a-zA-Z0-9.-]+$/.test(targetHost)) {
      setHostError(true);
      setErrorMessage('Invalid Host address! Please enter a valid IP (e.g. 127.0.0.1) or hostname.');
      return;
    }

    // 2. Validate Port format
    if (!/^\d+$/.test(targetPort)) {
      setPortError(true);
      setErrorMessage('Invalid Port! Please enter numbers from 1 to 65535.');
      return;
    }

    const portNum = parseInt(targetPort, 10);
    if (portNum < 1 || portNum > 65535) {
      setPortError(true);
      setErrorMessage('Port must be between 1 and 65535.');
      return;
    }

    setIsConnecting(true);
    setErrorMessage('');

    try {
      const [result] = await Promise.all([
        checkCoordinatorHealth(targetHost, targetPort),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);

      if (result.ok) {
        if (rememberConnection) {
          try {
            let currentSetting = {};
            const raw = localStorage.getItem('setting');
            if (raw) {
              currentSetting = JSON.parse(raw) || {};
            }
            currentSetting['connect-server'] = {
              host: targetHost,
              port: targetPort,
            };
            localStorage.setItem('setting', JSON.stringify(currentSetting));
          } catch (e) {
            console.error('Failed to save settings to localStorage', e);
          }
        }

        setHasServerConnection(true);
      } else {
        setErrorMessage(result.error || `Unable to connect to Coordinator Server at http://${targetHost}:${targetPort}`);
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred while connecting.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

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
            Enter Host and Port to connect to the Coordinator Server.
          </p>
        </div>

        {/* Error notification alert */}
        {errorMessage && (
          <div className="server-modal-alert">
            <span className="server-modal-alert-text">{errorMessage}</span>
          </div>
        )}

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
                  if (hostError) setHostError(false);
                  if (errorMessage) setErrorMessage('');
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
                  if (portError) setPortError(false);
                  if (errorMessage) setErrorMessage('');
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
                'Connect'
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
