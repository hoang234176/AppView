import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/app_state_provider.dart';

class EmptyStateView extends StatelessWidget {
  const EmptyStateView({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppStateProvider>(
      builder: (context, appState, child) {
        final query = appState.searchQuery;

        return Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 420),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppTheme.bgCard,
                borderRadius: AppTheme.borderRadius,
                border: Border.all(color: AppTheme.borderColor),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: AppTheme.googleBlue.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppTheme.googleBlue.withValues(alpha: 0.3)),
                    ),
                    child: const Icon(
                      Icons.folder_off_rounded,
                      color: AppTheme.googleBlue,
                      size: 28,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Thư mục này trống',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    query.isNotEmpty
                        ? 'Không tìm thấy mục khớp với "$query"'
                        : 'Chưa có thư mục con, hình ảnh hoặc video nào tại đường dẫn này.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF9AA0A6),
                      height: 1.4,
                    ),
                  ),
                  if (query.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: () => appState.clearSearch(),
                      icon: const Icon(Icons.clear_rounded, size: 16),
                      label: const Text('Xóa bộ lọc tìm kiếm', style: TextStyle(fontSize: 15)),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
