import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/app_state_provider.dart';
import '../providers/download_provider.dart';
import '../screens/download_screen.dart';

class AppHeader extends StatefulWidget {
  final VoidCallback onOpenDrawer;

  const AppHeader({super.key, required this.onOpenDrawer});

  @override
  State<AppHeader> createState() => _AppHeaderState();
}

class _AppHeaderState extends State<AppHeader>
    with SingleTickerProviderStateMixin {
  bool _isSearching = false;
  late TextEditingController _searchController;
  late final AnimationController _downloadArrowController;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _downloadArrowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  // Khớp nhịp CSS trên Web: nghỉ → chạm khay U/mờ → hiện ở trên → về gốc.
  double _arrowOffsetAt(double phase) {
    if (phase <= 0.18) return 0;
    if (phase <= 0.55) return (phase - 0.18) / 0.37 * 4.5;
    if (phase <= 0.65) return 4.5 + (phase - 0.55) / 0.10 * 0.5;
    if (phase <= 0.66) return 5;
    if (phase <= 0.84) return -4 + (phase - 0.66) / 0.18 * 4;
    return 0;
  }

  double _arrowOpacityAt(double phase) {
    if (phase <= 0.55) return 1;
    if (phase <= 0.65) return 1 - (phase - 0.55) / 0.10;
    if (phase <= 0.66) return 0;
    if (phase <= 0.84) return (phase - 0.66) / 0.18;
    return 1;
  }

  @override
  void dispose() {
    _searchController.dispose();
    _downloadArrowController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppStateProvider>(
      builder: (context, appState, child) {
        if (_searchController.text != appState.searchQuery) {
          _searchController.text = appState.searchQuery;
        }

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AppTheme.bgBlock,
              borderRadius: AppTheme.borderRadius,
              border: Border.all(color: AppTheme.borderColor),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child:
                _isSearching
                    ? _buildSearchBar(appState)
                    : _buildDefaultHeader(appState),
          ),
        );
      },
    );
  }

  Widget _buildDefaultHeader(AppStateProvider appState) {
    final downloadProvider = context.watch<DownloadProvider>();
    final activeCount = downloadProvider.activeCount;
    final isDownloading = downloadProvider.isDownloadingMode;
    final percent = downloadProvider.aggregatePercent;
    final hasPasswordError = downloadProvider.hasDownloadAttention;
    final isScanning = downloadProvider.isScanning;
    final isConverting = downloadProvider.isConverting;

    // Màu icon download theo từng stage (đồng bộ với Web)
    final Color iconColor =
        activeCount > 0
            ? hasPasswordError
                ? Colors.amberAccent
                : isConverting
                ? Colors.purpleAccent
                : isScanning
                ? Colors.greenAccent
                : isDownloading
                ? AppTheme.googleBlue
                : Colors.orangeAccent
            : Colors.white70;

    // Màu progress ring
    final Color ringColor =
        activeCount > 0
            ? hasPasswordError
                ? Colors.amberAccent
                : isConverting
                ? Colors.purpleAccent
                : isScanning
                ? Colors.greenAccent
                : isDownloading
                ? AppTheme.googleBlue
                : Colors.orangeAccent
            : Colors.transparent;

    final double? progressValue =
        isDownloading && percent > 0 ? (percent / 100.0).clamp(0.0, 1.0) : null;

    return Row(
      children: [
        // Drawer Menu Hamburger Button
        IconButton(
          onPressed: widget.onOpenDrawer,
          icon: const Icon(
            Icons.menu_rounded,
            color: AppTheme.googleBlue,
            size: 22,
          ),
          tooltip: 'Mở danh mục thư mục',
          style: IconButton.styleFrom(
            backgroundColor: AppTheme.bgCard,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppTheme.borderColor),
            ),
            padding: const EdgeInsets.all(8),
            minimumSize: const Size(40, 40),
          ),
        ),
        const SizedBox(width: 10),

        // Brand Logo
        InkWell(
          onTap: () => appState.navigateTo(''),
          borderRadius: BorderRadius.circular(16),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 34,
                height: 34,
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: const LinearGradient(
                    colors: [
                      Color(0xFF4285F4),
                      Color(0xFF34A853),
                      Color(0xFFFBBC05),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppTheme.bgBlock,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: SvgPicture.asset(
                    'assets/icons/app_icon.svg',
                    width: 18,
                    height: 18,
                    colorFilter: const ColorFilter.mode(
                      AppTheme.googleBlue,
                      BlendMode.srcIn,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'AppView',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),

        const Spacer(),

        // Download Header Action Button — icon + ring đồng bộ màu theo stage
        GestureDetector(
          onTap: () {
            if (!appState.isServerConnected) return;
            DownloadScreen.navigateTo(
              context,
              currentPath: appState.currentPath,
            );
          },
          child: AnimatedContainer(
            width: 40,
            height: 40,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOutCubic,
            decoration: BoxDecoration(
              color: AppTheme.bgCard,
              // Khi có task, viền Tahoe bo dần thành vòng tròn đồng tâm với
              // progress ring; hết task thì mở lại đúng hình nút ban đầu.
              borderRadius: BorderRadius.circular(activeCount > 0 ? 20 : 16),
              border: Border.all(color: AppTheme.borderColor),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Progress ring
                if (activeCount > 0)
                  SizedBox(
                    width: 30,
                    height: 30,
                    child: CircularProgressIndicator(
                      value: progressValue,
                      strokeWidth: 2.5,
                      color: ringColor,
                      backgroundColor: const Color(0xFF383C42),
                    ),
                  ),
                // Download icon SVG — đồng bộ với Web (mũi tên + khay)
                AnimatedBuilder(
                  animation: _downloadArrowController,
                  builder: (_, __) {
                    final isActiveDownload = activeCount > 0 && isDownloading;
                    final phase = _downloadArrowController.value;
                    return CustomPaint(
                      size: const Size(18, 18),
                      painter: _DownloadIconPainter(
                        color: iconColor,
                        arrowOffset:
                            isActiveDownload ? _arrowOffsetAt(phase) : 0,
                        arrowOpacity:
                            isActiveDownload ? _arrowOpacityAt(phase) : 1,
                      ),
                    );
                  },
                ),
                // Red dot badge khi có lỗi mật khẩu
                if (hasPasswordError)
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: Colors.amberAccent,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSearchBar(AppStateProvider appState) {
    return Row(
      children: [
        IconButton(
          onPressed: () {
            setState(() => _isSearching = false);
            appState.clearSearch();
          },
          icon: const Icon(
            Icons.arrow_back_rounded,
            color: Colors.white,
            size: 20,
          ),
          tooltip: 'Đóng tìm kiếm',
          style: IconButton.styleFrom(
            backgroundColor: AppTheme.bgCard,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppTheme.borderColor),
            ),
            padding: const EdgeInsets.all(8),
            minimumSize: const Size(38, 38),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Container(
            height: 38,
            decoration: BoxDecoration(
              color: AppTheme.bgCard,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: AppTheme.googleBlue.withValues(alpha: 0.8),
              ),
            ),
            child: TextField(
              controller: _searchController,
              autofocus: true,
              textAlignVertical: TextAlignVertical.center,
              style: const TextStyle(color: Colors.white, fontSize: 15),
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => FocusManager.instance.primaryFocus?.unfocus(),
              decoration: InputDecoration(
                isDense: true,
                filled: false,
                hintText: 'Tìm kiếm ảnh, video và thư mục...',
                hintStyle: const TextStyle(
                  color: Color(0xFF80868B),
                  fontSize: 14,
                ),
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  color: AppTheme.googleBlue,
                  size: 18,
                ),
                prefixIconConstraints: const BoxConstraints(
                  minWidth: 36,
                  minHeight: 36,
                ),
                suffixIconConstraints: const BoxConstraints(
                  minWidth: 36,
                  minHeight: 36,
                ),
                suffixIcon:
                    _searchController.text.isNotEmpty
                        ? IconButton(
                          icon: const Icon(
                            Icons.clear_rounded,
                            color: Colors.grey,
                            size: 16,
                          ),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(
                            minWidth: 32,
                            minHeight: 32,
                          ),
                          splashRadius: 16,
                          onPressed: () {
                            _searchController.clear();
                            appState.clearSearch();
                            setState(() {});
                          },
                        )
                        : null,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 8,
                ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
              ),
              onChanged: (val) {
                appState.setSearchQuery(val);
                setState(() {});
              },
            ),
          ),
        ),
      ],
    );
  }
}

/// CustomPainter vẽ icon download đồng bộ với Web SVG:
/// - Mũi tên xuống (line + chevron)
/// - Khay chữ U phía dưới
class _DownloadIconPainter extends CustomPainter {
  final Color color;
  final double arrowOffset;
  final double arrowOpacity;
  const _DownloadIconPainter({
    required this.color,
    this.arrowOffset = 0,
    this.arrowOpacity = 1,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint =
        Paint()
          ..color = color
          ..strokeWidth = 1.8
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..style = PaintingStyle.stroke;

    final double w = size.width;
    final double h = size.height;

    // Mũi tên dọc: chuyển động độc lập; khay chữ U phía dưới đứng yên.
    canvas.save();
    canvas.translate(0, arrowOffset);
    paint.color = color.withValues(alpha: arrowOpacity);
    canvas.drawLine(Offset(w * 0.5, h * 0.1), Offset(w * 0.5, h * 0.58), paint);

    // Chevron: \ /
    final arrowPath =
        Path()
          ..moveTo(w * 0.28, h * 0.38)
          ..lineTo(w * 0.5, h * 0.60)
          ..lineTo(w * 0.72, h * 0.38);
    canvas.drawPath(arrowPath, paint);
    canvas.restore();

    // Khay chữ U giống hệt SVG web: đáy thẳng, chỉ bo nhẹ hai góc.
    // Không dùng arcToPoint lớn vì nó biến khay thành nửa vòng tròn.
    paint.color = color;
    final trayPath =
        Path()
          ..moveTo(w * (4 / 24), h * (15.5 / 24))
          ..lineTo(w * (4 / 24), h * (18.5 / 24))
          ..quadraticBezierTo(
            w * (4 / 24),
            h * (20 / 24),
            w * (5.5 / 24),
            h * (20 / 24),
          )
          ..lineTo(w * (18.5 / 24), h * (20 / 24))
          ..quadraticBezierTo(
            w * (20 / 24),
            h * (20 / 24),
            w * (20 / 24),
            h * (18.5 / 24),
          )
          ..lineTo(w * (20 / 24), h * (15.5 / 24));
    canvas.drawPath(trayPath, paint);
  }

  @override
  bool shouldRepaint(_DownloadIconPainter oldDelegate) =>
      oldDelegate.color != color ||
      oldDelegate.arrowOffset != arrowOffset ||
      oldDelegate.arrowOpacity != arrowOpacity;
}
