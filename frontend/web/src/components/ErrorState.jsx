import React from 'react';
import { AlertTriangle, RefreshCw, Terminal, Globe, HelpCircle } from 'lucide-react';

export const ErrorState = ({ errorInfo, onRetry }) => {
  if (!errorInfo) return null;

  return (
    <div className="max-w-4xl mx-auto my-8 px-4 sm:px-6 animate-fade-in">
      <div className="bg-red-950/90 border border-red-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        
        {/* Background glow */}
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 text-red-400">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
          </div>

          <div className="flex-1 space-y-3.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-red-500/20 text-red-300 font-mono text-xs px-2.5 py-0.5 rounded-md border border-red-500/30">
                  HTTP Status: {errorInfo.status || '0 (Network Fail)'}
                </span>
                <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">
                  Kết nối API Thất bại
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                {errorInfo.message || 'Không thể lấy dữ liệu từ máy chủ API.'}
              </h3>
            </div>

            {/* Request Details Box */}
            {errorInfo.requestUrl && (
              <div className="bg-[#18191c] rounded-2xl p-3 sm:p-3.5 border border-[#3c4043]/60 font-mono text-xs space-y-1.5 overflow-hidden">
                <div className="flex items-center gap-2 text-gray-400 flex-wrap">
                  <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span>URL:</span>
                  <span className="text-blue-300 select-all font-semibold break-all">{errorInfo.requestUrl}</span>
                </div>
                {errorInfo.errorDetails && (
                  <div className="pt-2 border-t border-[#3c4043]/40 text-gray-400 overflow-x-auto max-h-32">
                    <div className="flex items-center gap-1 text-amber-400 mb-1">
                      <Terminal className="w-3.5 h-3.5" /> Phản hồi chi tiết:
                    </div>
                    <pre className="text-[11px] text-red-300">{errorInfo.errorDetails}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Troubleshooting Guide */}
            <div className="bg-[#202124] rounded-2xl p-3.5 border border-[#3c4043]/40 space-y-1.5 text-xs text-gray-300">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <HelpCircle className="w-4 h-4" /> Gợi ý khắc phục:
              </div>
              <ul className="list-disc list-inside space-y-1 text-gray-400 pl-1 text-[11px] sm:text-xs">
                <li>Kiểm tra xem backend server tại <code className="bg-[#2d2f31] px-1 py-0.5 rounded text-amber-300">192.168.1.253:8080</code> có đang chạy hay không.</li>
                <li>Đảm bảo thiết bị của bạn đang cùng mạng Wi-Fi/LAN với server.</li>
                <li>Nếu gặp lỗi CORS, cần kiểm tra header CORS trên máy chủ backend.</li>
              </ul>
            </div>

            {/* Action */}
            <div className="pt-1">
              <button
                onClick={onRetry}
                className="btn-google btn-google-primary text-xs"
              >
                <RefreshCw className="w-4 h-4" /> Thử lại kết nối
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
