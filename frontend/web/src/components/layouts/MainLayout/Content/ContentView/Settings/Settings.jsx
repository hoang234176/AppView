import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Settings.css';
import useLayout from '../../../../../../hooks/useLayout';
import Loading from '../../../../../common/Loading/Loading';
import SettingsContent from './SettingsContent';
import SettingsActions from './SettingsActions';

function Settings() {
  const { isSettingsClosing, closeSettings } = useLayout();
  const navigate = useNavigate();

  // Đọc cấu hình ban đầu từ key "setting" trong localStorage
  const [host, setHost] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('setting');
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed?.['connect-server']?.host || '';
        }
      }
    } catch {
      // Bỏ qua lỗi parse
    }
    return '';
  });

  const [port, setPort] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('setting');
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed?.['connect-server']?.port || '';
        }
      }
    } catch {
      // Bỏ qua lỗi parse
    }
    return '';
  });

  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const saveToLocalStorage = () => {
    try {
      let currentSetting = {};
      const raw = localStorage.getItem('setting');
      if (raw) {
        currentSetting = JSON.parse(raw) || {};
      }
      currentSetting['connect-server'] = {
        host: host.trim(),
        port: port.trim(),
      };
      localStorage.setItem('setting', JSON.stringify(currentSetting));
    } catch (e) {
      console.error('Error saving setting to localStorage', e);
    }
  };

  const handleSave = () => {
    if (isSaving) return;
    setIsSaving(true);
    saveToLocalStorage();

    timerRef.current = setTimeout(() => {
      setIsSaving(false);
    }, 400);
  };

  const handleSaveAndClose = () => {
    if (isSaving) return;
    setIsSaving(true);
    saveToLocalStorage();

    timerRef.current = setTimeout(() => {
      setIsSaving(false);
      closeSettings(() => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/');
        }
      });
    }, 400);
  };

  const handleClose = () => {
    if (isSaving) return;
    closeSettings(() => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    });
  };

  return (
    <div className={`settings-container ${isSettingsClosing ? 'settings-container--closing' : ''}`}>
      <div className="settings-content-wrapper">
        <SettingsContent
          host={host}
          setHost={setHost}
          port={port}
          setPort={setPort}
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
