import { useState, useMemo } from 'react';
import useLazyViewport from '../../../hooks/useLazyViewport';
import FolderPreviewIcon from '../../../assets/icons/FolderPreviewIcon';
import './MediaCard.css';

/**
 * Rút gọn tên 1 dòng dạng: tên....đuôi (giữ nguyên phần mở rộng)
 * Ví dụ: "[Facebook]_#cosplay #asiangirl.mp4" -> "[Facebook]_#co....mp4"
 */
function formatDisplayName(name, isFolder) {
  if (!name) return '';
  if (isFolder) return name;

  const lastDotIdx = name.lastIndexOf('.');
  if (lastDotIdx > 0 && lastDotIdx < name.length - 1) {
    const ext = name.slice(lastDotIdx);
    const base = name.slice(0, lastDotIdx);
    const maxBaseLen = 10;
    if (base.length > maxBaseLen) {
      return `${base.slice(0, maxBaseLen)}....${ext}`;
    }
  }
  return name;
}

/**
 * Biểu tượng tờ tài liệu gấp góc (macOS Dog-Ear Sheet) khi không tải được thumbnail
 */
function FoldedDocumentIcon({ type }) {
  const isVideo = type === 'video';

  return (
    <div className={`media-card__folded-doc media-card__folded-doc--${type}`}>
      <svg
        width="78"
        height="100"
        viewBox="0 0 70 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="media-card__folded-svg"
      >
        {/* Thân tờ tài liệu với góc vát trên bên phải */}
        <path
          d="M 6 0 H 54 L 70 16 V 84 A 6 6 0 0 1 64 90 H 6 A 6 6 0 0 1 0 84 V 6 A 6 6 0 0 1 6 0 Z"
          className="media-card__doc-body"
        />

        {/* Nếp gấp lật xuống (Dog-Ear Flap) */}
        <path
          d="M 54 0 V 12 A 4 4 0 0 0 58 16 H 70 Z"
          className="media-card__doc-flap"
        />

        {/* Biểu tượng nội dung bên trong tờ giấy */}
        {isVideo ? (
          <g transform="translate(19, 40)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="0" y="0" width="32" height="24" rx="3" className="media-card__doc-icon-stroke" />
            <path d="M13 7l8 5-8 5V7z" className="media-card__doc-icon-fill" />
          </g>
        ) : (
          <g transform="translate(19, 40)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="0" y="0" width="32" height="24" rx="3" className="media-card__doc-icon-stroke" />
            <circle cx="8" cy="8" r="2.5" className="media-card__doc-icon-stroke" />
            <path d="M32 17l-7-6-15 13" className="media-card__doc-icon-stroke" />
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * MediaCard - Component hiển thị Thư mục / Hình ảnh / Video
 * Hỗ trợ Khối Icon Dự phòng (Fallback) khi không tải được thumbnail
 */
function MediaCard({ item, isSelected = false, onClick, onDoubleClick }) {
  const [cardRef, isVisible] = useLazyViewport();
  const [imgError, setImgError] = useState(false);

  const isFolder = item?.type === 'folder';
  const isVideo = item?.type === 'video';
  const isPicture = item?.type === 'picture';

  const hasThumb = Boolean(item?.thumbnail_url || item?.url) && !imgError;

  const displayName = useMemo(() => {
    return formatDisplayName(item?.name, isFolder);
  }, [item?.name, isFolder]);

  if (!item) return null;

  return (
    <div
      ref={cardRef}
      className={`media-card media-card--${item.type} ${isSelected ? 'media-card--selected' : ''}`}
      onClick={(e) => onClick && onClick(item, e)}
      onDoubleClick={(e) => onDoubleClick && onDoubleClick(item, e)}
      title={item.name}
    >
      <div className="media-card__body">
        {isFolder && (
          <div className="media-card__folder-wrapper">
            <FolderPreviewIcon previews={item.previews} isVisible={isVisible} />
          </div>
        )}

        {isPicture && (
          hasThumb ? (
            isVisible ? (
              <img
                src={item.thumbnail_url || item.url}
                alt={item.name}
                loading="lazy"
                className="media-card__img"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="media-card__img-placeholder" aria-hidden="true" />
            )
          ) : (
            <FoldedDocumentIcon type="picture" />
          )
        )}

        {isVideo && (
          hasThumb ? (
            isVisible ? (
              <div className="media-card__video-wrapper">
                <img
                  src={item.thumbnail_url}
                  alt={item.name}
                  loading="lazy"
                  className="media-card__img"
                  onError={() => setImgError(true)}
                />
                <div className="media-card__play-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="media-card__img-placeholder" aria-hidden="true" />
            )
          ) : (
            <FoldedDocumentIcon type="video" />
          )
        )}
      </div>

      <div className="media-card__footer">
        <span className="media-card__name" title={item.name}>
          {displayName}
        </span>
      </div>
    </div>
  );
}

export default MediaCard;
