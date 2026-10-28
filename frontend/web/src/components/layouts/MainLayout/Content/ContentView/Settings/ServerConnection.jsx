import { useState, useRef } from 'react';
import ServerIcon from '../../../../../../assets/icons/ServerIcon';
import ChevronRight from '../../../../../../assets/icons/ChevronRight';
import GlobeIcon from '../../../../../../assets/icons/GlobeIcon';
import PlugIcon from '../../../../../../assets/icons/PlugIcon';
import Loading from '../../../../../common/Loading/Loading';
import './ServerConnection.css';

function ServerConnection({
  host = '',
  setHost = () => {},
  port = '',
  setPort = () => {},
  hostError = false,
  portError = false,
  isConnecting = false,
  onConnect = () => {},
  onExpand,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onConnect();
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

      {/* Khối thân danh sách trượt mở/đóng 2 chiều */}
      <div className={`server-connection-collapse ${isExpanded ? 'server-connection-collapse--expanded' : ''}`}>
        <div className="server-connection-collapse-inner">
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
                  onChange={(e) => setHost(e.target.value)}
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
                  onChange={(e) => setPort(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="8090"
                  className={`server-connection-input server-connection-input--port ${portError ? 'server-connection-input--error' : ''}`}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="server-connection-btn"
                  onClick={onConnect}
                  disabled={isConnecting}
                >
                  <span className="server-connection-btn__text">
                    {isConnecting ? (
                      <Loading text="" size="sm" className="server-connection-loading" />
                    ) : (
                      <>
                        <PlugIcon className="server-connection-btn__icon" />
                        Connect
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServerConnection;
