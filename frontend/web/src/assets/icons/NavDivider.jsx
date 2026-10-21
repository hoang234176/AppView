export function NavDivider({ className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 1 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <line x1="0.5" y1="0" x2="0.5" y2="16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export default NavDivider;
