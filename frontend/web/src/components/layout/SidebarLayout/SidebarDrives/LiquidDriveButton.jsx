import { memo } from 'react';
import { HardDrive } from 'lucide-react';
import { formatDriveCapacity } from '../../../../utils/formatters';
import { RollingNumber } from '../../../common/RollingNumber';
import { LiquidWaveCanvas } from './LiquidWaveCanvas';
import './LiquidDriveButton.css';

/**
 * Liquid Drive Button Component
 * Simulates a water tank fill level with animated surface waves.
 */
export const LiquidDriveButton = memo(({ drive, isActive, onClick }) => {
  const isDisconnected = drive.available === false || !drive.totalBytes || drive.totalBytes <= 0;
  const percent = isDisconnected ? 0 : Math.max(0, Math.min(100, Math.round(drive.usedPercent || 0)));
  const { usedVal, usedUnit, totalVal, totalUnit } = formatDriveCapacity(drive.usedBytes, drive.totalBytes);

  // Status tier: normal (<75%), warning (75%-90%), danger (91%-100%)
  const tier = isDisconnected ? 'disconnected' : percent >= 91 ? 'danger' : percent >= 75 ? 'warning' : 'normal';

  let cardClass;
  let iconClass;
  let badgeClass;

  if (isDisconnected) {
    cardClass = 'liquid-drive-btn-disconnected';
    iconClass = 'text-gray-500';
    badgeClass = 'bg-red-500/15 text-red-400/90 border border-red-500/30';
  } else if (tier === 'danger') {
    if (isActive) {
      cardClass = 'liquid-drive-btn-active-danger';
      iconClass = 'text-red-400';
      badgeClass = 'bg-red-500/25 text-red-300 border border-red-400/40 shadow-[0_0_8px_rgba(239,68,68,0.35)] animate-pulse';
    } else {
      cardClass = 'liquid-drive-btn-inactive-danger';
      iconClass = 'text-red-400/80 group-hover:text-red-300';
      badgeClass = 'bg-red-950/40 text-red-400/80 border border-red-800/30';
    }
  } else if (tier === 'warning') {
    if (isActive) {
      cardClass = 'liquid-drive-btn-active-warning';
      iconClass = 'text-orange-400';
      badgeClass = 'bg-orange-500/25 text-orange-300 border border-orange-400/40 shadow-[0_0_8px_rgba(249,115,22,0.35)]';
    } else {
      cardClass = 'liquid-drive-btn-inactive-warning';
      iconClass = 'text-orange-400/80 group-hover:text-orange-300';
      badgeClass = 'bg-orange-950/40 text-orange-400/80 border border-orange-800/30';
    }
  } else {
    // normal (< 75%)
    if (isActive) {
      cardClass = 'liquid-drive-btn-active-normal';
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
      className={`group liquid-drive-btn ${
        isDisconnected ? '' : 'cursor-pointer'
      } ${cardClass}`}
      title={isDisconnected ? `${drive.name || drive.id} - Đã ngắt kết nối` : `${drive.name || drive.id} - ${percent}% đã dùng`}
    >
      {/* Unified Liquid Water Wave (Only renders if not disconnected) */}
      {!isDisconnected && (
        <LiquidWaveCanvas percent={percent} isActive={isActive} tier={tier} />
      )}

      {/* Button Content Overlay (Sharp & Readable without Truncation) */}
      <div className="liquid-drive-content">
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
});

LiquidDriveButton.displayName = 'LiquidDriveButton';
