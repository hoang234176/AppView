import { useState, useRef } from 'react';
import CacheIcon from '../../../../../../assets/icons/CacheIcon';
import ChevronRight from '../../../../../../assets/icons/ChevronRight';
import ThumbnailIcon from '../../../../../../assets/icons/ThumbnailIcon';
import MediaIcon from '../../../../../../assets/icons/MediaIcon';
import './CacheSettings.css';

const CACHE_ITEMS = [
  {
    id: 'thumbnails',
    name: 'Thumbnails',
    size: '0 B',
    Icon: ThumbnailIcon,
    iconModifier: 'thumbnails',
  },
  {
    id: 'media',
    name: 'Media',
    size: '0 B',
    Icon: MediaIcon,
    iconModifier: 'media',
  },
];

function CacheSettings({ onExpand }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef(null);

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
      className={`cache-settings-card ${isExpanded ? 'cache-settings-card--expanded' : ''}`}
    >
      <button
        type="button"
        className="cache-settings-header"
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <div className="cache-settings-header__left">
          <div className="cache-settings-icon-wrapper">
            <CacheIcon className="cache-settings-icon" />
          </div>
          <span className="cache-settings-title">Caches</span>
        </div>

        <ChevronRight
          className={`cache-settings-chevron ${isExpanded ? 'cache-settings-chevron--expanded' : ''}`}
        />
      </button>

      {/* Khối trượt đóng/mở mượt mà chuẩn Zero-Leak */}
      <div
        className={`cache-settings-collapse ${isExpanded ? 'cache-settings-collapse--expanded' : ''}`}
        inert={!isExpanded}
      >
        <div className="cache-settings-collapse-inner">
          <div className="cache-settings-body">
            {CACHE_ITEMS.map((item) => {
              const ItemIcon = item.Icon;
              return (
                <div key={item.id} className="cache-settings-row">
                  {/* Cột trái: Icon và tên loại Cache */}
                  <div className="cache-settings-row__left">
                    <div className={`cache-item-icon-box cache-item-icon-box--${item.iconModifier}`}>
                      <ItemIcon className="cache-item-icon" />
                    </div>
                    <span className="cache-settings-name">{item.name}</span>
                  </div>

                  {/* Khu vực bên phải: Dung lượng và nút Clear */}
                  <div className="cache-settings-row__right">
                    <span className="cache-settings-size">{item.size}</span>
                    <button
                      type="button"
                      className="cache-settings-btn"
                    >
                      <span className="cache-settings-btn__text">Clear</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CacheSettings;
