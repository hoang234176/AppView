export function MediaIcon({ className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <line x1="2" y1="8" x2="22" y2="8" />
      <line x1="2" y1="16" x2="22" y2="16" />
      <line x1="6" y1="4" x2="6" y2="8" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <line x1="18" y1="4" x2="18" y2="8" />
      <line x1="6" y1="16" x2="6" y2="20" />
      <line x1="12" y1="16" x2="12" y2="20" />
      <line x1="18" y1="16" x2="18" y2="20" />
    </svg>
  );
}

export default MediaIcon;
