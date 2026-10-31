export function NewFolderIcon({ className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 7.5V5a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.2.6L10 6h3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 7.5v10A1.5 1.5 0 003.5 19h15a1.5 1.5 0 001.5-1.5v-6.5" />
      <circle cx="18" cy="7.5" r="3.75" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 5.75v3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.25 7.5h3.5" />
    </svg>
  );
}

export default NewFolderIcon;
