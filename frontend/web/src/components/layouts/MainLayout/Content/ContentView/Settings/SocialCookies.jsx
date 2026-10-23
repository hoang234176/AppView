import { useState, useRef } from 'react';
import CookieIcon from '../../../../../../assets/icons/CookieIcon';
import ChevronRight from '../../../../../../assets/icons/ChevronRight';
import FacebookIcon from '../../../../../../assets/icons/FacebookIcon';
import InstagramIcon from '../../../../../../assets/icons/InstagramIcon';
import TikTokIcon from '../../../../../../assets/icons/TikTokIcon';
import XIcon from '../../../../../../assets/icons/XIcon';
import YouTubeIcon from '../../../../../../assets/icons/YouTubeIcon';
import './SocialCookies.css';

const SOCIAL_PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook',
    Icon: FacebookIcon,
    iconModifier: 'facebook',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    Icon: InstagramIcon,
    iconModifier: 'instagram',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    Icon: TikTokIcon,
    iconModifier: 'tiktok',
  },
  {
    id: 'x',
    name: 'X',
    Icon: XIcon,
    iconModifier: 'x',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    Icon: YouTubeIcon,
    iconModifier: 'youtube',
  },
];

function SocialCookies({ onExpand }) {
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
      className={`social-cookies-card ${isExpanded ? 'social-cookies-card--expanded' : ''}`}
    >
      <button
        type="button"
        className="social-cookies-header"
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <div className="social-cookies-header__left">
          <div className="social-cookies-icon-wrapper">
            <CookieIcon className="social-cookies-icon" />
          </div>
          <span className="social-cookies-title">Social Media Cookies</span>
        </div>

        <ChevronRight
          className={`social-cookies-chevron ${isExpanded ? 'social-cookies-chevron--expanded' : ''}`}
        />
      </button>

      {/* Khối trượt đóng/mở mượt mà chuẩn Zero-Leak */}
      <div
        className={`social-cookies-collapse ${isExpanded ? 'social-cookies-collapse--expanded' : ''}`}
        inert={!isExpanded}
      >
        <div className="social-cookies-collapse-inner">
          <div className="social-cookies-body">
            {SOCIAL_PLATFORMS.map((platform) => {
              const PlatformIcon = platform.Icon;
              return (
                <div key={platform.id} className="social-cookies-row">
                  {/* Cột trái: Icon thương hiệu và tên mạng xã hội */}
                  <div className="social-cookies-row__left">
                    <div className={`social-platform-icon-box social-platform-icon-box--${platform.iconModifier}`}>
                      <PlatformIcon className="social-platform-icon" />
                    </div>
                    <span className="social-platform-name">{platform.name}</span>
                  </div>

                  {/* Cột giữa: Huy hiệu trạng thái */}
                  <div className="social-cookies-row__status">
                    <span className="social-status-badge social-status-badge--empty">
                      Not Set
                    </span>
                  </div>

                  {/* Cột phải: Các nút thao tác Import và Check */}
                  <div className="social-cookies-row__actions">
                    <button
                      type="button"
                      className="social-cookies-btn social-cookies-btn--import"
                    >
                      <span className="social-cookies-btn__text">Import</span>
                    </button>
                    <button
                      type="button"
                      className="social-cookies-btn social-cookies-btn--check"
                    >
                      <span className="social-cookies-btn__text">Check</span>
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

export default SocialCookies;
