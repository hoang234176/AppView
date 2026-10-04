import React from 'react';

const labels = { jpeg: 'JPG', jpg: 'JPG', tif: 'TIF', tiff: 'TIF', mpeg: 'MPG' };

export const fileTypeLabel = (filename, fallback = 'FILE') => {
  const clean = String(filename || '').split(/[?#]/, 1)[0].toLowerCase();
  const multi = clean.match(/\.(tar\.gz|tar\.bz2|tar\.xz)$/);
  const extension = multi?.[1] || clean.split('.').pop();
  if (!extension || extension === clean) return fallback;
  return (labels[extension] || extension.toUpperCase()).slice(0, 5);
};

export const isMultipartArchive = (taskOrFilename, url = '', isMultipart = false, totalParts = 0) => {
  if (isMultipart || totalParts > 1) return true;
  if (taskOrFilename && typeof taskOrFilename === 'object') {
    const obj = taskOrFilename;
    if (obj.is_multipart || obj.isMultipart || obj.archive_type === 'multipart' || obj.archiveType === 'multipart') return true;
    if (Number(obj.total_parts || obj.totalParts) > 1) return true;
    return isMultipartArchive(
      obj.filename || obj.displayName || '',
      obj.original_url || obj.url || obj.part_name || obj.partName || ''
    );
  }
  const str = `${taskOrFilename || ''} ${url || ''}`.toLowerCase();
  return (
    /\.part\d+(\.rar)?($|\s|[?#])/i.test(str) ||
    /\.7z\.\d+($|\s|[?#])/i.test(str) ||
    /\.z\d+($|\s|[?#])/i.test(str) ||
    /\.r\d+($|\s|[?#])/i.test(str) ||
    /\.\d{3}($|\s|[?#])/i.test(str)
  );
};

// File icon with a readable extension badge (ZIP/RAR/MP4/JPG…). It deliberately
// does not use a generic folder/archive glyph: the label is the file's real type.
export const FileTypeIcon = ({ filename, fallback, isMultipart = false, className = '' }) => {
  if (isMultipart || isMultipartArchive(filename)) {
    return <MultipartArchiveIcon className={className} />;
  }
  const label = fileTypeLabel(filename, fallback);
  const fontSize = label.length >= 5 ? 3.6 : label.length === 4 ? 4.1 : 4.8;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-label={label}>
      <path d="M7 2.75h6.8L19.5 8.5v11A1.75 1.75 0 0 1 17.75 21h-10A1.75 1.75 0 0 1 6 19.5v-15A1.75 1.75 0 0 1 7.75 2.75Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13.5 2.9v4.15a1.5 1.5 0 0 0 1.5 1.5h4.1" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <rect x="1.4" y="10.5" width="15.4" height="7.1" rx="1.35" fill="currentColor" />
      <text x="9.1" y="15.42" textAnchor="middle" fill="#fff" fontSize={fontSize} fontWeight="800" fontFamily="ui-sans-serif, system-ui, sans-serif">{label}</text>
    </svg>
  );
};

// MultipartArchiveIcon renders 3 stacked card layers matching FileTypeIcon geometry with depth and fold
export const MultipartArchiveIcon = ({ className = '', label = 'MULTI' }) => {
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
};

// MultipartBadge renders a prominent stacked card icon with multipart label
export const MultipartBadge = ({ className = '', count = 0 }) => (
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
);
