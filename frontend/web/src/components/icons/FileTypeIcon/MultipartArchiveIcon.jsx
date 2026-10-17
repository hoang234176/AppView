import { memo } from 'react';

/**
 * MultipartArchiveIcon renders 3 stacked card layers matching FileTypeIcon geometry with depth and fold
 */
export const MultipartArchiveIcon = memo(({ className = '', label = 'MULTI' }) => {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Multipart Archive">
      {/* Background card (deepest layer - shifted up-right) */}
      <g transform="translate(3, -2.5)" opacity="0.45">
        <path
          d="M7 2.75h6.8L19.5 8.5v11A1.75 1.75 0 0 1 17.75 21h-10A1.75 1.75 0 0 1 6 19.5v-15A1.75 1.75 0 0 1 7.75 2.75Z"
          fill="#13141c"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </g>
      {/* Middle card (shifted center) */}
      <g transform="translate(1.5, -1.25)" opacity="0.75">
        <path
          d="M7 2.75h6.8L19.5 8.5v11A1.75 1.75 0 0 1 17.75 21h-10A1.75 1.75 0 0 1 6 19.5v-15A1.75 1.75 0 0 1 7.75 2.75Z"
          fill="#1a1c26"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
      {/* Front card (main foreground layer) */}
      <g>
        <path
          d="M7 2.75h6.8L19.5 8.5v11A1.75 1.75 0 0 1 17.75 21h-10A1.75 1.75 0 0 1 6 19.5v-15A1.75 1.75 0 0 1 7.75 2.75Z"
          fill="#222634"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M13.5 2.9v4.15a1.5 1.5 0 0 0 1.5 1.5h4.1"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        {/* Multipart badge banner */}
        <rect x="1.4" y="10.5" width="15.4" height="7.1" rx="1.35" fill="currentColor" />
        <text
          x="9.1"
          y="15.42"
          textAnchor="middle"
          fill="#fff"
          fontSize={label.length >= 5 ? 3.6 : 4.1}
          fontWeight="800"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {label}
        </text>
      </g>
    </svg>
  );
});

MultipartArchiveIcon.displayName = 'MultipartArchiveIcon';
