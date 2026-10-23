import './Loading.css';

function Loading({ text = 'Loading...', size = 'md', className = '' }) {
  return (
    <div className={`common-loading common-loading--${size} ${className}`} role="status" aria-live="polite">
      <svg
        className="common-loading__spinner"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          className="common-loading__track"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="common-loading__indicator"
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {text && <span className="common-loading__text">{text}</span>}
    </div>
  );
}

export default Loading;
