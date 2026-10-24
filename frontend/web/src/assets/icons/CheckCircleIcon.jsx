export function CheckCircleIcon({ className = '', ...props }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l2.5 2.5 5.5-5.5" />
    </svg>
  );
}

export default CheckCircleIcon;
