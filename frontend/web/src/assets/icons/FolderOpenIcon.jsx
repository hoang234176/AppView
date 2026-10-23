export function FolderOpenIcon({ className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2" />
      <path d="M3 19l2.2-7.5a1.5 1.5 0 0 1 1.44-1h13.72a1 1 0 0 1 .96 1.28L19 19H3z" />
    </svg>
  );
}

export default FolderOpenIcon;
