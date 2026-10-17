import { useState, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Helper to get responsive cols and gap matching Tailwind breakpoints:
 * - folder & picture: grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5
 * - video: grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4
 */
function getTailwindGridConfig(type = 'default') {
  if (typeof window === 'undefined') {
    return type === 'video' ? { cols: 4, gap: 20 } : { cols: 5, gap: 20 };
  }
  const w = window.innerWidth;
  if (type === 'video') {
    if (w >= 1024) return { cols: 4, gap: 20 };
    if (w >= 768) return { cols: 3, gap: 20 };
    if (w >= 640) return { cols: 2, gap: 20 };
    return { cols: 1, gap: 16 };
  }
  // folder & picture
  if (w >= 1024) return { cols: 5, gap: 20 };
  if (w >= 768) return { cols: 4, gap: 20 };
  if (w >= 640) return { cols: 3, gap: 20 };
  return { cols: 2, gap: 16 };
}

/**
 * useVirtualGrid
 * Zero-jitter row virtualization for responsive CSS grids (Folders, Videos, Pictures).
 * Synchronizes with Tailwind breakpoints, measures DOM card heights,
 * and uses Viewport Intersection Range to completely unmount off-screen sections (saving RAM).
 */
export function useVirtualGrid({
  totalItems,
  type = 'default', // 'folder' | 'picture' | 'video'
  overscan = 2,
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [gridOffsetTop, setGridOffsetTop] = useState(0);
  const [measuredCardHeight, setMeasuredCardHeight] = useState(0);
  const [gridConfig, setGridConfig] = useState(() => getTailwindGridConfig(type));

  // 1. Observe container width and window resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleResize = () => {
      setGridConfig(getTailwindGridConfig(type));
      if (el) {
        setContainerWidth(el.clientWidth || 0);
      }
    };

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    });

    ro.observe(el);
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [type]);

  // 2. Measure actual card height from rendered DOM element (.group)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const firstCard = el.querySelector('.group');
    if (firstCard) {
      const h = firstCard.getBoundingClientRect().height;
      if (h > 50 && Math.abs(h - measuredCardHeight) > 2) {
        setMeasuredCardHeight(h);
      }
    }
  }, [containerWidth, gridConfig.cols, measuredCardHeight]);

  // 3. Measure gridOffsetTop and viewportHeight synchronously before paint
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measureOffset = () => {
      const scrollParent = el.closest('.overflow-y-auto') || el.closest('main') || window;
      const isWindow = scrollParent === window;
      const containerRect = el.getBoundingClientRect();
      const currentScroll = isWindow ? window.scrollY : scrollParent.scrollTop;

      setScrollTop(currentScroll);

      if (isWindow) {
        setGridOffsetTop(containerRect.top + window.scrollY);
        setViewportHeight(window.innerHeight);
      } else {
        const parentRect = scrollParent.getBoundingClientRect();
        setGridOffsetTop((containerRect.top - parentRect.top) + currentScroll);
        setViewportHeight(scrollParent.clientHeight);
      }
    };

    measureOffset();
    window.addEventListener('resize', measureOffset);
    return () => window.removeEventListener('resize', measureOffset);
  }, [totalItems, containerWidth, type]);

  // 4. Scroll listener: update scrollTop and keep offset in sync via requestAnimationFrame
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollParent = el.closest('.overflow-y-auto') || el.closest('main') || window;
    const isWindow = scrollParent === window;

    let rafId = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        const currentScroll = isWindow ? window.scrollY : scrollParent.scrollTop;
        setScrollTop(currentScroll);

        const containerRect = el.getBoundingClientRect();
        const newOffset = isWindow
          ? containerRect.top + window.scrollY
          : (containerRect.top - scrollParent.getBoundingClientRect().top) + currentScroll;

        setGridOffsetTop((prev) => {
          if (Math.abs(prev - newOffset) > 2) {
            return newOffset;
          }
          return prev;
        });

        rafId = null;
      });
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollParent.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const { cols, gap } = gridConfig;

  // 5. Calculate card width and fallback height
  const calculatedCardWidth = containerWidth > 0
    ? Math.max(60, (containerWidth - (cols - 1) * gap) / cols)
    : 200;

  let fallbackHeight = calculatedCardWidth;
  if (type === 'video') {
    fallbackHeight = Math.round(calculatedCardWidth * (9 / 16)) + 58;
  } else if (type === 'picture') {
    fallbackHeight = Math.round(calculatedCardWidth * 0.75) + 58;
  }

  const cardHeight = measuredCardHeight > 0 ? measuredCardHeight : fallbackHeight;
  const rowHeight = cardHeight + gap;

  const totalRows = Math.ceil(totalItems / cols);
  const totalHeight = totalRows > 0 ? totalRows * rowHeight - gap : 0;

  // 6. Viewport Intersection Range calculation
  // Check if grid overlaps [viewportTop - overscan, viewportBottom + overscan]
  const viewportTop = scrollTop;
  const viewportBottom = scrollTop + viewportHeight;
  const overscanPixels = overscan * rowHeight;

  const isGridNearViewport =
    totalItems > 0 &&
    viewportBottom >= gridOffsetTop - overscanPixels &&
    viewportTop <= gridOffsetTop + totalHeight + overscanPixels;

  const visibleRowIndices = [];
  if (isGridNearViewport) {
    const startRow = Math.max(
      0,
      Math.floor((viewportTop - gridOffsetTop) / rowHeight) - overscan
    );
    const endRow = Math.min(
      Math.max(0, totalRows - 1),
      Math.ceil((viewportBottom - gridOffsetTop) / rowHeight) + overscan
    );
    if (startRow <= endRow) {
      for (let r = startRow; r <= endRow; r++) {
        visibleRowIndices.push(r);
      }
    }
  }

  return {
    containerRef,
    cols,
    rowHeight,
    totalHeight,
    visibleRowIndices,
    isVirtualized: totalItems > cols * 3, // Only virtualize if more than 3 rows
  };
}
