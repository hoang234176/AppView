import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import './MoreButton.css';
import MoreIcon from '../../../../assets/icons/MoreIcon';

const SORT_OPTIONS = [
  { id: 'none', label: 'None' },
  { divider: true },
  { id: 'name', label: 'Name' },
  { id: 'kind', label: 'Kind' },
  { id: 'date_last_opened', label: 'Date Last Opened' },
  { id: 'date_added', label: 'Date Added' },
  { id: 'date_modified', label: 'Date Modified' },
  { id: 'date_created', label: 'Date Created' },
  { id: 'size', label: 'Size' },
];

function MoreButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [triggerType, setTriggerType] = useState('button'); // 'button' | 'contextmenu'
  const [isSortSubmenuOpen, setIsSortSubmenuOpen] = useState(false);
  const [activeSort, setActiveSort] = useState('name');
  const [submenuSide, setSubmenuSide] = useState('right'); // 'right' | 'left'

  const location = useLocation();
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setIsOpen(false);
    setIsSortSubmenuOpen(false);
  }

  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const sortItemRef = useRef(null);

  // Lắng nghe sự kiện mở menu từ click chuột trái trong main-content hoặc yêu cầu đóng
  useEffect(() => {
    const handleOpenContextMenu = (e) => {
      const { clientX, clientY } = e.detail;
      const menuWidth = 240;
      const approxHeight = 150;

      const x = Math.min(clientX, window.innerWidth - menuWidth - 12);
      const y = Math.min(clientY, window.innerHeight - approxHeight - 12);

      setTriggerType('contextmenu');
      setMenuPos({ x: Math.max(12, x), y: Math.max(12, y) });
      setIsOpen(true);
      setIsSortSubmenuOpen(false);
    };

    const handleCloseContextMenu = () => {
      setIsOpen(false);
      setIsSortSubmenuOpen(false);
    };

    window.addEventListener('open-more-menu', handleOpenContextMenu);
    window.addEventListener('close-more-menu', handleCloseContextMenu);
    return () => {
      window.removeEventListener('open-more-menu', handleOpenContextMenu);
      window.removeEventListener('close-more-menu', handleCloseContextMenu);
    };
  }, []);

  // Đóng menu khi click ra ngoài, cuộn trang hoặc bấm Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (buttonRef.current && buttonRef.current.contains(e.target)) return;

      setIsOpen(false);
      setIsSortSubmenuOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsSortSubmenuOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
      setIsSortSubmenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(prev => {
      if (!prev) {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const menuWidth = 240;
          // Tâm của nút 3 chấm
          const buttonCenterX = rect.left + rect.width / 2;
          // Mũi tên nằm cách lề phải 22px, rộng 12px (tâm mũi tên cách lề phải 28px)
          // Để tâm mũi tên trỏ đúng vào tâm nút 3 chấm:
          let targetX = buttonCenterX - menuWidth + 28;
          targetX = Math.min(targetX, window.innerWidth - menuWidth - 12);
          targetX = Math.max(12, targetX);
          const y = rect.bottom + 8;
          setMenuPos({ x: targetX, y });
        }
        setTriggerType('button');
        setIsSortSubmenuOpen(false);
        return true;
      }
      setIsSortSubmenuOpen(false);
      return false;
    });
  };

  // Tính toán hướng mở của submenu (phải hoặc trái tùy theo vị trí màn hình)
  const handleSortMouseEnter = useCallback(() => {
    if (sortItemRef.current) {
      const rect = sortItemRef.current.getBoundingClientRect();
      const submenuWidth = 220;
      // Nếu mở sang phải bị tràn mép màn hình thì mở sang trái
      if (rect.right + submenuWidth > window.innerWidth - 12) {
        setSubmenuSide('left');
      } else {
        setSubmenuSide('right');
      }
    }
    setIsSortSubmenuOpen(true);
  }, []);

  const handleSortClick = (sortId) => {
    setActiveSort(sortId);
    setIsOpen(false);
    setIsSortSubmenuOpen(false);
  };

  const handleNewFolder = () => {
    setIsOpen(false);
    setIsSortSubmenuOpen(false);
  };

  const handleGetInfo = () => {
    setIsOpen(false);
    setIsSortSubmenuOpen(false);
  };

  return (
    <div className="header-more-wrapper">
      <button
        ref={buttonRef}
        type="button"
        className={`header-more-btn ${isOpen ? 'header-more-btn--active' : ''}`}
        aria-label="Tùy chọn khác"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={handleToggle}
      >
        <MoreIcon />
      </button>

      {/* Menu thả xuống chuẩn phong cách macOS Finder qua Portal */}
      {isOpen && menuPos && createPortal(
        <div
          ref={menuRef}
          className="header-more-menu header-more-menu--portal"
          role="menu"
          style={{
            left: `${menuPos.x}px`,
            top: `${menuPos.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mũi tên ^ chỉ vào nút 3 chấm khi mở từ Header (cách lề phải 22px) */}
          {triggerType === 'button' && (
            <div className="header-more-menu__caret" aria-hidden="true" />
          )}

          {/* Lựa chọn 1: New Folder (chuẩn macOS folder.badge.plus) */}
          <button
            type="button"
            className="header-more-menu__item"
            role="menuitem"
            onClick={handleNewFolder}
          >
            <span className="header-more-menu__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 7.5V5a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.2.6L10 6h3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 7.5v10A1.5 1.5 0 003.5 19h15a1.5 1.5 0 001.5-1.5v-6.5" />
                <circle cx="18" cy="7.5" r="3.75" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 5.75v3.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.25 7.5h3.5" />
              </svg>
            </span>
            <span className="header-more-menu__label">New Folder</span>
          </button>

          {/* Lựa chọn 2: Get Info */}
          <button
            type="button"
            className="header-more-menu__item"
            role="menuitem"
            onClick={handleGetInfo}
          >
            <span className="header-more-menu__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5m0-8h.01" />
              </svg>
            </span>
            <span className="header-more-menu__label">Get Info</span>
          </button>

          {/* Lựa chọn 3: Sort By (có Submenu) */}
          <div
            ref={sortItemRef}
            className={`header-more-menu__item header-more-menu__item--has-submenu ${
              isSortSubmenuOpen ? 'header-more-menu__item--submenu-active' : ''
            }`}
            onMouseEnter={handleSortMouseEnter}
            onMouseLeave={() => setIsSortSubmenuOpen(false)}
            onClick={() => setIsSortSubmenuOpen(prev => !prev)}
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={isSortSubmenuOpen}
          >
            <span className="header-more-menu__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </span>
            <span className="header-more-menu__label">Sort By</span>
            <span className="header-more-menu__chevron" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </span>

            {/* Submenu của Sort By */}
            {isSortSubmenuOpen && (
              <div
                className={`header-more-submenu header-more-submenu--${submenuSide}`}
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                {SORT_OPTIONS.map((item, idx) => {
                  if (item.divider) {
                    return <div key={`divider-${idx}`} className="header-more-menu__divider" />;
                  }

                  const isSelected = activeSort === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`header-more-submenu__item ${
                        isSelected ? 'header-more-submenu__item--selected' : ''
                      }`}
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => handleSortClick(item.id)}
                    >
                      <span className="header-more-submenu__check" aria-hidden="true">
                        {isSelected && (
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <span className="header-more-submenu__label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default MoreButton;
