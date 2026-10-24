import { useState, useRef } from 'react';
import ServerIcon from '../../../../../../assets/icons/ServerIcon';
import ChevronRight from '../../../../../../assets/icons/ChevronRight';
import GlobeIcon from '../../../../../../assets/icons/GlobeIcon';
import PlugIcon from '../../../../../../assets/icons/PlugIcon';
import Loading from '../../../../../common/Loading/Loading';
import { checkCoordinatorHealth } from '../../../../../../api/coordinatorApi';
import './ServerConnection.css';

function ServerConnection({ host = '', setHost = () => {}, port = '', setPort = () => {}, onExpand }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hostError, setHostError] = useState(false);
  const [portError, setPortError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const cardRef = useRef(null);

  const handleConnect = async () => {
    const targetHost = host.trim();
    const targetPort = port.trim();

    let hasEmptyError = false;

    // Báo khung đỏ nếu để trống thay vì tự động lấy giá trị mặc định
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
      return;
    }

    // 1. Kiểm tra định dạng Host / IP
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(targetHost);
    if (isIPv4) {
      const parts = targetHost.split('.').map(Number);
      if (parts.some(p => p < 0 || p > 255)) {
        setHostError(true);
        window.alert('Địa chỉ IP không hợp lệ! Mỗi phần số phải nằm trong khoảng từ 0 đến 255.');
        return;
      }
    } else if (!/^[a-zA-Z0-9.-]+$/.test(targetHost)) {
      setHostError(true);
      window.alert('Địa chỉ Host/IP không hợp lệ! Vui lòng nhập địa chỉ IP hợp lệ (VD: 127.0.0.1) hoặc hostname (VD: localhost).');
      return;
    }

    // 2. Kiểm tra định dạng Port
    if (!/^\d+$/.test(targetPort)) {
      setPortError(true);
      window.alert('Cổng (Port) không hợp lệ! Vui lòng chỉ nhập ký tự số từ 1 đến 65535.');
      return;
    }
    const portNum = parseInt(targetPort, 10);
    if (portNum < 1 || portNum > 65535) {
      setPortError(true);
      window.alert('Cổng (Port) phải nằm trong khoảng từ 1 đến 65535.');
      return;
    }

    setIsConnecting(true);

    try {
      const [result] = await Promise.all([
        checkCoordinatorHealth(targetHost, targetPort),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);

      if (result.ok) {
        window.alert(
          `Kết nối thành công tới Coordinator Server!\n\n` +
          `- Địa chỉ: http://${targetHost}:${targetPort}\n` +
          `- Trạng thái: ${result.data?.status || 'ok'}\n` +
          `- Số worker đang kết nối: ${result.data?.workers ?? 0}`
        );
      } else {
        window.alert(
          `Không thể kết nối tới Coordinator Server tại http://${targetHost}:${targetPort}!\n\n` +
          `Chi tiết lỗi: ${result.error}`
        );
      }
    } catch (err) {
      window.alert(`Đã xảy ra lỗi không xác định khi kết nối: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  const handleToggle = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    if (nextState && onExpand && cardRef.current) {
      onExpand(cardRef.current);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`server-connection-card ${isExpanded ? 'server-connection-card--expanded' : ''}`}
    >
      <button
        type="button"
        className="server-connection-header"
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <div className="server-connection-header__left">
          <div className="server-connection-icon-wrapper">
            <ServerIcon className="server-connection-icon" />
          </div>
          <span className="server-connection-title">Connect Server</span>
        </div>

        <ChevronRight
          className={`server-connection-chevron ${isExpanded ? 'server-connection-chevron--expanded' : ''}`}
        />
      </button>

      {/* Khối thân danh sách xổ ra giống cây thư mục */}
      {isExpanded && (
        <div className="server-connection-body">
          {/* Hàng 1: Host */}
          <div className="server-connection-row">
            <div className="server-connection-row__left">
              <div className="server-connection-item-icon-box server-connection-item-icon-box--host">
                <GlobeIcon className="server-connection-item-icon" />
              </div>
              <label htmlFor="server-host-input" className="server-connection-label">
                Host
              </label>
            </div>

            <div className="server-connection-row__right">
              <input
                id="server-host-input"
                type="text"
                value={host}
                onChange={(e) => {
                  setHost(e.target.value);
                  if (hostError) setHostError(false);
                }}
                onKeyDown={handleKeyDown}
                placeholder="127.0.0.1"
                className={`server-connection-input ${hostError ? 'server-connection-input--error' : ''}`}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Hàng 2: Port & Connect */}
          <div className="server-connection-row">
            <div className="server-connection-row__left">
              <div className="server-connection-item-icon-box server-connection-item-icon-box--port">
                <PlugIcon className="server-connection-item-icon" />
              </div>
              <label htmlFor="server-port-input" className="server-connection-label">
                Port
              </label>
            </div>

            <div className="server-connection-row__right">
              <input
                id="server-port-input"
                type="text"
                value={port}
                onChange={(e) => {
                  setPort(e.target.value);
                  if (portError) setPortError(false);
                }}
                onKeyDown={handleKeyDown}
                placeholder="8090"
                className={`server-connection-input server-connection-input--port ${portError ? 'server-connection-input--error' : ''}`}
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="server-connection-btn"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                <span className="server-connection-btn__text">
                  {isConnecting ? (
                    <Loading text="" size="sm" className="server-connection-loading" />
                  ) : (
                    'Connect'
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServerConnection;
