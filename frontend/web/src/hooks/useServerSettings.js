import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useLayout from './useLayout';
import { checkCoordinatorHealth } from '../api/apiCoordinator';

export function validateHostAndPort(targetHost, targetPort) {
  if (!targetHost || !targetPort) {
    return {
      valid: false,
      hostError: !targetHost,
      portError: !targetPort,
      message: 'Please enter both Host and Port.',
    };
  }

  const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(targetHost);
  if (isIPv4) {
    const parts = targetHost.split('.').map(Number);
    if (parts.some((p) => p < 0 || p > 255)) {
      return {
        valid: false,
        hostError: true,
        portError: false,
        message: 'Invalid IP address! Each octet must be between 0 and 255.',
      };
    }
  } else if (!/^[a-zA-Z0-9.-]+$/.test(targetHost)) {
    return {
      valid: false,
      hostError: true,
      portError: false,
      message: 'Invalid Host address! Please enter a valid IP (e.g. 127.0.0.1) or hostname.',
    };
  }

  if (!/^\d+$/.test(targetPort)) {
    return {
      valid: false,
      hostError: false,
      portError: true,
      message: 'Invalid Port! Please enter numbers from 1 to 65535.',
    };
  }

  const portNum = parseInt(targetPort, 10);
  if (portNum < 1 || portNum > 65535) {
    return {
      valid: false,
      hostError: false,
      portError: true,
      message: 'Port must be between 1 and 65535.',
    };
  }

  return { valid: true, hostError: false, portError: false };
}

export default function useServerSettings() {
  const {
    isSettingsClosing,
    closeSettings,
    serverConfig,
    setServerConfig,
    triggerNotification,
  } = useLayout();

  const navigate = useNavigate();

  // Đọc cấu hình ban đầu: ưu tiên giá trị phiên serverConfig, fallback sang localStorage
  const [host, setHostState] = useState(() => {
    if (serverConfig?.coordinator?.host) {
      return serverConfig.coordinator.host;
    }
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('setting');
        if (raw) {
          const parsed = JSON.parse(raw);
          const coord = parsed?.['connect-server']?.coordinator || parsed?.['connect-server'];
          return coord?.host || '';
        }
      }
    } catch {
      // Bỏ qua lỗi parse
    }
    return '';
  });

  const [port, setPortState] = useState(() => {
    if (serverConfig?.coordinator?.port) {
      return serverConfig.coordinator.port;
    }
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('setting');
        if (raw) {
          const parsed = JSON.parse(raw);
          const coord = parsed?.['connect-server']?.coordinator || parsed?.['connect-server'];
          return coord?.port || '';
        }
      }
    } catch {
      // Bỏ qua lỗi parse
    }
    return '';
  });

  const [hostError, setHostError] = useState(false);
  const [portError, setPortError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const setHost = useCallback((val) => {
    setHostState(val);
    setHostError(false);
    setPortError(false);
  }, []);

  const setPort = useCallback((val) => {
    setPortState(val);
    setHostError(false);
    setPortError(false);
  }, []);

  // Thực hiện kiểm tra kết nối với server (nút Connect)
  const handleConnect = useCallback(async () => {
    const targetHost = host.trim();
    const targetPort = port.trim();

    const validation = validateHostAndPort(targetHost, targetPort);
    if (!validation.valid) {
      if (validation.hostError) setHostError(true);
      if (validation.portError) setPortError(true);
      triggerNotification({
        type: 'error',
        title: 'Invalid Input',
        message: validation.message,
      });
      return false;
    }

    setIsConnecting(true);

    try {
      const [result] = await Promise.all([
        checkCoordinatorHealth(targetHost, targetPort),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);

      if (result.ok) {
        setHostError(false);
        setPortError(false);
        setServerConfig((prev) => ({
          ...prev,
          coordinator: { host: targetHost, port: targetPort },
        }));

        triggerNotification({
          type: 'success',
          title: 'Connected',
          message: `Connected to server at http://${targetHost}:${targetPort}`,
        });
        return true;
      } else {
        setHostError(true);
        setPortError(true);
        triggerNotification({
          type: 'error',
          title: 'Connection Failed',
          message: result.error || `Unable to connect to server at http://${targetHost}:${targetPort}`,
        });
        return false;
      }
    } catch (err) {
      setHostError(true);
      setPortError(true);
      triggerNotification({
        type: 'error',
        title: 'Connection Error',
        message: err.message || 'An unexpected error occurred while connecting.',
      });
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [host, port, setServerConfig, triggerNotification]);

  // Lưu an toàn cấu hình: chỉ lưu khi giá trị server hợp lệ & kết nối thành công
  const saveVerifiedSettings = useCallback(async () => {
    const targetHost = host.trim();
    const targetPort = port.trim();

    const currentVerifiedHost = serverConfig?.coordinator?.host?.trim() || '';
    const currentVerifiedPort = serverConfig?.coordinator?.port?.trim() || '';

    // Nếu thông tin server không thay đổi so với cấu hình đã xác thực trong session
    const isUnchanged = targetHost === currentVerifiedHost && targetPort === currentVerifiedPort;

    if (isUnchanged) {
      setHostError(false);
      setPortError(false);
    } else {
      // Xác thực định dạng trước
      const validation = validateHostAndPort(targetHost, targetPort);
      if (!validation.valid) {
        if (validation.hostError) setHostError(true);
        if (validation.portError) setPortError(true);
        triggerNotification({
          type: 'error',
          title: 'Cannot Save',
          message: validation.message,
        });
        return false;
      }

      // Kiểm tra thực tế xem server mới có hoạt động không
      try {
        const result = await checkCoordinatorHealth(targetHost, targetPort);
        if (!result.ok) {
          setHostError(true);
          setPortError(true);
          triggerNotification({
            type: 'error',
            title: 'Cannot Save',
            message: result.error || `Failed to connect to server at http://${targetHost}:${targetPort}. Settings were not saved.`,
          });
          return false;
        }

        // Kết nối thành công -> cập nhật vào session state
        setHostError(false);
        setPortError(false);
        setServerConfig((prev) => ({
          ...prev,
          coordinator: { host: targetHost, port: targetPort },
        }));
      } catch (err) {
        setHostError(true);
        setPortError(true);
        triggerNotification({
          type: 'error',
          title: 'Cannot Save',
          message: err.message || 'Unable to connect to server. Settings were not saved.',
        });
        return false;
      }
    }

    // Ghi an toàn vào localStorage
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
        download: currentSetting['connect-server']?.download || { host: '', port: '' },
        storage: currentSetting['connect-server']?.storage || { host: '', port: '' },
      };
      localStorage.setItem('setting', JSON.stringify(currentSetting));
    } catch (e) {
      console.error('Error saving setting to localStorage', e);
    }

    return true;
  }, [host, port, serverConfig, setServerConfig, triggerNotification]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const ok = await saveVerifiedSettings();
      if (ok) {
        triggerNotification({
          type: 'success',
          title: 'Saved',
          message: 'Server settings saved successfully.',
        });
      }
    } catch (err) {
      triggerNotification({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'An error occurred while saving server settings.',
      });
    } finally {
      timerRef.current = setTimeout(() => {
        setIsSaving(false);
      }, 300);
    }
  }, [isSaving, saveVerifiedSettings, triggerNotification]);

  const handleSaveAndClose = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    let shouldClose = false;

    try {
      const ok = await saveVerifiedSettings();
      if (ok) {
        shouldClose = true;
        triggerNotification({
          type: 'success',
          title: 'Saved',
          message: 'Server settings saved successfully.',
        });
      }
    } catch (err) {
      triggerNotification({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'An error occurred while saving server settings.',
      });
    } finally {
      timerRef.current = setTimeout(() => {
        setIsSaving(false);
        if (shouldClose) {
          closeSettings(() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/');
            }
          });
        }
      }, 300);
    }
  }, [isSaving, saveVerifiedSettings, triggerNotification, closeSettings, navigate]);

  const handleClose = useCallback(() => {
    if (isSaving) return;
    closeSettings(() => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    });
  }, [isSaving, closeSettings, navigate]);

  return {
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
  };
}
