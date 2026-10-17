import { memo } from 'react';

/**
 * MultipartBadge renders a prominent stacked card badge icon with multipart label
 */
export const MultipartBadge = memo(({ className = '', count = 0 }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 shadow-sm flex-shrink-0 ${className}`}
    title={`Tệp nén chia thành ${count > 0 ? `${count} phần` : 'nhiều phần'}`}
  >
    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M6 1.5h5l3 3v6a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" fill="#1e1b4b" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M4 3.5h5l3 3v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" fill="#312e81" stroke="currentColor" strokeWidth="1.1" opacity="0.8" />
      <path d="M2 5.5h5l3 3v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" fill="#3730a3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
    <span>Multipart{count > 0 ? ` (${count} part)` : ''}</span>
  </span>
));

MultipartBadge.displayName = 'MultipartBadge';
