import { useState } from 'react';
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
 * FolderPreviewIcon - Icon Thư mục chuẩn phong cách macOS Big Sur / Sonoma (1:1 chuẩn Apple)
 * Có gradient đa tầng, highlight ánh sáng viền mép và bóng đổ chân thực
 *
 * @param {Array<string>} previews - Danh sách link ảnh thumbnail
 * @param {string} className - Class CSS mở rộng
 */
export function FolderPreviewIcon({
  previews = [],
  className = '',
  isVisible = true,
  onContextMenu,
  ...props
}) {
  const hasPreviews = Array.isArray(previews) && previews.length > 0;

  return (
    <div
      className={`folder-preview-icon ${className}`.trim()}
      onContextMenu={onContextMenu}
      {...props}
    >
      {/* Định nghĩa Gradient ánh sáng macOS */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          {/* Gradient nắp sau (Back Flap) */}
          <linearGradient id="macFolderBackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#45a2e7" />
            <stop offset="35%" stopColor="#2c89db" />
            <stop offset="100%" stopColor="#1a6ebd" />
          </linearGradient>

          {/* Gradient vạt trước (Front Flap) */}
          <linearGradient id="macFolderFrontGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64c6f9" />
            <stop offset="22%" stopColor="#55bcf6" />
            <stop offset="70%" stopColor="#3d9ee8" />
            <stop offset="100%" stopColor="#318fe0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Lớp tab sau folder (Back flap chuẩn đường lượn chữ S macOS) */}
      <svg viewBox="0 0 104 88" fill="none" className="folder-preview-icon__svg-back">
        <path
          d="M 5 20
             C 5 13 8 8 15 8
             H 35
             C 40 8 43 12 46 15
             L 48 17
             C 51 20 54 20 58 20
             H 93
             C 99 20 102 24 102 30
             V 74
             C 102 80 98 84 92 84
             H 15
             C 9 84 5 80 5 74
             Z"
          fill="url(#macFolderBackGrad)"
        />
      </svg>

      {/* Khối thumbnail kẹp bên trong folder (chỉ mount ảnh khi nằm trong khung nhìn/vùng đệm overscan) */}
      {hasPreviews && (
        <div className="folder-preview-icon__pocket">
          {isVisible ? (
            previews.length >= 2 ? (
              <>
                <SheetPhoto src={previews[1]} slotType="back" />
                <SheetPhoto src={previews[0]} slotType="front" />
              </>
            ) : (
              <SheetPhoto src={previews[0]} slotType="single" />
            )
          ) : null}
        </div>
      )}

      {/* Lớp vạt trước folder (Hạ thấp xuống y=35 khi có thumbnail để lộ ảnh bên trong, hoặc y=24 khi folder rỗng) */}
      <svg viewBox="0 0 104 88" fill="none" className="folder-preview-icon__svg-front">
        {hasPreviews ? (
          <>
            <path
              d="M 5 46
                 C 5 39 9 35 16 35
                 H 92
                 C 99 35 103 39 103 46
                 V 75
                 C 103 82 99 86 92 86
                 H 16
                 C 9 86 5 82 5 75
                 Z"
              fill="url(#macFolderFrontGrad)"
            />
            {/* Viền ánh sáng mảnh (Highlight) ở mép trên vạt trước */}
            <path
              d="M 16 35.8 H 92"
              stroke="rgba(255, 255, 255, 0.58)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <path
              d="M 5 35
                 C 5 28 9 24 16 24
                 H 92
                 C 99 24 103 28 103 35
                 V 75
                 C 103 82 99 86 92 86
                 H 16
                 C 9 86 5 82 5 75
                 Z"
              fill="url(#macFolderFrontGrad)"
            />
            {/* Viền ánh sáng mảnh (Highlight) ở mép trên vạt trước */}
            <path
              d="M 14 24.8 H 94"
              stroke="rgba(255, 255, 255, 0.58)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </>
        )}
        {/* Viền bóng đáy nhẹ */}
        <path
          d="M 14 85.5 H 94"
          stroke="rgba(0, 0, 0, 0.12)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default FolderPreviewIcon;
