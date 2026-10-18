import { memo, useEffect, useRef, Fragment } from 'react';
import { ChevronRight, Folder, HardDrive } from 'lucide-react';
import { parseBreadcrumbs } from '../../../../utils/formatters';
import { useContentBreadcrumbs } from '../../../../hooks/content';
import './Breadcrumbs.css';

/**
 * Breadcrumbs — Navigation path pills with auto-scroll and item count statistics
 */
export const Breadcrumbs = memo(({
  currentPath: propCurrentPath,
  onNavigate: propOnNavigate,
  totalFolders: propTotalFolders,
  totalPictures: propTotalPictures,
  totalVideos: propTotalVideos,
  activeDrive: propActiveDrive,
}) => {
  const hookData = useContentBreadcrumbs();
  const currentPath = propCurrentPath !== undefined ? propCurrentPath : hookData.currentPath;
  const onNavigate = propOnNavigate || hookData.onNavigate;
  const totalFolders = propTotalFolders !== undefined ? propTotalFolders : hookData.totalFolders;
  const totalPictures = propTotalPictures !== undefined ? propTotalPictures : hookData.totalPictures;
  const totalVideos = propTotalVideos !== undefined ? propTotalVideos : hookData.totalVideos;
  const activeDrive = propActiveDrive !== undefined ? propActiveDrive : hookData.activeDrive;

  const breadcrumbs = parseBreadcrumbs(currentPath, activeDrive);
  const navRef = useRef(null);

  // Auto-scroll to far-right whenever currentPath changes so the active subfolder is always visible
  useEffect(() => {
    if (navRef.current) {
      setTimeout(() => {
        if (navRef.current) {
          navRef.current.scrollTo({
            left: navRef.current.scrollWidth,
            behavior: 'smooth',
          });
        }
      }, 50);
    }
  }, [currentPath]);

  return (
    <div className="breadcrumbs-wrapper">
      <div className="breadcrumbs-card">
        {/* Navigation Breadcrumb Pills (Auto-scrolling container) */}
        <nav
          ref={navRef}
          className="breadcrumbs-nav custom-scrollbar"
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isRoot = index === 0;

            return (
              <Fragment key={item.path || 'root'}>
                {index > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    onNavigate(item.path);
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className={`breadcrumbs-pill ${
                    isLast
                      ? 'breadcrumbs-pill-active'
                      : 'breadcrumbs-pill-inactive'
                  }`}
                >
                  {isRoot ? (
                    <HardDrive className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                  )}
                  <span className="breadcrumbs-pill-text">{item.name}</span>
                </button>
              </Fragment>
            );
          })}
        </nav>

        {/* Stats info (Always displays F, P, V with tight spacing between number & letter) */}
        <div className="breadcrumbs-stats">
          <span className="breadcrumbs-stats-badge">
            <span>
              <strong className="text-yellow-400">{totalFolders}</strong>
              <span className="text-gray-400 font-semibold ml-0.5">F</span>
            </span>
            <span className="text-gray-500">•</span>
            <span>
              <strong className="text-blue-400">{totalPictures}</strong>
              <span className="text-gray-400 font-semibold ml-0.5">P</span>
            </span>
            <span className="text-gray-500">•</span>
            <span>
              <strong className="text-purple-400">{totalVideos}</strong>
              <span className="text-gray-400 font-semibold ml-0.5">V</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
});

Breadcrumbs.displayName = 'Breadcrumbs';
