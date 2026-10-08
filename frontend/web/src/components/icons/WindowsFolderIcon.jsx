import { useState, useEffect } from 'react';

/**
 * Windows-style SVG folder icon with compact, balanced height.
 *
 * @param {Array<string>} previews - Array of thumbnail image URLs (0, 1, or 2 items).
 * @param {string} className - Optional container styling classes.
 * @param {boolean} isHovered - External hover trigger (e.g. from parent card).
 * @param {number} size - Base icon dimension in pixels (width, default: 105).
 * @param {'fixed' | 'adaptive'} mode - Photo card calculation mode:
 *   - 'fixed': Fixed portrait 3:4 polaroid cards.
 *   - 'adaptive': Automatically detects whether each image is portrait or landscape and adjusts card ratio.
 */
export const WindowsFolderIcon = ({
  previews = [],
  className = '',
  isHovered: externalHovered,
  size = 105,
  mode = 'fixed',
}) => {
  const [internalHovered, setInternalHovered] = useState(false);
  const isHovered = externalHovered !== undefined ? externalHovered : internalHovered;

  const validPreviews = Array.isArray(previews) ? previews.filter(Boolean).slice(0, 2) : [];
  const hasPreviews = validPreviews.length > 0;

  // Track natural image aspect ratios for 'adaptive' mode
  const [imgRatios, setImgRatios] = useState({});

  useEffect(() => {
    setImgRatios({});
  }, [validPreviews[0], validPreviews[1]]);

  const handleImageLoad = (idx, e) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) {
      const ratio = naturalWidth / naturalHeight;
      setImgRatios((prev) => ({
        ...prev,
        [idx]: ratio > 1.15 ? 'landscape' : 'portrait',
      }));
    }
  };

  // Compact height proportion: 100w -> 90h
  const iconWidth = size;
  const iconHeight = Math.round((size * 90) / 100);

  return (
    <div
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{ width: iconWidth, height: iconHeight }}
      onMouseEnter={() => setInternalHovered(true)}
      onMouseLeave={() => setInternalHovered(false)}
    >
      {/* ============================================================ */}
      {/* LAYER 1: BACK PLATE (COMPACT SVG)                            */}
      {/* ============================================================ */}
      <svg
        viewBox="0 0 100 92"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full drop-shadow-md transition-transform duration-300"
      >
        <defs>
          <linearGradient id="winVertFolderBack" x1="10" y1="10" x2="90" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DF9600" />
            <stop offset="45%" stopColor="#C87F00" />
            <stop offset="100%" stopColor="#AF6B00" />
          </linearGradient>

          <radialGradient id="vertPocketShadow" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
          </radialGradient>
        </defs>

        {/* Back plate body with tab (height ends at y=86) */}
        <path
          d="M12 16 C12 12.5 14.5 10 18 10 H44 C47 10 49.5 12 51.5 14.8 L53.5 17 H84 C88.4 17 92 20.6 92 25 V78 C92 82.4 88.4 86 84 86 H16 C11.6 86 8 82.4 8 78 V21 C8 19 9.8 16 12 16 Z"
          fill="url(#winVertFolderBack)"
        />

        {/* Tab top highlight rim */}
        <path
          d="M18 11 H44 C46.5 11 48.8 12.8 50.4 14.8 L52.5 17.5"
          stroke="#FFE699"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity="0.75"
        />

        {/* Interior pocket slit shadow when folder contains photos */}
        {hasPreviews && (
          <path
            d="M12 22 H88 C90 22 91 23.5 91 25.5 V46 H9 V25.5 C9 23.5 10 22 12 22 Z"
            fill="url(#vertPocketShadow)"
          />
        )}
      </svg>

      {/* ============================================================ */}
      {/* LAYER 2: PHOTO THUMBNAIL PREVIEWS                             */}
      {/* ============================================================ */}
      {hasPreviews && (
        <div className="absolute inset-x-0 top-0 bottom-[20%] flex items-center justify-center pointer-events-none z-10">
          {validPreviews.length === 1 ? (
            /* --- Single Photo Card --- */
            (() => {
              const isLandscape = mode === 'adaptive' && imgRatios[0] === 'landscape';
              return (
                <div
                  className={`relative rounded-[4px] p-[2.5px] bg-white shadow-md transition-all duration-300 ease-out overflow-hidden ${
                    isLandscape ? 'w-[70%] aspect-[4/3]' : 'w-[54%] aspect-[3/4]'
                  }`}
                  style={{
                    transform: isHovered
                      ? 'translateY(-13px) rotate(0deg) scale(1.06)'
                      : 'translateY(-4px) rotate(0deg) scale(1)',
                    boxShadow: isHovered
                      ? '0 12px 20px -3px rgba(0, 0, 0, 0.55), 0 4px 6px -2px rgba(0, 0, 0, 0.4)'
                      : '0 5px 10px -2px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <img
                    src={validPreviews[0]}
                    alt="Preview"
                    className="w-full h-full object-cover object-center rounded-[2px]"
                    loading="lazy"
                    onLoad={(e) => handleImageLoad(0, e)}
                  />
                </div>
              );
            })()
          ) : (
            /* --- Two Photo Cards --- */
            (() => {
              const isP1Landscape = mode === 'adaptive' && imgRatios[0] === 'landscape';
              const isP2Landscape = mode === 'adaptive' && imgRatios[1] === 'landscape';

              return (
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Photo 1: Left card */}
                  <div
                    className={`absolute rounded-[4px] p-[2.5px] bg-white shadow-md transition-all duration-300 ease-out overflow-hidden ${
                      isP1Landscape ? 'w-[56%] aspect-[4/3]' : 'w-[48%] aspect-[3/4]'
                    }`}
                    style={{
                      left: isP1Landscape ? '7%' : '11%',
                      transform: isHovered
                        ? 'translateY(-14px) rotate(-8deg) scale(1.06)'
                        : 'translateY(-5px) rotate(-5.5deg) scale(0.98)',
                      zIndex: 1,
                      boxShadow: isHovered
                        ? '0 12px 20px -3px rgba(0, 0, 0, 0.55), 0 4px 6px -2px rgba(0, 0, 0, 0.35)'
                        : '0 5px 10px -2px rgba(0, 0, 0, 0.38)',
                    }}
                  >
                    <img
                      src={validPreviews[0]}
                      alt="Preview 1"
                      className="w-full h-full object-cover object-center rounded-[2px]"
                      loading="lazy"
                      onLoad={(e) => handleImageLoad(0, e)}
                    />
                  </div>

                  {/* Photo 2: Right card (overlapping) */}
                  <div
                    className={`absolute rounded-[4px] p-[2.5px] bg-white shadow-md transition-all duration-300 ease-out overflow-hidden ${
                      isP2Landscape ? 'w-[58%] aspect-[4/3]' : 'w-[50%] aspect-[3/4]'
                    }`}
                    style={{
                      right: isP2Landscape ? '7%' : '11%',
                      transform: isHovered
                        ? 'translateY(-15px) rotate(7deg) scale(1.07)'
                        : 'translateY(-4px) rotate(5deg) scale(1)',
                      zIndex: 2,
                      boxShadow: isHovered
                        ? '0 14px 22px -3px rgba(0, 0, 0, 0.6), 0 5px 8px -2px rgba(0, 0, 0, 0.4)'
                        : '0 6px 12px -2px rgba(0, 0, 0, 0.42)',
                    }}
                  >
                    <img
                      src={validPreviews[1]}
                      alt="Preview 2"
                      className="w-full h-full object-cover object-center rounded-[2px]"
                      loading="lazy"
                      onLoad={(e) => handleImageLoad(1, e)}
                    />
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* LAYER 3: FRONT FLAP (COMPACT SVG)                            */}
      {/* ============================================================ */}
      <svg
        viewBox="0 0 100 92"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full pointer-events-none z-20 transition-all duration-300"
      >
        <defs>
          <linearGradient id="winVertFolderFront" x1="15" y1="38" x2="85" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFDE68" />
            <stop offset="35%" stopColor="#FFC728" />
            <stop offset="100%" stopColor="#EF9800" />
          </linearGradient>

          <linearGradient id="winVertClosedFront" x1="10" y1="22" x2="90" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFE070" />
            <stop offset="25%" stopColor="#FFC928" />
            <stop offset="100%" stopColor="#F29E00" />
          </linearGradient>

          <linearGradient id="vertFrontRim" x1="8" y1="42" x2="92" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#FFEAA0" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#FFD150" stopOpacity="0.4" />
          </linearGradient>

          <filter id="vertFlapShadow" x="-10%" y="0%" width="120%" height="140%" filterUnits="objectBoundingBox">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.28" />
          </filter>
        </defs>

        {hasPreviews ? (
          /* --- OPEN FRONT FLAP (with photos peeking out) --- */
          <g filter="url(#vertFlapShadow)">
            <path
              d={
                isHovered
                  ? 'M6 45 C6 42.5 8 40.5 10.5 40.5 H89.5 C92 40.5 94 42.5 94 45 L92.5 78 C92.2 82.4 88.6 86 84.2 86 H15.8 C11.4 86 7.8 82.4 7.5 78 L6 45 Z'
                  : 'M6 42 C6 39.5 8 37.5 10.5 37.5 H89.5 C92 37.5 94 39.5 94 42 L92.5 78 C92.2 82.4 88.6 86 84.2 86 H15.8 C11.4 86 7.8 82.4 7.5 78 L6 42 Z'
              }
              fill="url(#winVertFolderFront)"
              className="transition-all duration-300"
            />
            {/* Top highlight stroke */}
            <path
              d={isHovered ? 'M8 42 H92' : 'M8 39 H92'}
              stroke="url(#vertFrontRim)"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </g>
        ) : (
          /* --- CLOSED FRONT FLAP (clean folder with NO photos) --- */
          <g filter="url(#vertFlapShadow)">
            <path
              d="M6 26 C6 23.5 8 21.5 10.5 21.5 H89.5 C92 21.5 94 23.5 94 26 L92.5 78 C92.2 82.4 88.6 86 84.2 86 H15.8 C11.4 86 7.8 82.4 7.5 78 L6 26 Z"
              fill="url(#winVertClosedFront)"
            />
            {/* Top highlight stroke */}
            <path
              d="M8 23 H92"
              stroke="url(#vertFrontRim)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
