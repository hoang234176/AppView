import { useState } from 'react';
import FolderIcon from './FolderIcon';
import './FolderPreviewIcon.css';

/**
 * Tấm ảnh thumbnail thông minh tự nhận biết ảnh ngang (landscape) hay ảnh dọc (portrait)
 */
function SheetPhoto({ src, slotType = 'single', alt = '' }) {
  const [orientation, setOrientation] = useState('portrait');

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight && naturalWidth > naturalHeight) {
      setOrientation('landscape');
    } else {
      setOrientation('portrait');
    }
  };

  return (
    <div
      className={`folder-preview-icon__sheet folder-preview-icon__sheet--${slotType} folder-preview-icon__sheet--${orientation}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={handleImageLoad}
        className="folder-preview-icon__img"
      />
    </div>
  );
}

/**
 * FolderPreviewIcon - Icon Thư mục chứa Thumbnail nhô cao lộ ~75% ảnh (Phương án 1)
 * Tự động căn chỉnh bố cục theo ảnh ngang/dọc
 *
 * @param {Array<string>} previews - Danh sách link ảnh thumbnail
 * @param {string} className - Class CSS mở rộng
 */
export function FolderPreviewIcon({ previews = [], className = '' }) {
  const hasPreviews = Array.isArray(previews) && previews.length > 0;

  return (
    <div className={`folder-preview-icon ${className}`.trim()}>
      {/* Lớp tab sau folder (Back flap màu xanh đậm) */}
      <svg viewBox="0 0 88 74" fill="none" className="folder-preview-icon__svg-back">
        <path
          d="M4 16C4 12.6863 6.68629 10 10 10H32L40 17H78C81.3137 17 84 19.6863 84 23V64C84 67.3137 81.3137 70 78 70H10C6.68629 70 4 67.3137 4 64V16Z"
          fill="#1a6ddb"
        />
      </svg>

      {/* Khối thumbnail kẹp bên trong folder */}
      {hasPreviews ? (
        <div className="folder-preview-icon__pocket">
          {previews.length >= 2 ? (
            <>
              <SheetPhoto src={previews[1]} slotType="back" />
              <SheetPhoto src={previews[0]} slotType="front" />
            </>
          ) : (
            <SheetPhoto src={previews[0]} slotType="single" />
          )}
        </div>
      ) : (
        <div className="folder-preview-icon__empty">
          <FolderIcon className="folder-preview-icon__empty-glyph" />
        </div>
      )}

      {/* Lớp vạt trước folder (Front flap che 40% chân ảnh, không trong suốt) */}
      <svg viewBox="0 0 88 74" fill="none" className="folder-preview-icon__svg-front">
        <path
          d="M4 36C4 32.6863 6.68629 30 10 30H78C81.3137 30 84 32.6863 84 36V64C84 67.3137 81.3137 70 78 70H10C6.68629 70 4 67.3137 4 64V36Z"
          fill="#388bfd"
        />
        <path
          d="M10 30.5H78C80.8 30.5 83.5 32.8 83.5 36V37H4.5V36C4.5 32.8 7.2 30.5 10 30.5Z"
          fill="white"
          fillOpacity="0.25"
        />
      </svg>
    </div>
  );
}

export default FolderPreviewIcon;
