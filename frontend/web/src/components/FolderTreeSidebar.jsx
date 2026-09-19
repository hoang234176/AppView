import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  Image as ImageIcon,
  Search,
  ChevronsUp,
  X,
  Settings,
  HardDrive
} from 'lucide-react';
import { parseBreadcrumbs, formatFileSize, formatDriveCapacity } from '../utils/formatters';
import { RollingNumber } from './common/RollingNumber';

/**
 * Recursive Tree Node Component with smooth hover & badges
 */
const TreeNodeItem = React.memo(({ node, depth = 1, currentPath, onNavigate, expandedNodes, toggleExpand, onFolderContextMenu }) => {
  const isSelected = node.path === currentPath;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const [childrenMounted, setChildrenMounted] = useState(false);

  const isExpanded = !!expandedNodes[node.path];

  useEffect(() => {
    if (isExpanded) {
      setChildrenMounted(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setChildrenMounted(false), 200);
    return () => window.clearTimeout(timer);
  }, [isExpanded]);

  const handleToggle = (e) => {
    e.stopPropagation();
    toggleExpand(node.path);
  };

  const handleSelect = () => {
    onNavigate(node.path);
    if (hasChildren && !isExpanded) {
      toggleExpand(node.path, true);
    }
  };

  // Cấp đầu căn theo padding sidebar 12px; mỗi cấp con thụt 20px để phân
  // tầng rõ ràng mà không cần các đường connector gây rối giao diện.
  // depth 1 = 12px, depth 2 = 32px, depth 3 = 52px.
  const paddingLeftVal = depth * 20 - 8;

  return (
    <div className="select-none">
      <div
        onClick={handleSelect}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onFolderContextMenu) {
            onFolderContextMenu(e, { name: node.name, path: node.path });
          }
        }}
        className={`group relative flex items-center justify-between gap-2 py-2 min-h-[38px] rounded-xl text-xs font-medium cursor-pointer transition-all ${
          isSelected
            ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md'
            : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
        }`}
        style={{ paddingLeft: `${paddingLeftVal}px`, paddingRight: '12px' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Expand / Collapse Chevron button */}
          {hasChildren ? (
            <button
              onClick={handleToggle}
              className={`w-5 h-5 rounded-full hover:bg-black/20 flex items-center justify-center flex-shrink-0 transition-transform ${
                isSelected ? 'text-[#1c1d21]' : 'text-gray-400 hover:text-white'
              }`}
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} />
            </button>
          ) : (
            <span className="w-5 h-5 flex-shrink-0" />
          )}

          {/* Folder Icon */}
          {isExpanded ? (
            <FolderOpen className={`w-4.5 h-4.5 flex-shrink-0 ${isSelected ? 'text-[#1c1d21]' : 'text-yellow-400'}`} />
          ) : (
            <Folder className={`w-4.5 h-4.5 flex-shrink-0 ${isSelected ? 'text-[#1c1d21] fill-[#1c1d21]/20' : 'text-yellow-400 fill-yellow-400/20'}`} />
          )}

          {/* Folder Name */}
          <span className="truncate">{node.name}</span>
        </div>

        {/* Count Badge for subfolders */}
        {hasChildren && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
            isSelected
              ? 'bg-[#1c1d21]/20 text-[#1c1d21] font-bold'
              : 'bg-[#28292d] text-gray-400 group-hover:text-gray-200'
          }`}>
            <RollingNumber value={node.children.length} />
          </span>
        )}
      </div>

      {/* Render Nested Subfolders Recursively */}
      {hasChildren && childrenMounted && (
        <div className={`tree-children mt-1 ${isExpanded ? 'tree-children-opening' : 'tree-children-closing'}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-1.5">
              {node.children.map((childNode) => (
                <TreeNodeItem
                  key={childNode.path || childNode.name}
                  node={childNode}
                  depth={depth + 1}
                  currentPath={currentPath}
                  onNavigate={onNavigate}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                  onFolderContextMenu={onFolderContextMenu}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Color maps for capacity tiers:
 * - normal (< 75%): Google Blue / Cyan
 * - warning (75% -> 90%): Orange
 * - danger (91% -> 100%): Red
 */
const TIER_COLORS = {
  normal: {
    active: {
      b: [29, 78, 216, 0.48],
      m: [59, 130, 246, 0.32],
      t: [96, 165, 250, 0.22],
      crest: [147, 197, 253, 0.90],
      bgWaveAlpha: 0.14,
      bgWaveRgb: '96, 165, 250',
    },
    inactive: {
      b: [45, 55, 72, 0.28],
      m: [55, 65, 81, 0.18],
      t: [75, 85, 99, 0.10],
      crest: [148, 163, 184, 0.35],
    },
  },
  warning: {
    active: {
      b: [217, 119, 6, 0.50],
      m: [245, 158, 11, 0.35],
      t: [251, 191, 36, 0.24],
      crest: [253, 230, 138, 0.95],
      bgWaveAlpha: 0.16,
      bgWaveRgb: '245, 158, 11',
    },
    inactive: {
      b: [120, 53, 15, 0.35],
      m: [146, 64, 14, 0.22],
      t: [180, 83, 9, 0.12],
      crest: [245, 158, 11, 0.45],
    },
  },
  danger: {
    active: {
      b: [220, 38, 38, 0.52],
      m: [239, 68, 68, 0.36],
      t: [248, 113, 113, 0.24],
      crest: [254, 202, 202, 0.95],
      bgWaveAlpha: 0.18,
      bgWaveRgb: '239, 68, 68',
    },
    inactive: {
      b: [127, 29, 29, 0.35],
      m: [153, 27, 27, 0.22],
      t: [185, 28, 28, 0.12],
      crest: [239, 68, 68, 0.45],
    },
  },
};

/**
 * Liquid Wave Canvas Component
 * Renders a single unified liquid body with animated sine/cosine waves and smooth
 * color & amplitude transitions across tiers (normal, warning, danger).
 */
const LiquidWaveCanvas = ({ percent, isActive, tier = 'normal' }) => {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    animValue: 0,
    activeProgress: isActive ? 1 : 0,
    currentPercent: 0, // Starts at 0 so liquid wave visibly rises from the bottom!
    targetActive: isActive ? 1 : 0,
    targetPercent: percent,
    targetTier: tier,
  });

  // Keep target values up to date
  useEffect(() => {
    stateRef.current.targetActive = isActive ? 1 : 0;
    stateRef.current.targetPercent = percent;
    stateRef.current.targetTier = tier;
  }, [isActive, percent, tier]);

  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const render = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const state = stateRef.current;
      // Smoothly interpolate active state (0: inactive -> 1: active)
      state.activeProgress += (state.targetActive - state.activeProgress) * Math.min(dt * 7, 1);
      // Smoothly interpolate percent level (rising from 0 up to targetPercent)
      state.currentPercent += (state.targetPercent - state.currentPercent) * Math.min(dt * 3.2, 1);

      // Advance wave phase smoothly
      const speed = 0.26 + state.activeProgress * 0.12;
      state.animValue = (state.animValue + dt * speed) % 1;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const expectedW = Math.round(width * dpr);
      const expectedH = Math.round(height * dpr);
      if (canvas.width !== expectedW || canvas.height !== expectedH) {
        canvas.width = expectedW;
        canvas.height = expectedH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const p = Math.max(0, Math.min(100, state.currentPercent));
      if (p > 0) {
        const waterHeight = height * (p / 100);
        const baseWaterY = height - waterHeight;
        const act = state.activeProgress;

        // Wave amplitude scales gently at low percentages so waves never touch the bottom
        const maxAmp = Math.min(3.6, Math.max(0.5, waterHeight * 0.45));
        const primaryAmp = Math.min(maxAmp, (0.8 + act * 2.6) * Math.min(1, p / 12));
        const secondaryAmp = primaryAmp * 0.72;

        const currentTier = state.targetTier || 'normal';
        const colors = TIER_COLORS[currentTier] || TIER_COLORS.normal;
        const cAct = colors.active;
        const cInact = colors.inactive;

        // 1. Background Ripple Wave (renders with subtle depth when active)
        if (act > 0.02) {
          ctx.beginPath();
          ctx.moveTo(0, height);
          ctx.lineTo(0, baseWaterY);
          for (let x = 0; x <= width; x += 4) {
            const y = baseWaterY + Math.cos((x / width * 2 * Math.PI) - (state.animValue * 2 * Math.PI)) * secondaryAmp;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fillStyle = `rgba(${cAct.bgWaveRgb}, ${cAct.bgWaveAlpha * act})`;
          ctx.fill();
        }

        // 2. Primary Unified Wave (Single continuous body of water from bottom to wave crest)
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, baseWaterY);
        for (let x = 0; x <= width; x += 3) {
          const y = baseWaterY + Math.sin((x / width * 2 * Math.PI) + (state.animValue * 2 * Math.PI)) * primaryAmp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();

        // Linear gradient from bottom of button up to the wave surface
        const grad = ctx.createLinearGradient(0, height, 0, Math.max(0, baseWaterY - primaryAmp));

        // Seamless color interpolation between Inactive and Active state for the tier
        const r1 = Math.round(cInact.b[0] + act * (cAct.b[0] - cInact.b[0]));
        const g1 = Math.round(cInact.b[1] + act * (cAct.b[1] - cInact.b[1]));
        const b1 = Math.round(cInact.b[2] + act * (cAct.b[2] - cInact.b[2]));
        const a1 = cInact.b[3] + act * (cAct.b[3] - cInact.b[3]);

        const r2 = Math.round(cInact.m[0] + act * (cAct.m[0] - cInact.m[0]));
        const g2 = Math.round(cInact.m[1] + act * (cAct.m[1] - cInact.m[1]));
        const b2 = Math.round(cInact.m[2] + act * (cAct.m[2] - cInact.m[2]));
        const a2 = cInact.m[3] + act * (cAct.m[3] - cInact.m[3]);

        const r3 = Math.round(cInact.t[0] + act * (cAct.t[0] - cInact.t[0]));
        const g3 = Math.round(cInact.t[1] + act * (cAct.t[1] - cInact.t[1]));
        const b3 = Math.round(cInact.t[2] + act * (cAct.t[2] - cInact.t[2]));
        const a3 = cInact.t[3] + act * (cAct.t[3] - cInact.t[3]);

        grad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${a1})`);
        grad.addColorStop(0.5, `rgba(${r2}, ${g2}, ${b2}, ${a2})`);
        grad.addColorStop(1, `rgba(${r3}, ${g3}, ${b3}, ${a3})`);

        ctx.fillStyle = grad;
        ctx.fill();

        // 3. Water surface crest highlight line
        ctx.beginPath();
        const startY = baseWaterY + Math.sin(state.animValue * 2 * Math.PI) * primaryAmp;
        ctx.moveTo(0, startY);
        for (let x = 0; x <= width; x += 3) {
          const y = baseWaterY + Math.sin((x / width * 2 * Math.PI) + (state.animValue * 2 * Math.PI)) * primaryAmp;
          ctx.lineTo(x, y);
        }

        const lineR = Math.round(cInact.crest[0] + act * (cAct.crest[0] - cInact.crest[0]));
        const lineG = Math.round(cInact.crest[1] + act * (cAct.crest[1] - cInact.crest[1]));
        const lineB = Math.round(cInact.crest[2] + act * (cAct.crest[2] - cInact.crest[2]));
        const lineA = cInact.crest[3] + act * (cAct.crest[3] - cInact.crest[3]);

        ctx.strokeStyle = `rgba(${lineR}, ${lineG}, ${lineB}, ${lineA})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
};

/**
 * Liquid Drive Button Component
 * Simulates a water tank / bottle fill level with animated surface waves.
 * Handles:
 * - Normal tier (< 75%): Blue
 * - Warning tier (75% -> 90%): Orange
 * - Danger tier (91% -> 100%): Red
 * - Disconnected state (drive unavailable or 0 totalBytes): Shows "Ngắt kết nối" instead of 0B/0B
 */
export const LiquidDriveButton = ({ drive, isActive, onClick }) => {
  const isDisconnected = drive.available === false || !drive.totalBytes || drive.totalBytes <= 0;
  const percent = isDisconnected ? 0 : Math.max(0, Math.min(100, Math.round(drive.usedPercent || 0)));
  const { usedVal, usedUnit, totalVal, totalUnit } = formatDriveCapacity(drive.usedBytes, drive.totalBytes);

  // Status tier: normal (<75%), warning (75%-90%), danger (91%-100%)
  const tier = isDisconnected ? 'disconnected' : percent >= 91 ? 'danger' : percent >= 75 ? 'warning' : 'normal';

  // Dynamic styling by tier and active state
  let cardClass = 'border-[#33363d] hover:border-gray-500 bg-[#16171b]';
  let iconClass = 'text-gray-400 group-hover:text-gray-300';
  let badgeClass = 'bg-black/35 text-gray-400 border border-transparent';

  if (isDisconnected) {
    cardClass = 'border-[#2e3036] bg-[#141518]/90 opacity-70 cursor-not-allowed';
    iconClass = 'text-gray-500';
    badgeClass = 'bg-red-500/15 text-red-400/90 border border-red-500/30';
  } else if (tier === 'danger') {
    if (isActive) {
      cardClass = 'border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.35)] bg-[#181212]';
      iconClass = 'text-red-400';
      badgeClass = 'bg-red-500/25 text-red-300 border border-red-400/40 shadow-[0_0_8px_rgba(239,68,68,0.35)] animate-pulse';
    } else {
      cardClass = 'border-[#442323] hover:border-red-700/60 bg-[#171313]';
      iconClass = 'text-red-400/80 group-hover:text-red-300';
      badgeClass = 'bg-red-950/40 text-red-400/80 border border-red-800/30';
    }
  } else if (tier === 'warning') {
    if (isActive) {
      cardClass = 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.35)] bg-[#171412]';
      iconClass = 'text-orange-400';
      badgeClass = 'bg-orange-500/25 text-orange-300 border border-orange-400/40 shadow-[0_0_8px_rgba(249,115,22,0.35)]';
    } else {
      cardClass = 'border-[#423226] hover:border-orange-700/60 bg-[#161413]';
      iconClass = 'text-orange-400/80 group-hover:text-orange-300';
      badgeClass = 'bg-orange-950/40 text-orange-400/80 border border-orange-800/30';
    }
  } else {
    // normal (< 75%)
    if (isActive) {
      cardClass = 'border-blue-400/80 shadow-[0_0_20px_rgba(59,130,246,0.35)] bg-[#121316]';
      iconClass = 'text-blue-400';
      badgeClass = 'bg-blue-500/25 text-blue-300 border border-blue-400/30 shadow-[0_0_8px_rgba(59,130,246,0.3)]';
    } else {
      cardClass = 'border-[#33363d] hover:border-gray-500 bg-[#16171b]';
      iconClass = 'text-gray-400 group-hover:text-gray-300';
      badgeClass = 'bg-black/35 text-gray-400 border border-transparent';
    }
  }

  return (
    <div
      onClick={isDisconnected ? undefined : onClick}
      className={`group relative flex-1 h-[72px] rounded-2xl overflow-hidden select-none transition-all duration-500 ease-out border ${
        isDisconnected ? '' : 'cursor-pointer'
      } ${cardClass}`}
      title={isDisconnected ? `${drive.name || drive.id} - Đã ngắt kết nối` : `${drive.name || drive.id} - ${percent}% đã dùng`}
    >
      {/* Unified Liquid Water Wave (Only renders if not disconnected) */}
      {!isDisconnected && (
        <LiquidWaveCanvas percent={percent} isActive={isActive} tier={tier} />
      )}

      {/* Button Content Overlay (Sharp & Readable without Truncation) */}
      <div className="relative z-10 flex flex-col justify-between h-full p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <HardDrive className={`w-3.5 h-3.5 flex-shrink-0 transition-colors duration-300 ${iconClass}`} />
            <span className={`text-xs font-bold truncate transition-colors duration-300 ${
              isDisconnected ? 'text-gray-400' : isActive ? 'text-white' : 'text-gray-200'
            }`}>
              {drive.name || drive.id}
            </span>
          </div>
          <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md transition-all duration-300 flex items-center justify-center ${badgeClass}`}>
            {isDisconnected ? (
              'OFF'
            ) : (
              <RollingNumber value={percent} suffix="%" animateOnMount duration={750} />
            )}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono leading-none pt-1">
          {isDisconnected ? (
            <span className="text-[10px] font-medium text-red-400/90 flex items-center gap-1 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block flex-shrink-0" />
              Ngắt kết nối
            </span>
          ) : (
            <>
              <span className="font-semibold text-gray-100 drop-shadow-sm whitespace-nowrap flex items-center">
                <RollingNumber value={usedVal} suffix={` ${usedUnit}`} animateOnMount duration={750} />
              </span>
              <span className="font-medium text-gray-400 drop-shadow-sm flex-shrink-0 ml-1 whitespace-nowrap flex items-center gap-0.5">
                <span>/</span>
                <RollingNumber value={totalVal} suffix={` ${totalUnit}`} animateOnMount duration={750} />
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const FolderTreeSidebarComponent = ({
  currentPath,
  treeData = [],
  folders = [],
  onNavigate,
  onOpenConfig,
  drives = [],
  activeDrive = 'HDD',
  onSelectDrive,
  onFolderContextMenu,
  onEmptyContextMenu,
}) => {
  const [expandedNodes, setExpandedNodes] = useState({});

  const toggleExpand = (path, forceExpand = null) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [path]: forceExpand !== null ? forceExpand : !prev[path]
    }));
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  useEffect(() => {
    if (currentPath) {
      const parts = currentPath.split('/');
      const newExpanded = { ...expandedNodes };
      let accPath = '';
      parts.forEach((part) => {
        accPath = accPath ? `${accPath}/${part}` : part;
        newExpanded[accPath] = true;
      });
      setExpandedNodes(newExpanded);
    }
  }, [currentPath]);

  return (
    <aside
      className="w-72 tahoe-block hidden md:flex flex-col justify-between flex-shrink-0 sticky top-2 z-20 overflow-hidden"
      style={{
        height: 'calc(100vh - 16px)',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div className="flex flex-col h-full w-full">

        {/* Header Logo */}
        <div
          className="flex items-center gap-3.5 cursor-pointer group pb-2.5 flex-shrink-0"
          onClick={() => onNavigate('')}
          style={{ paddingLeft: '4px' }}
        >
          <div className="w-12 h-12 rounded-[24px] bg-gradient-to-br from-blue-500 via-green-500 to-yellow-500 p-0.5 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform flex-shrink-0">
            <div className="w-full h-full bg-[#1c1d21] rounded-[22px] flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">AppView</h1>
          </div>
        </div>

        {/* Subfolder Header with Collapse All */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2 mb-1 text-[11px] font-medium text-gray-400 border-b border-white/10 flex-shrink-0">
          <span className="flex items-center gap-1.5 text-blue-400 font-semibold truncate">
            <FolderOpen className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
            <span className="truncate">Thư mục trên {activeDrive}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-gray-400">
              {treeData?.length || folders?.length || 0} mục
            </span>
            {Object.keys(expandedNodes).length > 0 && (
              <button
                onClick={collapseAll}
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-[#28292d] transition-colors"
                title="Thu gọn tất cả"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Tree Area with Smooth Mask & Custom Scrollbar */}
        <div
          onContextMenu={(e) => {
            if (onEmptyContextMenu) {
              onEmptyContextMenu(e);
            }
          }}
          className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar"
        >

          {/* Render Full Tree */}
          {Array.isArray(treeData) && treeData.length > 0 ? (
            <div className="flex flex-col gap-1.5 pt-1">
              {treeData.map((node) => (
                <TreeNodeItem
                  key={node.path || node.name}
                  node={node}
                  depth={1}
                  currentPath={currentPath}
                  onNavigate={onNavigate}
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                  onFolderContextMenu={onFolderContextMenu}
                />
              ))}
            </div>
          ) : (
            /* Fallback */
            folders && folders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
                {folders.map((subfolder) => {
                  const isSelected = subfolder.path === currentPath;

                  return (
                    <div
                      key={subfolder.path}
                      onClick={() => onNavigate(subfolder.path)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onFolderContextMenu) {
                          onFolderContextMenu(e, subfolder);
                        }
                      }}
                      className={`flex items-center gap-2.5 pr-3 py-2 min-h-[38px] rounded-xl text-xs font-medium cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#8ab4f8] text-[#1c1d21] font-bold shadow-md'
                          : 'text-gray-300 hover:bg-[#28292d] hover:text-white'
                      }`}
                      style={{ paddingLeft: '12px' }}
                    >
                      <Folder className={`w-4.5 h-4.5 flex-shrink-0 ${isSelected ? 'text-[#1c1d21] fill-[#1c1d21]/20' : 'text-yellow-400 fill-yellow-400/20'}`} />
                      <span className="truncate">{subfolder.name}</span>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Bottom Section: Ổ CỨNG + Cài đặt */}
        <div className="pt-2.5 border-t border-white/10 select-none flex-shrink-0 space-y-2">
          {/* Drives Header */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold text-[#9aa0a6] uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              Ổ cứng
            </span>
          </div>

          {/* Horizontal Liquid Drive Buttons (Bình nước gợn sóng) */}
          {drives && drives.length > 0 && (
            <div className="flex items-center gap-2">
              {drives.map((drive) => (
                <LiquidDriveButton
                  key={drive.id}
                  drive={drive}
                  isActive={drive.id === activeDrive}
                  onClick={() => {
                    if (onSelectDrive) onSelectDrive(drive.id);
                    onNavigate('');
                  }}
                />
              ))}
            </div>
          )}

          {/* Settings Button Horizontal Bar */}
          <div
            onClick={onOpenConfig}
            className="bg-[#202124] hover:bg-[#28292d] border border-[#383c42] hover:border-blue-500/50 rounded-[20px] p-2.5 cursor-pointer transition-all flex items-center justify-between group shadow-lg"
            title="Cài đặt máy chủ"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 group-hover:bg-blue-600/30 group-hover:border-blue-400/60 transition-colors flex-shrink-0">
                <Settings className="absolute inset-0 m-auto block w-4 h-4 text-blue-400 origin-center transform-gpu transition-transform duration-500 group-hover:rotate-[360deg]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white group-hover:text-blue-300 truncate">
                  Cài đặt
                </h4>
                <p className="text-[10px] text-gray-400 truncate">
                  Máy chủ
                </p>
              </div>
            </div>

            {/* Gear Icon at the end (bánh răng) */}
            <div className="relative w-7 h-7 rounded-full bg-black/40 border border-white/10 text-gray-400 group-hover:text-white group-hover:border-blue-500/40 flex-shrink-0 transition-colors">
              <Settings className="absolute inset-0 m-auto block w-3.5 h-3.5 origin-center transform-gpu transition-transform duration-500 group-hover:rotate-[360deg]" />
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
};

export const FolderTreeSidebar = React.memo(FolderTreeSidebarComponent);
