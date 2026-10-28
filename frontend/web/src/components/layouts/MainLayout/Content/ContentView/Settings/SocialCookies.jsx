import { useState, useRef } from 'react';
import useSocialCookies, { SOCIAL_PLATFORMS } from '../../../../../../hooks/useSocialCookies';
import Loading from '../../../../../common/Loading/Loading';
import CookieIcon from '../../../../../../assets/icons/CookieIcon';
import ChevronRight from '../../../../../../assets/icons/ChevronRight';
import FacebookIcon from '../../../../../../assets/icons/FacebookIcon';
import InstagramIcon from '../../../../../../assets/icons/InstagramIcon';
import TikTokIcon from '../../../../../../assets/icons/TikTokIcon';
import XIcon from '../../../../../../assets/icons/XIcon';
import YouTubeIcon from '../../../../../../assets/icons/YouTubeIcon';
import SocialCookieItem from './SocialCookieItem';
import './SocialCookies.css';

const ICON_MAP = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  x: XIcon,
  youtube: YouTubeIcon,
};

function SocialCookies({ onExpand }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef(null);

  const {
    cookiesData,
    editingPlatformId,
    draftCookies,
    readyToSaveState,
    checkingDraftPlatformId,
    isInitialChecking,
    draftErrors,
    handleToggleDrawer,
    handleDraftChange,
    handleCancel,
    handleSave,
    handleClear,
    handleUpdate,
    handleCheck,
    handleDrawerCheck,
  } = useSocialCookies();

  const handleToggle = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    if (nextState && onExpand && cardRef.current) {
      onExpand(cardRef.current);
    }
  };

  const hasExpiredCookies = Object.values(cookiesData || {}).some(
    (entry) => entry?.status === 'expired'
  );

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

        <div className="social-cookies-header__right">
          {!isExpanded && isInitialChecking && (
            <Loading text="" size="sm" className="social-cookies-header-loading" />
          )}
          {!isExpanded && !isInitialChecking && hasExpiredCookies && (
            <span
              className="social-cookies-header-badge"
              aria-label="Cookies expired warning"
            >
              !
            </span>
          )}
          <ChevronRight
            className={`social-cookies-chevron ${isExpanded ? 'social-cookies-chevron--expanded' : ''}`}
          />
        </div>
      </button>

      {/* Khối thân danh sách trượt mở/đóng 2 chiều */}
      <div className={`social-cookies-collapse ${isExpanded ? 'social-cookies-collapse--expanded' : ''}`}>
        <div className="social-cookies-collapse-inner">
          <div className="social-cookies-body">
            {SOCIAL_PLATFORMS.map((platform) => (
              <SocialCookieItem
                key={platform.id}
                platform={platform}
                Icon={ICON_MAP[platform.id]}
                cookieEntry={cookiesData[platform.id]}
                isEditing={editingPlatformId === platform.id}
                draftVal={draftCookies[platform.id]}
                isReadyToSave={readyToSaveState[platform.id]}
                isCheckingDraft={checkingDraftPlatformId === platform.id}
                hasDraftError={Boolean(draftErrors[platform.id])}
                onToggleDrawer={handleToggleDrawer}
                onDraftChange={handleDraftChange}
                onSave={handleSave}
                onCancel={handleCancel}
                onClear={handleClear}
                onUpdate={handleUpdate}
                onCheck={handleCheck}
                onDrawerCheck={handleDrawerCheck}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SocialCookies;
