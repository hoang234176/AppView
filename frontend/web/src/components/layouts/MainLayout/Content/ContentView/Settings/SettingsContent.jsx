import { useState, useEffect, useRef } from 'react';
import useLayout from '../../../../../../hooks/useLayout';
import SettingsIcon from '../../../../../../assets/icons/SettingsIcon';
import ServerConnection from './ServerConnection';
import SocialCookies from './SocialCookies';
import CacheSettings from './CacheSettings';
import './SettingsContent.css';

function SettingsContent({ host, setHost, port, setPort }) {
  const { setHeaderTitleVisible } = useLayout();
  const isTitleVisibleRef = useRef(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Cuộn mượt đưa thẻ lên sát mép đỉnh khi mở rộng
  const handleCardExpand = (cardEl) => {
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (container && cardEl) {
        const containerRect = container.getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();
        const targetScrollTop = Math.max(0, cardRect.top - containerRect.top + container.scrollTop);
        container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      }
    });
  };

  // Đảm bảo reset trạng thái tiêu đề Header và timer khi rời trang Settings
  useEffect(() => {
    return () => {
      setHeaderTitleVisible(false);
      isTitleVisibleRef.current = false;
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, [setHeaderTitleVisible]);

  const handleScroll = (e) => {
    // 1. Kích hoạt hiển thị thanh cuộn khi đang cuộn, tự động ẩn sau 800ms dừng cuộn
    setIsScrolling(true);
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 800);

    // 2. Chỉ kích hoạt duy nhất 1 lần khi vượt qua hoặc quay lại mốc 115px để tránh spam render gây giật lag
    const isPastTitle = e.currentTarget.scrollTop > 115;
    if (isPastTitle !== isTitleVisibleRef.current) {
      isTitleVisibleRef.current = isPastTitle;
      setHeaderTitleVisible(isPastTitle);
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      className={`settings-content ${isScrolling ? 'is-scrolling' : ''}`}
      onScroll={handleScroll}
    >
      {/* Khung Hero Header lớn chuẩn phong cách macOS */}
      <div className="settings-hero-card">
        <div className="settings-hero-icon-wrapper">
          <SettingsIcon className="settings-hero-icon" />
        </div>
        <h1 className="settings-hero-title">Settings</h1>
        <p className="settings-hero-desc">
          Manage your overall setup and preferences for AppView, such as server connection, social media cookies, and caches.
        </p>
      </div>

      {/* Khối cấu hình kết nối Server */}
      <ServerConnection
        host={host}
        setHost={setHost}
        port={port}
        setPort={setPort}
        onExpand={handleCardExpand}
      />

      {/* Khối quản lý Cookies mạng xã hội */}
      <SocialCookies onExpand={handleCardExpand} />

      {/* Khối quản lý Cache trên web */}
      <CacheSettings onExpand={handleCardExpand} />

      {/* Khoảng trống đệm đáy không dùng padding/margin */}
      <div className="settings-content-spacer" aria-hidden="true" />
    </div>
  );
}

export default SettingsContent;
