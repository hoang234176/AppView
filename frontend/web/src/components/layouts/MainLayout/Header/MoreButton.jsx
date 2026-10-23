import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [isSortSubmenuOpen, setIsSortSubmenuOpen] = useState(false);
  const [activeSort, setActiveSort] = useState('name');
  const [submenuSide, setSubmenuSide] = useState('right'); // 'right' | 'left'

  const containerRef = useRef(null);
  const sortItemRef = useRef(null);

  // Đóng menu khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsSortSubmenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsSortSubmenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(prev => {
      if (prev) {
        setIsSortSubmenuOpen(false);
      }
      return !prev;
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
    <div className="header-more-wrapper" ref={containerRef}>
      <button
        type="button"
        className={`header-more-btn ${isOpen ? 'header-more-btn--active' : ''}`}
        aria-label="Tùy chọn khác"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={handleToggle}
      >
        <MoreIcon />
      </button>

      {/* Menu thả xuống chuẩn phong cách macOS Finder */}
      {isOpen && (
        <div className="header-more-menu" role="menu">
          {/* Lựa chọn 1: New Folder */}
          <button
            type="button"
            className="header-more-menu__item"
            role="menuitem"
            onClick={handleNewFolder}
          >
            <span className="header-more-menu__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m-3-3h6m-9-7h4.382a1.5 1.5 0 011.06.44l1.118 1.12a1.5 1.5 0 001.06.44H20a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z" />
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
        </div>
      )}
    </div>
  );
}

export default MoreButton;
