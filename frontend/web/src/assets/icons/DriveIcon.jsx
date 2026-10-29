export function DriveIcon({ type = 'ssd', className = '', ...props }) {
  const isHdd =
    String(type).toLowerCase().includes('hdd') ||
    String(type).toLowerCase().includes('hard');

  // 1. Icon HDD: Khung viền bo góc, 4 lỗ ốc vòng khuyên rỗng, đĩa từ lớn, kim đọc giọt nước rỗng hướng tâm
  if (isHdd) {
    return (
      <svg
        viewBox="0 0 156 184"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...props}
      >
        <rect x="3" y="3" width="150" height="178" rx="18" />
        <line x1="46" y1="23" x2="110" y2="23" strokeWidth="6.5" />
        <circle cx="23" cy="23" r="7" strokeWidth="5" />
        <circle cx="133" cy="23" r="7" strokeWidth="5" />
        <circle cx="23" cy="161" r="7" strokeWidth="5" />
        <circle cx="133" cy="161" r="7" strokeWidth="5" />
        <circle cx="78" cy="96" r="51" />
        <circle cx="78" cy="96" r="13" />
        <path d="M 90 106 L 131 133 C 137 139 133 149 125 153 C 117 157 107 151 103 143 Z" />
      </svg>
    );
  }

  // 2. Icon SSD: Khung viền bo góc, 4 lỗ ốc vòng khuyên rỗng, 7 chân tiếp xúc ở khay trên, nhãn bo góc lớn & chữ SSD đậm
  return (
    <svg
      viewBox="0 0 156 184"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="150" height="178" rx="18" />
      <circle cx="23" cy="23" r="7" strokeWidth="5" />
      <circle cx="133" cy="23" r="7" strokeWidth="5" />
      <circle cx="23" cy="161" r="7" strokeWidth="5" />
      <circle cx="133" cy="161" r="7" strokeWidth="5" />
      <line x1="45" y1="23" x2="111" y2="23" strokeWidth="5.5" />
      <line x1="50" y1="3" x2="50" y2="23" strokeWidth="4.5" />
      <line x1="60" y1="3" x2="60" y2="23" strokeWidth="4.5" />
      <line x1="70" y1="3" x2="70" y2="23" strokeWidth="4.5" />
      <line x1="80" y1="3" x2="80" y2="23" strokeWidth="4.5" />
      <line x1="90" y1="3" x2="90" y2="23" strokeWidth="4.5" />
      <line x1="100" y1="3" x2="100" y2="23" strokeWidth="4.5" />
      <line x1="106" y1="3" x2="106" y2="23" strokeWidth="4.5" />
      <rect x="23" y="54" width="110" height="93" rx="14" />
      <text
        x="78"
        y="116"
        textAnchor="middle"
        fontSize="36"
        fontWeight="800"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
        fill="currentColor"
        stroke="none"
        letterSpacing="1"
      >
        SSD
      </text>
    </svg>
  );
}

export default DriveIcon;
