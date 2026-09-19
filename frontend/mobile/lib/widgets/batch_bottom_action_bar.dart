import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state_provider.dart';
import 'batch_action_dialog.dart';

class BatchBottomActionBar extends StatelessWidget {
  const BatchBottomActionBar({super.key});

  List<Map<String, dynamic>> _collectSelectedItems(AppStateProvider appState) {
    final List<Map<String, dynamic>> list = [];

    for (final folderPath in appState.selectedFolderPaths) {
      final name = folderPath.split('/').lastWhere((p) => p.isNotEmpty, orElse: () => folderPath);
      list.add({
        'type': 'folder',
        'name': name,
        'path': folderPath,
      });
    }

    for (final picPath in appState.selectedPicturePaths) {
      final name = picPath.split('/').lastWhere((p) => p.isNotEmpty, orElse: () => picPath);
      list.add({
        'type': 'picture',
        'name': name,
        'path': picPath,
      });
    }

    for (final vidPath in appState.selectedVideoPaths) {
      final name = vidPath.split('/').lastWhere((p) => p.isNotEmpty, orElse: () => vidPath);
      list.add({
        'type': 'video',
        'name': name,
        'path': vidPath,
      });
    }

    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppStateProvider>(
      builder: (context, appState, child) {
        final isVisible = appState.isSelectMode && appState.totalSelectedCount > 0;

        return AnimatedPositioned(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic,
          left: 16,
          right: 16,
          bottom: isVisible ? 24 : -100,
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 200),
            opacity: isVisible ? 1.0 : 0.0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF1E2024),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: const Color(0xFF383C42)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  // Move action
                  Expanded(
                    child: _buildActionButton(
                      icon: Icons.drive_file_move_rounded,
                      label: 'Di chuyển',
                      color: Colors.amberAccent,
                      onTap: () {
                        final items = _collectSelectedItems(appState);
                        BatchActionDialog.show(context, action: 'move', items: items);
                      },
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Copy action
                  Expanded(
                    child: _buildActionButton(
                      icon: Icons.copy_rounded,
                      label: 'Sao chép',
                      color: const Color(0xFF8AB4F8),
                      onTap: () {
                        final items = _collectSelectedItems(appState);
                        BatchActionDialog.show(context, action: 'copy', items: items);
                      },
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Delete action
                  Expanded(
                    child: _buildActionButton(
                      icon: Icons.delete_outline_rounded,
                      label: 'Xóa',
                      color: Colors.redAccent,
                      onTap: () {
                        final items = _collectSelectedItems(appState);
                        BatchActionDialog.show(context, action: 'delete', items: items);
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withValues(alpha: 0.25)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 17),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
