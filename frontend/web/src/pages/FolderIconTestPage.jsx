import { useState } from 'react';
import { WindowsFolderIcon } from '../components/icons/WindowsFolderIcon';
import { Folder as LucideFolder, ArrowLeft, Eye, Sparkles, Layers, Sliders } from 'lucide-react';
import { getThumbnailUrl } from '../utils/formatters';

export const FolderIconTestPage = () => {
  const [iconSize, setIconSize] = useState(105);
  const [isSimulateHover, setIsSimulateHover] = useState(false);
  const [activeTab, setActiveTab] = useState('compare'); // 'compare' | 'fixed' | 'adaptive'

  const folderName = 'Coser@桜井宁宁 Vol.007 双马尾黑丝';
  const folderRelPath = 'Cosplay/Coser@桜井宁宁 Vol.007 双马尾黑丝';

  // 2 ảnh chụp ĐỨNG (Portrait: 1908 x 3392)
  const thumbPortrait1 = getThumbnailUrl({
    path: `${folderRelPath}/Coser-ying-jing-ning-ning-Vol.007-MrCong.com-001.jpg`,
  });
  const thumbPortrait2 = getThumbnailUrl({
    path: `${folderRelPath}/Coser-ying-jing-ning-ning-Vol.007-MrCong.com-002.jpg`,
  });

  // 2 ảnh chụp NGANG (Landscape: 3392 x 1908)
  const thumbLandscape1 = getThumbnailUrl({
    path: `${folderRelPath}/Coser-ying-jing-ning-ning-Vol.007-MrCong.com-003.jpg`,
  });
  const thumbLandscape2 = getThumbnailUrl({
    path: `${folderRelPath}/Coser-ying-jing-ning-ning-Vol.007-MrCong.com-004.jpg`,
  });

  return (
    <div className="h-screen h-[100dvh] w-full overflow-y-auto bg-[#131417] text-gray-100 flex flex-col font-sans selection:bg-yellow-500 selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-[#28292d] bg-[#1a1b1e]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#28292d] hover:bg-[#34353a] text-xs font-medium text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Về trang chính
          </a>
          <div className="h-4 w-px bg-gray-700" />
          <h1 className="text-sm font-semibold flex items-center gap-2 text-yellow-400">
            <Sparkles className="w-4 h-4" /> Thư Mục Dáng Đứng (Vertical SVG Folder)
          </h1>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
            Branch: test/icon-folder
          </span>
        </div>

        {/* Size & Interaction Controller */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 bg-[#202124] px-3 py-1.5 rounded-xl border border-[#323338]">
            <span className="text-gray-400">Kích thước:</span>
            {[85, 105, 130].map((sz) => (
              <button
                key={sz}
                onClick={() => setIconSize(sz)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all ${
                  iconSize === sz
                    ? 'bg-yellow-400 text-black font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {sz}px
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-[#202124] px-3 py-1.5 rounded-xl border border-[#323338]">
            <input
              type="checkbox"
              checked={isSimulateHover}
              onChange={(e) => setIsSimulateHover(e.target.checked)}
              className="accent-yellow-400 rounded"
            />
            <span className="text-gray-300">Giữ hiệu ứng Hover</span>
          </label>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-10">
        {/* Banner info */}
        <section className="bg-gradient-to-r from-yellow-500/10 via-[#202124] to-[#1c1d21] border border-yellow-500/20 rounded-2xl p-5 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-500/20 text-yellow-400 rounded-xl">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100 mb-1">
                Demo So sánh 2 cách tính toán trên dáng thư mục đứng: <span className="text-yellow-400">{folderName}</span>
              </h2>
              <p className="text-xs text-gray-400 leading-relaxed max-w-3xl">
                • <strong>Dáng đứng (Vertical SVG):</strong> Tỉ lệ 100 × 116 (chiều cao lớn hơn chiều ngang), nắp kẹp túi thanh thoát, sâu lòng theo chiều dọc.
                <br />
                • <strong>Cách 1 (Khung Đứng Cố Định 3:4):</strong> Thẻ ảnh luôn có dáng đứng bưu thiếp Polaroid. Ảnh đứng vừa trọn vẹn, ảnh ngang lấy trung tâm `object-cover`.
                <br />
                • <strong>Cách 2 (Thích Ứng Thông Minh - Adaptive):</strong> Tự phát hiện tỉ lệ ảnh thực tế khi tải. Nếu là ảnh ngang thì mở rộng thẻ sang tỉ lệ ngang `4/3` để nhìn rõ cảnh; nếu là ảnh đứng thì dùng tỉ lệ đứng `3/4`.
                <br />
                • <strong>Không có ảnh:</strong> Tự động hiển thị thư mục đứng nắp đóng kín, không có thẻ ảnh.
              </p>
            </div>
          </div>
        </section>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-2 border-b border-[#2d2f34] pb-3">
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'compare'
                ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-500/20'
                : 'bg-[#202124] text-gray-400 hover:text-white border border-[#323338]'
            }`}
          >
            <Layers className="w-4 h-4" /> So sánh đối chiếu 2 Cách song song
          </button>
          <button
            onClick={() => setActiveTab('fixed')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'fixed'
                ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-500/20'
                : 'bg-[#202124] text-gray-400 hover:text-white border border-[#323338]'
            }`}
          >
            <Sliders className="w-4 h-4" /> Chỉ xem Cách 1 (Khung đứng cố định 3:4)
          </button>
          <button
            onClick={() => setActiveTab('adaptive')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'adaptive'
                ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-500/20'
                : 'bg-[#202124] text-gray-400 hover:text-white border border-[#323338]'
            }`}
          >
            <Sliders className="w-4 h-4" /> Chỉ xem Cách 2 (Thích ứng Adaptive)
          </button>
        </div>

        {/* ========================================================================= */}
        {/* ROW 1: CÁCH 1 - KHUNG ĐỨNG CỐ ĐỊNH 3:4 (FIXED PORTRAIT)                   */}
        {/* ========================================================================= */}
        {(activeTab === 'compare' || activeTab === 'fixed') && (
          <section className="space-y-4 bg-[#1a1b1f] border border-[#2d2f34] rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-yellow-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  CÁCH 1: Khung thẻ ảnh đứng cố định tỉ lệ 3:4 (Polaroid chân dung đồng nhất)
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Đặc điểm: Cực kỳ gọn gàng, đồng đều. Thẻ ảnh đứng tự nhiên cho ảnh chân dung/cosplay, ảnh ngang tự cân đối ở giữa.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-2">
              {/* Card 1A: Ảnh ĐỨNG (Portrait 001 + 002) */}
              <div className="group relative bg-[#202124] border border-[#383c42] hover:border-yellow-400/80 rounded-[24px] shadow-sm hover:shadow-2xl cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-1 aspect-square overflow-hidden">
                <div className="relative flex-1 min-h-0 bg-yellow-500/[0.05] group-hover:bg-yellow-500/[0.1] border-b border-yellow-500/10 flex items-center justify-center transition-colors duration-200">
                  <WindowsFolderIcon
                    previews={[thumbPortrait1, thumbPortrait2]}
                    size={iconSize}
                    mode="fixed"
                    isHovered={isSimulateHover ? true : undefined}
                  />
                </div>
                <div className="px-4 py-3 bg-[#202124] flex flex-col">
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-yellow-300 truncate" title={folderName}>
                    {folderName}
                  </span>
                  <span className="text-[11px] text-green-400 font-mono mt-0.5">2 Ảnh Đứng (Chân dung)</span>
                </div>
              </div>

              {/* Card 1B: Ảnh NGANG (Landscape 003 + 004) */}
              <div className="group relative bg-[#202124] border border-[#383c42] hover:border-yellow-400/80 rounded-[24px] shadow-sm hover:shadow-2xl cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-1 aspect-square overflow-hidden">
                <div className="relative flex-1 min-h-0 bg-yellow-500/[0.05] group-hover:bg-yellow-500/[0.1] border-b border-yellow-500/10 flex items-center justify-center transition-colors duration-200">
                  <WindowsFolderIcon
                    previews={[thumbLandscape1, thumbLandscape2]}
                    size={iconSize}
                    mode="fixed"
                    isHovered={isSimulateHover ? true : undefined}
                  />
                </div>
                <div className="px-4 py-3 bg-[#202124] flex flex-col">
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-yellow-300 truncate">
                    Album Ảnh Ngang (003 + 004)
                  </span>
                  <span className="text-[11px] text-blue-400 font-mono mt-0.5">2 Ảnh Ngang (Cover giữa)</span>
                </div>
              </div>

              {/* Card 1C: Thư mục RỖNG / KHÔNG CÓ ẢNH */}
              <div className="group relative bg-[#202124] border border-[#383c42] hover:border-yellow-400/80 rounded-[24px] shadow-sm hover:shadow-2xl cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-1 aspect-square overflow-hidden">
                <div className="relative flex-1 min-h-0 bg-yellow-500/[0.05] group-hover:bg-yellow-500/[0.1] border-b border-yellow-500/10 flex items-center justify-center transition-colors duration-200">
                  <WindowsFolderIcon
                    previews={[]}
                    size={iconSize}
                    mode="fixed"
                    isHovered={isSimulateHover ? true : undefined}
                  />
                </div>
                <div className="px-4 py-3 bg-[#202124] flex flex-col">
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-yellow-300 truncate">
                    Thư mục tài liệu (Rỗng ảnh)
                  </span>
                  <span className="text-[11px] text-gray-400 font-mono mt-0.5">Nắp đóng kín nguyên bản</span>
                </div>
              </div>

              {/* Card 1D: Icon Lucide cũ để so sánh */}
              <div className="group relative bg-[#202124] border border-[#383c42] rounded-[24px] shadow-sm flex flex-col aspect-square overflow-hidden opacity-70">
                <div className="relative flex-1 min-h-0 bg-yellow-500/[0.04] border-b border-yellow-500/10 flex items-center justify-center">
                  <LucideFolder className="w-[80px] h-[80px] text-yellow-400 fill-yellow-400/20" />
                </div>
                <div className="px-4 py-3 bg-[#202124] flex flex-col">
                  <span className="text-xs font-semibold text-gray-400 truncate">Icon Lucide cũ</span>
                  <span className="text-[11px] text-gray-500 font-mono mt-0.5">Icon đơn sắc cũ</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* ROW 2: CÁCH 2 - THÍCH ỨNG THÔNG MINH (ADAPTIVE RATIO)                     */}
        {/* ========================================================================= */}
        {(activeTab === 'compare' || activeTab === 'adaptive') && (
          <section className="space-y-4 bg-[#1a1b1f] border border-[#2d2f34] rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  CÁCH 2: Thẻ ảnh tự động thích ứng tỉ lệ thực tế (Adaptive Ratio)
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Đặc điểm: Ảnh đứng hiển thị dáng đứng (3:4); Ảnh ngang tự mở rộng dáng ngang (4:3) để thấy trọn vẹn phong cảnh mà không bị cắt 2 bên mép.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-2">
              {/* Card 2A: Ảnh ĐỨNG */}
              <div className="group relative bg-[#202124] border border-[#383c42] hover:border-cyan-400/80 rounded-[24px] shadow-sm hover:shadow-2xl cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-1 aspect-square overflow-hidden">
                <div className="relative flex-1 min-h-0 bg-cyan-500/[0.05] group-hover:bg-cyan-500/[0.1] border-b border-cyan-500/10 flex items-center justify-center transition-colors duration-200">
                  <WindowsFolderIcon
                    previews={[thumbPortrait1, thumbPortrait2]}
                    size={iconSize}
                    mode="adaptive"
                    isHovered={isSimulateHover ? true : undefined}
                  />
                </div>
                <div className="px-4 py-3 bg-[#202124] flex flex-col">
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-cyan-300 truncate" title={folderName}>
                    {folderName}
                  </span>
                  <span className="text-[11px] text-green-400 font-mono mt-0.5">Tự co dáng ĐỨNG (3:4)</span>
                </div>
              </div>

              {/* Card 2B: Ảnh NGANG */}
              <div className="group relative bg-[#202124] border border-[#383c42] hover:border-cyan-400/80 rounded-[24px] shadow-sm hover:shadow-2xl cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-1 aspect-square overflow-hidden">
                <div className="relative flex-1 min-h-0 bg-cyan-500/[0.05] group-hover:bg-cyan-500/[0.1] border-b border-cyan-500/10 flex items-center justify-center transition-colors duration-200">
                  <WindowsFolderIcon
                    previews={[thumbLandscape1, thumbLandscape2]}
                    size={iconSize}
                    mode="adaptive"
                    isHovered={isSimulateHover ? true : undefined}
                  />
                </div>
                <div className="px-4 py-3 bg-[#202124] flex flex-col">
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-cyan-300 truncate">
                    Album Ảnh Ngang (003 + 004)
                  </span>
                  <span className="text-[11px] text-cyan-400 font-mono mt-0.5">Tự mở rộng dáng NGANG (4:3)</span>
                </div>
              </div>

              {/* Card 2C: Pha trộn 1 ảnh Đứng + 1 ảnh Ngang */}
              <div className="group relative bg-[#202124] border border-[#383c42] hover:border-cyan-400/80 rounded-[24px] shadow-sm hover:shadow-2xl cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-1 aspect-square overflow-hidden">
                <div className="relative flex-1 min-h-0 bg-cyan-500/[0.05] group-hover:bg-cyan-500/[0.1] border-b border-cyan-500/10 flex items-center justify-center transition-colors duration-200">
                  <WindowsFolderIcon
                    previews={[thumbPortrait1, thumbLandscape1]}
                    size={iconSize}
                    mode="adaptive"
                    isHovered={isSimulateHover ? true : undefined}
                  />
                </div>
                <div className="px-4 py-3 bg-[#202124] flex flex-col">
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-cyan-300 truncate">
                    Hỗn hợp: 1 Đứng + 1 Ngang
                  </span>
                  <span className="text-[11px] text-purple-400 font-mono mt-0.5">Thích ứng tự do đa dạng</span>
                </div>
              </div>

              {/* Card 2D: Thư mục rỗng */}
              <div className="group relative bg-[#202124] border border-[#383c42] hover:border-cyan-400/80 rounded-[24px] shadow-sm hover:shadow-2xl cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-1 aspect-square overflow-hidden">
                <div className="relative flex-1 min-h-0 bg-cyan-500/[0.05] group-hover:bg-cyan-500/[0.1] border-b border-cyan-500/10 flex items-center justify-center transition-colors duration-200">
                  <WindowsFolderIcon
                    previews={[]}
                    size={iconSize}
                    mode="adaptive"
                    isHovered={isSimulateHover ? true : undefined}
                  />
                </div>
                <div className="px-4 py-3 bg-[#202124] flex flex-col">
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-cyan-300 truncate">
                    Thư mục tài liệu (Rỗng ảnh)
                  </span>
                  <span className="text-[11px] text-gray-400 font-mono mt-0.5">Nắp đóng kín nguyên bản</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
