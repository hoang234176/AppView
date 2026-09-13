import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Cookie,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Layers,
  ExternalLink,
  Copy,
  Check,
  Heart,
  MessageCircle,
  Eye,
  Calendar,
  User,
  Code
} from 'lucide-react';
import { getCookieStatus, verifyCookies, saveCookies, previewMediaDownload, getProxiedImageUrl } from '../api/downloadApi';

export const InstagramTestPage = () => {
  // Cookie state
  const [cookieStatus, setCookieStatus] = useState('loading'); // 'loading' | 'valid' | 'none' | 'expired'
  const [cookieStatusDetail, setCookieStatusDetail] = useState(null);
  const [cookieFields, setCookieFields] = useState({
    sessionid: '',
    ds_user_id: '',
    csrftoken: '',
    mid: '',
    ig_did: '',
    rur: '',
    datr: '',
  });
  const [isVerifyingCookie, setIsVerifyingCookie] = useState(false);
  const [isSavingCookie, setIsSavingCookie] = useState(false);
  const [cookieMsg, setCookieMsg] = useState(null);

  // Inspector state
  const [inputUrl, setInputUrl] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState(null);
  const [postData, setPostData] = useState(null);
  const [rawJsonOpen, setRawJsonOpen] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Fetch cookie status and unlock body scrolling on mount
  useEffect(() => {
    fetchCookieStatus();

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlHeight = document.documentElement.style.height;
    const originalBodyHeight = document.body.style.height;

    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.height = originalHtmlHeight;
      document.body.style.height = originalBodyHeight;
    };
  }, []);

  const fetchCookieStatus = async () => {
    setCookieStatus('loading');
    setCookieMsg(null);
    const res = await getCookieStatus('instagram');
    if (res.success && res.data) {
      setCookieStatusDetail(res.data);
      if (res.data.exists) {
        setCookieStatus('valid');
      } else {
        setCookieStatus('none');
      }
    } else {
      setCookieStatus('none');
    }
  };

  const handleFieldChange = (key, value) => {
    setCookieFields(prev => ({ ...prev, [key]: value }));
    setCookieMsg(null);
  };

  const handleVerifyCookie = async () => {
    setIsVerifyingCookie(true);
    setCookieMsg(null);

    const hasAnyField = Object.values(cookieFields).some(v => v && v.trim() !== '');
    const payload = hasAnyField ? cookieFields : null;

    const res = await verifyCookies('instagram', payload);
    setIsVerifyingCookie(false);
    if (res.success && res.data?.valid) {
      setCookieStatus('valid');
      setCookieMsg({ type: 'success', text: res.data.message || '✓ Xác thực Cookie Instagram thành công!' });
    } else {
      const errMsg = res.data?.message || res.message || 'Cookie không hợp lệ hoặc đã hết hạn.';
      setCookieMsg({ type: 'error', text: errMsg });
    }
  };

  const handleSaveCookie = async () => {
    const hasAnyField = Object.values(cookieFields).some(v => v && v.trim() !== '');
    if (!hasAnyField) {
      setCookieMsg({ type: 'error', text: 'Vui lòng nhập ít nhất trường sessionid trước khi lưu.' });
      return;
    }

    setIsSavingCookie(true);
    setCookieMsg(null);
    const res = await saveCookies('instagram', cookieFields);
    setIsSavingCookie(false);
    if (res.success) {
      setCookieStatus('valid');
      setCookieMsg({ type: 'success', text: '✓ Đã lưu cookie vào ~/.tmp-appview/cookies/instagram.txt thành công!' });
      fetchCookieStatus();
    } else {
      setCookieMsg({ type: 'error', text: res.message || 'Không thể lưu cookie.' });
    }
  };

  const handleResetForm = () => {
    setCookieFields({
      sessionid: '',
      ds_user_id: '',
      csrftoken: '',
      mid: '',
      ig_did: '',
      rur: '',
      datr: '',
    });
    setCookieMsg(null);
  };

  const handleInspect = async (e) => {
    if (e) e.preventDefault();
    if (!inputUrl.trim()) {
      setInspectError('Vui lòng nhập URL bài viết hoặc video Instagram.');
      return;
    }

    setIsInspecting(true);
    setInspectError(null);
    setPostData(null);

    try {
      const result = await previewMediaDownload(inputUrl.trim());
      setPostData(result);
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Không thể đọc bài viết Instagram.';
      setInspectError(errMsg);
    } finally {
      setIsInspecting(false);
    }
  };

  const copyRawJson = () => {
    if (!postData) return;
    navigator.clipboard.writeText(JSON.stringify(postData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Helper to determine media case details
  const getMediaCaseBadge = (type, photosCount, videosCount) => {
    if (type === 'mixed' || (photosCount > 0 && videosCount > 0)) {
      return {
        label: `Trường hợp 3: Bài viết Hỗn Hợp (${photosCount} Ảnh & ${videosCount} Video cùng tồn tại)`,
        color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        icon: <Layers className="w-4 h-4 text-amber-400" />,
      };
    }
    if (type === 'video' || videosCount > 0) {
      return {
        label: `Trường hợp 2: Bài viết Video / Reel (${videosCount} video)`,
        color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        icon: <VideoIcon className="w-4 h-4 text-purple-400" />,
      };
    }
    return {
      label: `Trường hợp 1: Bài viết chỉ có Ảnh (${photosCount || 1} ảnh)`,
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: <ImageIcon className="w-4 h-4 text-emerald-400" />,
    };
  };

  // Safe author initial resolver avoiding broken surrogate pairs for mathematical / decorative Unicode fonts
  const getAuthorInitial = (author, uploader) => {
    const username = author?.username || '';
    const fullName = author?.full_name || author?.name || '';
    const uploadName = uploader || '';

    // 1. Try clean alphanumeric from username (e.g. "_kikicos_" -> "K")
    const cleanUser = username.replace(/^[^a-zA-Z0-9]+/, '');
    if (cleanUser) {
      return cleanUser.charAt(0).toUpperCase();
    }

    // 2. Safely parse Unicode code points for full_name (handles "𝐾𝑖 𝐾𝑖 🥀" -> "K")
    const target = fullName || uploadName || 'U';
    try {
      const norm = target.normalize('NFKD').replace(/^[^\p{L}\p{N}]+/u, '');
      const chars = Array.from(norm || target);
      if (chars.length > 0 && chars[0] !== '?') {
        return chars[0].toUpperCase();
      }
    } catch {
      // fallback
    }

    const rawChars = Array.from(target);
    return (rawChars[0] || 'U').toUpperCase();
  };

  const photosList = postData?.photos || [];
  const videosList = postData?.videos || [];
  const itemsList = postData?.items || [];
  const mediaBadge = postData ? getMediaCaseBadge(postData.type, photosList.length, videosList.length) : null;
  const executionSteps = postData?.execution_steps || postData?.raw_info?.execution_steps || [];

  return (
    <div
      id="instagram-test-container"
      className="fixed inset-0 w-full h-full bg-[#121316] text-gray-100 flex flex-col overflow-y-auto"
      style={{
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#1a1b1f]/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium transition-colors border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về AppView</span>
          </button>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 bg-clip-text text-transparent">
              Instagram Test Suite
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 font-mono">
              /test/instagram
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Trạng thái Cookie:</span>
            {cookieStatus === 'loading' && (
              <span className="flex items-center gap-1 text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin" /> Đang đọc...
              </span>
            )}
            {cookieStatus === 'valid' && (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đã có (~/.tmp-appview/cookies/instagram.txt)
              </span>
            )}
            {cookieStatus === 'none' && (
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> Chưa có file cookie
              </span>
            )}
            {cookieStatus === 'expired' && (
              <span className="flex items-center gap-1 text-red-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> Cookie hết hạn
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 space-y-8 pb-24">

        {/* Section 1: Cookie Configuration */}
        <section className="bg-[#1a1b1f] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Cookie className="w-5 h-5 text-pink-400" />
                <h2 className="text-base font-bold text-white">Quản lý Cookie Instagram</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Nhập theo các trường token
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Nhập từng trường cookie riêng biệt (không upload file .txt). Sau khi lưu, file sẽ được ghi bảo mật vào{' '}
                <code className="text-pink-300 bg-pink-500/10 px-1 py-0.5 rounded font-mono">~/.tmp-appview/cookies/instagram.txt</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchCookieStatus}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/10 text-xs flex items-center gap-1"
              title="Đọc lại trạng thái file cookie"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cookieStatus === 'loading' ? 'animate-spin' : ''}`} />
              <span>Tải lại trạng thái</span>
            </button>
          </div>

          {/* Cookie Input Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                sessionid <span className="text-pink-400">* (Quan trọng nhất)</span>
              </label>
              <input
                type="text"
                value={cookieFields.sessionid}
                onChange={(e) => handleFieldChange('sessionid', e.target.value)}
                placeholder="vd: 123456789%3Aabc123xyz..."
                className="w-full bg-[#121316] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                ds_user_id <span className="text-gray-500">(Instagram User ID)</span>
              </label>
              <input
                type="text"
                value={cookieFields.ds_user_id}
                onChange={(e) => handleFieldChange('ds_user_id', e.target.value)}
                placeholder="vd: 5829103948"
                className="w-full bg-[#121316] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                csrftoken <span className="text-gray-500">(CSRF Token)</span>
              </label>
              <input
                type="text"
                value={cookieFields.csrftoken}
                onChange={(e) => handleFieldChange('csrftoken', e.target.value)}
                placeholder="vd: abcdef123456..."
                className="w-full bg-[#121316] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                mid <span className="text-gray-500">(Machine ID)</span>
              </label>
              <input
                type="text"
                value={cookieFields.mid}
                onChange={(e) => handleFieldChange('mid', e.target.value)}
                placeholder="vd: Zvab_wAEA..."
                className="w-full bg-[#121316] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                ig_did <span className="text-gray-500">(Device ID)</span>
              </label>
              <input
                type="text"
                value={cookieFields.ig_did}
                onChange={(e) => handleFieldChange('ig_did', e.target.value)}
                placeholder="vd: 12345678-ABCD-..."
                className="w-full bg-[#121316] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                rur / datr <span className="text-gray-500">(Routing / Session)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={cookieFields.rur}
                  onChange={(e) => handleFieldChange('rur', e.target.value)}
                  placeholder="rur"
                  className="w-full bg-[#121316] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors"
                />
                <input
                  type="text"
                  value={cookieFields.datr}
                  onChange={(e) => handleFieldChange('datr', e.target.value)}
                  placeholder="datr"
                  className="w-full bg-[#121316] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleVerifyCookie}
              disabled={isVerifyingCookie || isSavingCookie}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 hover:text-white flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isVerifyingCookie ? <RefreshCw className="w-4 h-4 animate-spin text-pink-400" /> : <ShieldCheck className="w-4 h-4 text-pink-400" />}
              <span>{isVerifyingCookie ? 'Đang xác thực...' : 'Xác thực Cookie'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveCookie}
              disabled={isSavingCookie || isVerifyingCookie}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-pink-600/20 transition-all disabled:opacity-50"
            >
              {isSavingCookie ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSavingCookie ? 'Đang lưu...' : 'Lưu vào ~/.tmp-appview/cookies/instagram.txt'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetForm}
              className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-200 transition-colors ml-auto"
            >
              Xóa trắng
            </button>
          </div>

          {/* Cookie Message Banner */}
          {cookieMsg && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              cookieMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {cookieMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
              <span>{cookieMsg.text}</span>
            </div>
          )}
        </section>

        {/* Section 2: Post Inspector Form */}
        <section className="bg-[#1a1b1f] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-rose-400" />
              <h2 className="text-base font-bold text-white">Trình kiểm tra bài viết Instagram (Inspector)</h2>
            </div>
            <p className="text-xs text-gray-400">
              Quy trình tự động: <strong>Bước 1</strong>: Thử đọc bài viết ẩn danh (không cookie) &rarr; Nếu Instagram trả về <strong>403 Forbidden</strong> &rarr; <strong>Bước 2</strong>: Tự động nạp cookie từ <code className="text-pink-300 font-mono">~/.tmp-appview/cookies/instagram.txt</code> để thử lại.
            </p>
          </div>

          <form onSubmit={handleInspect} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => { setInputUrl(e.target.value); setInspectError(null); }}
                  placeholder="Dán liên kết Instagram: https://www.instagram.com/p/... hoặc /reel/..."
                  className="w-full bg-[#121316] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isInspecting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all disabled:opacity-50"
              >
                {isInspecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang kiểm tra...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Đọc thông tin bài viết</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Inspect Error Message */}
          {inspectError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-red-200">Không thể đọc bài viết:</div>
                <div>{inspectError}</div>
                <div className="text-gray-400 text-[11px] pt-1">
                  Mẹo: Nếu bài viết yêu cầu đăng nhập (403), hãy kiểm tra phần <strong>Quản lý Cookie Instagram</strong> ở trên để nạp <code className="text-pink-300">sessionid</code> hợp lệ.
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Workflow Execution Trace */}
        {executionSteps.length > 0 && (
          <section className="bg-[#1a1b1f] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Tiến trình thực thi theo quy định (Guest-First Policy)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {executionSteps.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${
                    step.status === 'success'
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : step.status === 'failed'
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-200">
                      Bước {step.step}: {step.name}
                    </span>
                    {step.status === 'success' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Thành công
                      </span>
                    )}
                    {step.status === 'failed' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {step.http_code ? `HTTP ${step.http_code}` : 'Chuyển sang Bước 2'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{step.message}</p>
                  {step.cookie_file && (
                    <div className="mt-2 text-[11px] font-mono text-gray-500 truncate">
                      File: {step.cookie_file}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 4: Post Results Presentation */}
        {postData && (
          <section className="bg-[#1a1b1f] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Header: Case Type & Author */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                {postData.author?.avatar ? (
                  <img
                    src={getProxiedImageUrl(postData.author.avatar)}
                    alt={postData.author.username || postData.uploader || 'Avatar'}
                    className="w-14 h-14 rounded-full object-cover border-2 border-pink-500/40 shadow shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextSibling) {
                        e.currentTarget.nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div
                  className={`w-14 h-14 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-2 border-pink-500/40 flex items-center justify-center text-pink-400 font-bold text-lg shrink-0 ${
                    postData.author?.avatar ? 'hidden' : 'flex'
                  }`}
                >
                  {getAuthorInitial(postData.author, postData.uploader)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white">
                      {postData.author?.full_name || postData.uploader}
                    </span>
                    {postData.author?.is_verified && (
                      <span className="text-[11px] px-1.5 py-0.2 rounded bg-blue-500 text-white font-bold">✓</span>
                    )}
                    <a
                      href={postData.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Mở bài viết gốc"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <div className="text-xs text-pink-400 font-mono">
                    @{postData.author?.username || postData.uploader}
                  </div>
                </div>
              </div>

              {/* Media Case Badge */}
              {mediaBadge && (
                <div className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 text-xs font-semibold ${mediaBadge.color}`}>
                  {mediaBadge.icon}
                  <span>{mediaBadge.label}</span>
                </div>
              )}
            </div>

            {/* Post Caption / Content */}
            {postData.content && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nội dung bài viết:</span>
                <div className="bg-[#121316] border border-white/5 rounded-xl p-4 text-xs text-gray-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                  {postData.content}
                </div>
              </div>
            )}

            {/* Metrics & Info Bar */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pt-1">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>{postData.reactions?.likes?.toLocaleString() || 0} lượt thích</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                <span>{postData.reactions?.comments?.toLocaleString() || 0} bình luận</span>
              </div>
              {postData.reactions?.views > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                  <Eye className="w-3.5 h-3.5 text-purple-400" />
                  <span>{postData.reactions.views.toLocaleString()} lượt xem</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 ml-auto">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>{postData.created_time}</span>
              </div>
            </div>

            {/* Media Items Presentation by Scenario */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-pink-400" />
                  <span>Danh sách media trong bài viết ({itemsList.length || photosList.length + videosList.length} phần tử)</span>
                </h4>
              </div>

              {/* Case 1: Photo only grid */}
              {postData.type === 'photo' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {photosList.map((photo, idx) => (
                    <div key={idx} className="bg-[#121316] border border-white/10 rounded-xl overflow-hidden group">
                      <div className="aspect-square relative bg-black/40 overflow-hidden">
                        <img
                          src={photo.url || photo.thumbnail}
                          alt={`Ảnh #${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono backdrop-blur">
                          Ảnh #{idx + 1}
                        </span>
                      </div>
                      <div className="p-3 text-[11px] text-gray-400 space-y-1">
                        {photo.width && photo.height && (
                          <div>Kích thước: {photo.width} × {photo.height}</div>
                        )}
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-pink-400 hover:text-pink-300 flex items-center gap-1 pt-1 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" /> Mở ảnh gốc
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Case 2: Video only */}
              {postData.type === 'video' && (
                <div className="space-y-4">
                  {videosList.map((vid, idx) => (
                    <div key={idx} className="bg-[#121316] border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                          <VideoIcon className="w-4 h-4" /> Video #{idx + 1}
                        </span>
                        {vid.duration > 0 && (
                          <span className="text-xs text-gray-400 font-mono">
                            Thời lượng: {vid.duration.toFixed(1)}s
                          </span>
                        )}
                      </div>

                      {/* Video Player */}
                      {vid.url ? (
                        <div className="max-w-md mx-auto aspect-video sm:aspect-[9/16] max-h-[500px] bg-black rounded-lg overflow-hidden border border-white/10">
                          <video
                            controls
                            poster={vid.thumbnail}
                            src={vid.url}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-black/60 rounded-lg flex items-center justify-center text-gray-500 text-xs">
                          {vid.thumbnail ? (
                            <img src={vid.thumbnail} alt="Thumbnail" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            'Chưa có link video trực tiếp'
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                        {vid.width && vid.height && (
                          <span>Độ phân giải: {vid.width} × {vid.height}</span>
                        )}
                        {vid.url && (
                          <a
                            href={vid.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
                          >
                            <ExternalLink className="w-3 h-3" /> Tải / Mở video stream
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Case 3: Mixed Media (Both Photos and Videos coexisting) */}
              {postData.type === 'mixed' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    Bài viết thuộc <strong>Trường hợp 3 (Hỗn hợp)</strong>: Gồm cả hình ảnh và video cùng nằm trong carousel. Danh sách dưới đây hiển thị đúng theo trình tự gốc của bài viết.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {itemsList.map((item, idx) => {
                      const isVideo = item.type === 'video';
                      return (
                        <div
                          key={idx}
                          className={`bg-[#121316] rounded-xl overflow-hidden border transition-all ${
                            isVideo ? 'border-purple-500/30' : 'border-emerald-500/30'
                          }`}
                        >
                          <div className="aspect-square relative bg-black/40 overflow-hidden">
                            {isVideo ? (
                              item.url ? (
                                <video
                                  controls
                                  poster={item.thumbnail}
                                  src={item.url}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <img
                                  src={item.thumbnail}
                                  alt={`Video #${idx + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              )
                            ) : (
                              <img
                                src={item.url || item.thumbnail}
                                alt={`Ảnh #${idx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            )}

                            {/* Type Badge */}
                            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[11px] font-bold">
                              {isVideo ? (
                                <span className="text-purple-400 flex items-center gap-1">
                                  <VideoIcon className="w-3 h-3" /> Video #{idx + 1}
                                </span>
                              ) : (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" /> Ảnh #{idx + 1}
                                </span>
                              )}
                            </div>

                            {isVideo && item.duration > 0 && (
                              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] text-white font-mono">
                                {item.duration.toFixed(1)}s
                              </div>
                            )}
                          </div>

                          <div className="p-3 text-[11px] text-gray-400 space-y-1">
                            {item.width && item.height && (
                              <div>Kích thước: {item.width} × {item.height}</div>
                            )}
                            <a
                              href={item.url || item.thumbnail}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-1 pt-1 font-medium ${
                                isVideo ? 'text-purple-400 hover:text-purple-300' : 'text-emerald-400 hover:text-emerald-300'
                              }`}
                            >
                              <ExternalLink className="w-3 h-3" /> Mở {isVideo ? 'video' : 'ảnh'} gốc
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Raw JSON Debug Section */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRawJsonOpen(!rawJsonOpen)}
                  className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <Code className="w-4 h-4" />
                  <span>{rawJsonOpen ? 'Ẩn dữ liệu JSON thô' : 'Xem dữ liệu JSON thô (Developer Debug)'}</span>
                </button>

                {rawJsonOpen && (
                  <button
                    type="button"
                    onClick={copyRawJson}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white border border-white/10 transition-colors"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedJson ? 'Đã sao chép' : 'Sao chép JSON'}</span>
                  </button>
                )}
              </div>

              {rawJsonOpen && (
                <pre className="mt-3 bg-[#121316] border border-white/10 rounded-xl p-4 text-[11px] font-mono text-gray-300 max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(postData, null, 2)}
                </pre>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default InstagramTestPage;
