import { memo, useState, useEffect, useRef } from 'react';
import { Plus, FolderPlus, Archive, Images } from 'lucide-react';
import { useFabSpeedDial } from '../../../../hooks/floatingAction';
import './FabSpeedDial.css';

/**
 * FabSpeedDial — Floating Action Button with Speed Dial options
 */
export const FabSpeedDial = memo(({
  onCreateFolder: propOnCreateFolder,
  onDownloadArchive: propOnDownloadArchive,
  onDownloadMedia: propOnDownloadMedia,
}) => {
  const hookData = useFabSpeedDial();
  const onCreateFolder = propOnCreateFolder || hookData.onCreateFolder;
  const onDownloadArchive = propOnDownloadArchive || hookData.onDownloadArchive;
  const onDownloadMedia = propOnDownloadMedia || hookData.onDownloadMedia;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (callback) => {
    setIsOpen(false);
    if (callback) callback();
  };

  return (
    <div ref={containerRef} className="fab-container">
      {/* SPEED DIAL OPTIONS (SLIDES OUT WHEN ACTIVE) */}
      {isOpen && (
        <div className="fab-options-list animate-speed-dial-enter">
          {/* OPTION 1: TẢI FILE NÉN */}
          <button
            type="button"
            onClick={() => handleAction(onDownloadArchive)}
            className="fab-option-btn fab-option-archive group"
          >
            <span className="fab-option-label">Tải file nén</span>
            <div className="fab-option-icon-badge fab-option-badge-archive">
              <Archive className="w-4 h-4" />
            </div>
          </button>

          {/* OPTION 2: TẢI ẢNH/VIDEO */}
          <button
            type="button"
            onClick={() => handleAction(onDownloadMedia)}
            title="Tải ảnh/video từ Facebook, TikTok, YouTube, Instagram, X"
            className="fab-option-btn fab-option-media group"
          >
            <span className="fab-option-label">Tải ảnh/video</span>
            <div className="fab-option-icon-badge fab-option-badge-media">
              <Images className="w-4 h-4" />
            </div>
          </button>

          {/* OPTION 3: TẠO THƯ MỤC */}
          <button
            type="button"
            onClick={() => handleAction(onCreateFolder)}
            className="fab-option-btn fab-option-folder group"
          >
            <span className="fab-option-label">Tạo thư mục</span>
            <div className="fab-option-icon-badge fab-option-badge-folder">
              <FolderPlus className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* MAIN FAB BUTTON (+) - ROTATES 45 DEGREES ON CLICK */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fab-main-btn ${isOpen ? 'fab-main-btn-open' : 'fab-main-btn-closed'}`}
        title={isOpen ? 'Đóng menu' : 'Thêm mới'}
      >
        <Plus className={`fab-main-icon ${isOpen ? 'fab-main-icon-rotated' : ''}`} />
      </button>
    </div>
  );
});

FabSpeedDial.displayName = 'FabSpeedDial';
