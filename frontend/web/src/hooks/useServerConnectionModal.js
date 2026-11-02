import { useState } from 'react';
import useLayout from './useLayout';
import { checkCoordinatorHealth } from '../api/apiCoordinator';

/**
 * Custom Hook quản lý logic kết nối server cho ServerConnectionModal
 * Tuân thủ Quy tắc 8, 9, 10 của frontend/web/AGENTS.md
 */
export default function useServerConnectionModal() {
  const {
    setHasServerConnection,
    initialConnectionError,
    initialServerValues,
    setServerConfig,
    triggerNotification,
  } = useLayout();

  const [host, setHost] = useState(initialServerValues?.host || '');
  const [port, setPort] = useState(initialServerValues?.port || '');
  const [hostError, setHostError] = useState(Boolean(initialConnectionError));
  const [portError, setPortError] = useState(Boolean(initialConnectionError));
  const [rememberConnection, setRememberConnection] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const handleCancel = () => {
    setIsDismissed(true);
  };

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
      triggerNotification({
        type: 'error',
        title: 'Missing Input',
        message: 'Please enter both Host and Port.',
      });
      return;
    }

    // 1. Validate Host / IP format
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(targetHost);
    if (isIPv4) {
      const parts = targetHost.split('.').map(Number);
      if (parts.some((p) => p < 0 || p > 255)) {
        setHostError(true);
        triggerNotification({
          type: 'error',
          title: 'Invalid Input',
          message: 'Invalid IP address! Each octet must be between 0 and 255.',
        });
        return;
      }
    } else if (!/^[a-zA-Z0-9.-]+$/.test(targetHost)) {
      setHostError(true);
      triggerNotification({
        type: 'error',
        title: 'Invalid Input',
        message: 'Invalid Host address! Please enter a valid IP (e.g. 127.0.0.1) or hostname.',
      });
      return;
    }

    // 2. Validate Port format
    if (!/^\d+$/.test(targetPort)) {
      setPortError(true);
      triggerNotification({
        type: 'error',
        title: 'Invalid Input',
        message: 'Invalid Port! Please enter numbers from 1 to 65535.',
      });
      return;
    }

    const portNum = parseInt(targetPort, 10);
    if (portNum < 1 || portNum > 65535) {
      setPortError(true);
      triggerNotification({
        type: 'error',
        title: 'Invalid Input',
        message: 'Port must be between 1 and 65535.',
      });
      return;
    }

    setIsConnecting(true);

    try {
      const [result] = await Promise.all([
        checkCoordinatorHealth(targetHost, targetPort),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);

      if (result.ok) {
        setServerConfig((prev) => ({
          ...prev,
          coordinator: { host: targetHost, port: targetPort },
        }));

        if (rememberConnection) {
          try {
            let currentSetting = {};
            const raw = localStorage.getItem('setting');
            if (raw) {
              currentSetting = JSON.parse(raw) || {};
            }
            currentSetting['connect-server'] = {
              coordinator: {
                host: targetHost,
                port: targetPort,
              },
              download: { host: '', port: '' },
              storage: { host: '', port: '' },
            };
            localStorage.setItem('setting', JSON.stringify(currentSetting));
          } catch (e) {
            console.error('Failed to save settings to localStorage', e);
          }
        }

        triggerNotification({
          type: 'success',
          title: 'Connected',
          message: `Connected to server at http://${targetHost}:${targetPort}`,
        });
        setHasServerConnection(true);
      } else {
        setHostError(true);
        setPortError(true);
        triggerNotification({
          type: 'error',
          title: 'Connection Failed',
          message: result.error || `Unable to connect to server at http://${targetHost}:${targetPort}`,
        });
      }
    } catch (err) {
      setHostError(true);
      setPortError(true);
      triggerNotification({
        type: 'error',
        title: 'Connection Error',
        message: err.message || 'An unexpected error occurred while connecting.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConnect();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return {
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
  };
}
