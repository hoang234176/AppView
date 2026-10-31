/**
 * Biểu tượng tờ tài liệu gấp góc (macOS Dog-Ear Sheet) khi không tải được thumbnail
 */
export function FoldedDocIcon({ type = 'picture', className = '', ...props }) {
  const isVideo = type === 'video';

  return (
    <div className={`media-card__folded-doc media-card__folded-doc--${type} ${className}`.trim()} {...props}>
      <svg
        width="78"
        height="100"
        viewBox="0 0 70 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="media-card__folded-svg"
        aria-hidden="true"
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

export default FoldedDocIcon;
