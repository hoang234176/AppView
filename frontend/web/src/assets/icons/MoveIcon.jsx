export function MoveIcon({ className = '', ...props }) {
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
      <path d="M2 18V5a2 2 0 0 1 2-2h5l2 2.5h9a2 2 0 0 1 2 2V10" />
      <path d="M11 18h11" />
      <path d="M18 14l4 4-4 4" />
    </svg>
  );
}

export default MoveIcon;
