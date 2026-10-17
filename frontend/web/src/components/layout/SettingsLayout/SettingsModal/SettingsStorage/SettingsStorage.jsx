import { memo } from 'react';
import { HardDrive } from 'lucide-react';
import './SettingsStorage.css';

const formatStorage = (value) => {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
};

export const SettingsStorage = memo(({ storageInfo }) => {
  return (
    <div className="settings-storage-card">
      <div className="settings-storage-header">
        <span className="flex items-center gap-2 text-sm">
          <HardDrive className="w-4 h-4 text-blue-400" />
          Ổ đĩa lưu trữ
        </span>
        {storageInfo?.drives && storageInfo.drives.length > 0 && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
            {storageInfo.drives.length} ổ đĩa
          </span>
        )}
      </div>
      {storageInfo ? (
        <div className="settings-storage-drives-list">
          {storageInfo.drives && storageInfo.drives.length > 0 ? (
            storageInfo.drives.map((drive) => {
              const isConn = drive.available && drive.totalBytes > 0;
              const p = isConn ? Math.round(drive.usedPercent || 0) : 0;
              const iconTheme = !isConn
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : p >= 91
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : p >= 75
                ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                : 'bg-blue-500/15 text-blue-400 border-blue-500/30';
              const badgeColor = !isConn
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : p >= 91
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : p >= 75
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/40';
              const barGrad = p >= 91
                ? 'from-red-500 to-rose-600'
                : p >= 75
                ? 'from-amber-500 to-orange-500'
                : 'from-blue-500 to-indigo-500';
              const usedColor = p >= 91 ? 'text-red-400 font-bold' : p >= 75 ? 'text-orange-400 font-bold' : 'text-blue-400 font-bold';

              return (
                <div key={drive.id} className="settings-storage-drive-item">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl border ${iconTheme}`}>
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white">
                          {drive.displayName || drive.name || drive.id}
                        </div>
                      </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${badgeColor}`}>
                      {isConn ? `${p}%` : 'Ngắt kết nối'}
                    </div>
                  </div>
                  {isConn ? (
                    <>
                      <div className="h-2 overflow-hidden rounded-full bg-[#101114]">
                        <div className={`h-full bg-gradient-to-r ${barGrad} rounded-full`} style={{ width: `${Math.max(0, Math.min(100, p))}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="text-gray-400">Đã dùng: <strong className={usedColor}>{formatStorage(drive.usedBytes)}</strong></span>
                        <span className="text-gray-400">Còn trống: <strong className="text-emerald-400 font-bold">{formatStorage(drive.availableBytes)}</strong></span>
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-red-400/80 flex items-center gap-1.5 pt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                      Ổ đĩa đã ngắt kết nối hoặc không tìm thấy đường dẫn
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <div>
              <div className="flex justify-between font-bold text-white">
                <span>{storageInfo.displayName}</span>
                <span>{Math.round(storageInfo.usedPercent || 0)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#18191c]">
                <div className="h-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, storageInfo.usedPercent || 0))}%` }} />
              </div>
              <p className="mt-2 text-gray-400">{formatStorage(storageInfo.usedBytes)} / {formatStorage(storageInfo.totalBytes)} đã dùng • {formatStorage(storageInfo.availableBytes)} còn trống</p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-2 text-gray-500">Đang chờ Storage local kết nối…</p>
      )}
    </div>
  );
});

SettingsStorage.displayName = 'SettingsStorage';
