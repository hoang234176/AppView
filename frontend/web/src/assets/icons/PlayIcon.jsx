export function PlayIcon({ className = '', width = 18, height = 18, ...props }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export default PlayIcon;
