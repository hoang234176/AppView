import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/api_result.dart';
import 'config_api_dialog.dart';

class ErrorStateView extends StatelessWidget {
  final ApiErrorInfo errorInfo;
  final VoidCallback onRetry;

  const ErrorStateView({
    super.key,
    required this.errorInfo,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 600),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF450A0A).withValues(alpha: 0.35),
            borderRadius: AppTheme.borderRadius,
            border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.4)),
            boxShadow: [
              BoxShadow(
                color: AppTheme.errorRed.withValues(alpha: 0.1),
                blurRadius: 20,
                spreadRadius: 2,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with Status Badge
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppTheme.errorRed.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.4)),
                    ),
                    child: const Icon(
                      Icons.warning_amber_rounded,
                      color: AppTheme.errorRed,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppTheme.errorRed.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppTheme.errorRed.withValues(alpha: 0.3)),
                              ),
                              child: Text(
                                'HTTP Status: ${errorInfo.status ?? 0}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: 'monospace',
                                  color: Color(0xFFFCA5A5),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'KẾT NỐI THẤT BẠI',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.8,
                                color: AppTheme.errorRed,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          errorInfo.message,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Request URL box
              if (errorInfo.requestUrl != null && errorInfo.requestUrl!.isNotEmpty) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF18191C),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.borderColor),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.language_rounded, size: 14, color: AppTheme.googleBlue),
                          const SizedBox(width: 6),
                          const Text(
                            'Endpoint URL:',
                            style: TextStyle(fontSize: 13, color: Color(0xFF9AA0A6), fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      SelectableText(
                        errorInfo.requestUrl!,
                        style: const TextStyle(
                          fontSize: 13,
                          fontFamily: 'monospace',
                          color: AppTheme.googleBlueHover,
                        ),
                      ),
                      if (errorInfo.details != null && errorInfo.details!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        const Divider(color: AppTheme.borderColor, height: 1),
                        const SizedBox(height: 8),
                        const Text(
                          'Chi tiết phản hồi từ Server:',
                          style: TextStyle(fontSize: 12, color: Color(0xFFFBBC05), fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        SelectableText(
                          errorInfo.details!,
                          style: const TextStyle(
                            fontSize: 12,
                            fontFamily: 'monospace',
                            color: Color(0xFFFCA5A5),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],

              // Troubleshooting tips
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.bgCard,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.borderColor),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.help_outline_rounded, size: 14, color: Color(0xFFFDE047)),
                        SizedBox(width: 6),
                        Text(
                          'Gợi ý khắc phục:',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFFDE047)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      '• Kiểm tra backend API tại địa chỉ máy chủ có đang bật không.\n'
                      '• Đảm bảo điện thoại cùng mạng Wi-Fi/LAN với server.\n'
                      '• Nếu đổi mạng, hãy dùng nút Cấu hình API để đổi IP phù hợp.',
                      style: TextStyle(fontSize: 13, color: Color(0xFFBDC1C6), height: 1.4),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Actions
              Row(
                children: [
                  ElevatedButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: const Text('Thử lại kết nối', style: TextStyle(fontSize: 15)),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton.icon(
                    onPressed: () => ConfigApiDialog.show(context),
                    icon: const Icon(Icons.settings_rounded, size: 16),
                    label: const Text('Đổi máy chủ API', style: TextStyle(fontSize: 15)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
