import { useState, useRef } from 'react';
import useCacheSettings from '../../../../../../hooks/useCacheSettings';
import CacheIcon from '../../../../../../assets/icons/CacheIcon';
import ChevronRight from '../../../../../../assets/icons/ChevronRight';
import ThumbnailIcon from '../../../../../../assets/icons/ThumbnailIcon';
import MediaIcon from '../../../../../../assets/icons/MediaIcon';
import TrashIcon from '../../../../../../assets/icons/TrashIcon';
import Loading from '../../../../../common/Loading/Loading';
import './CacheSettings.css';

const CACHE_ITEMS = [
  {
    id: 'thumbnails',
    name: 'Thumbnails',
    Icon: ThumbnailIcon,
    iconModifier: 'thumbnails',
  },
  {
    id: 'media',
    name: 'Media',
    Icon: MediaIcon,
    iconModifier: 'media',
  },
];

function CacheSettings({ onExpand }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef(null);
  const { cacheSizes, clearingState, refreshCacheSizes, clearCache } = useCacheSettings();

  const handleToggle = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    if (nextState) {
      refreshCacheSizes();
      if (onExpand && cardRef.current) {
        onExpand(cardRef.current);
      }
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

      {/* Khối thân danh sách trượt mở/đóng 2 chiều */}
      <div className={`cache-settings-collapse ${isExpanded ? 'cache-settings-collapse--expanded' : ''}`}>
        <div className="cache-settings-collapse-inner">
          <div className="cache-settings-body">
            {CACHE_ITEMS.map((item) => {
              const ItemIcon = item.Icon;
              const currentSize = cacheSizes[item.id] || '0 B';
              const isClearingItem = clearingState[item.id];

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
                    <span className="cache-settings-size">{currentSize}</span>
                    <button
                      type="button"
                      className="cache-settings-btn"
                      onClick={() => clearCache(item.id)}
                      disabled={isClearingItem}
                    >
                      <span className="cache-settings-btn__text">
                        {isClearingItem ? (
                          <Loading text="" size="sm" className="cache-settings-loading" />
                        ) : (
                          <>
                            <TrashIcon className="cache-settings-btn__icon" />
                            Clear
                          </>
                        )}
                      </span>
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
