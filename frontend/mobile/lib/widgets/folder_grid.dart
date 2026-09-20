import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/folder_item.dart';
import '../providers/app_state_provider.dart';
import 'folder_action_dialogs.dart';
import 'batch_action_dialog.dart';
import 'rolling_number.dart';

class FolderGrid extends StatelessWidget {
  final List<FolderItem> folders;
  final int? totalCount;

  const FolderGrid({
    super.key,
    required this.folders,
    this.totalCount,
  });

  void _showFolderOptionsModal(BuildContext context, FolderItem folder) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.bgBlock,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF5F6368),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      const Icon(Icons.folder_rounded, color: AppTheme.folderYellow, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          folder.name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(color: AppTheme.borderColor),
                ListTile(
                  leading: const Icon(Icons.drive_file_rename_outline_rounded, color: AppTheme.googleBlue),
                  title: const Text('Đổi tên thư mục', style: TextStyle(color: Colors.white, fontSize: 14)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    RenameFolderDialog.show(context, folder);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.copy_rounded, color: Color(0xFF8AB4F8)),
                  title: const Text('Sao chép thư mục', style: TextStyle(color: Colors.white, fontSize: 14)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    BatchActionDialog.show(
                      context,
                      action: 'copy',
                      items: [
                        {'type': 'folder', 'name': folder.name, 'path': folder.path}
                      ],
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.drive_file_move_rounded, color: Colors.amber),
                  title: const Text('Di chuyển thư mục', style: TextStyle(color: Colors.white, fontSize: 14)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    BatchActionDialog.show(
                      context,
                      action: 'move',
                      items: [
                        {'type': 'folder', 'name': folder.name, 'path': folder.path}
                      ],
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                  title: const Text('Xóa thư mục', style: TextStyle(color: Colors.redAccent, fontSize: 14)),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    BatchActionDialog.show(
                      context,
                      action: 'delete',
                      items: [
                        {'type': 'folder', 'name': folder.name, 'path': folder.path}
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (folders.isEmpty) return const SizedBox.shrink();
    final appState = context.watch<AppStateProvider>();
    final isSelectMode = appState.isSelectMode;
    final isAllFoldersSelected = appState.isAllFoldersSelected;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Title
          Padding(
            padding: const EdgeInsets.only(left: 4, right: 4, bottom: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.folder_rounded, size: 16, color: AppTheme.folderYellow),
                    const SizedBox(width: 6),
                    const Text(
                      'THƯ MỤC',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.0,
                        color: Color(0xFF9AA0A6),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('(', style: TextStyle(fontSize: 13, fontFamily: 'monospace', color: Color(0xFF80868B))),
                        RollingNumber(
                          value: folders.length,
                          style: const TextStyle(
                            fontSize: 13,
                            fontFamily: 'monospace',
                            color: Color(0xFF80868B),
                          ),
                        ),
                        if (totalCount != null && totalCount! > folders.length) ...[
                          const Text('/', style: TextStyle(fontSize: 13, fontFamily: 'monospace', color: Color(0xFF80868B))),
                          RollingNumber(
                            value: totalCount!,
                            style: const TextStyle(
                              fontSize: 13,
                              fontFamily: 'monospace',
                              color: Color(0xFF80868B),
                            ),
                          ),
                        ],
                        const Text(')', style: TextStyle(fontSize: 13, fontFamily: 'monospace', color: Color(0xFF80868B))),
                      ],
                    ),
                  ],
                ),
                if (isSelectMode)
                  GestureDetector(
                    onTap: () => appState.toggleSelectAllFolders(),
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: isAllFoldersSelected ? AppTheme.googleBlue : const Color(0xFF28292D),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isAllFoldersSelected ? AppTheme.googleBlue : const Color(0xFF383C42),
                          width: 1.8,
                        ),
                        boxShadow: [
                          if (isAllFoldersSelected)
                            BoxShadow(
                              color: AppTheme.googleBlue.withValues(alpha: 0.3),
                              blurRadius: 6,
                            ),
                        ],
                      ),
                      child: isAllFoldersSelected
                          ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                          : null,
                    ),
                  ),
              ],
            ),
          ),

          // Square cards — same width as PictureGrid.
          // childAspectRatio: 1.0 makes the cell square.
          // Footer is compact so icon area = most of the square.
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: folders.length,
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 180,
              childAspectRatio: 1.0,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemBuilder: (context, index) {
              final folder = folders[index];
              return _buildFolderCard(context, folder);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildFolderCard(BuildContext context, FolderItem folder) {
    final appState = context.watch<AppStateProvider>();
    final isSelectMode = appState.isSelectMode;
    final isSelected = appState.isFolderSelected(folder.path);

    final Color iconColor = isSelected ? AppTheme.googleBlue : AppTheme.folderYellow;
    final Color bgTint = isSelected
        ? AppTheme.googleBlue.withValues(alpha: 0.08)
        : AppTheme.folderYellow.withValues(alpha: 0.06);

    return InkWell(
      onTap: () {
        if (isSelectMode) {
          appState.toggleSelectItem(type: 'folder', path: folder.path);
        } else {
          appState.navigateTo(folder.path);
        }
      },
      onLongPress: () {
        if (!isSelectMode) {
          appState.enterSelectModeWithItem(type: 'folder', path: folder.path);
        } else {
          _showFolderOptionsModal(context, folder);
        }
      },
      borderRadius: AppTheme.borderRadius,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF1E2638) : AppTheme.bgCard,
          borderRadius: AppTheme.borderRadius,
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? AppTheme.googleBlue.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.2),
              blurRadius: isSelected ? 8 : 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        foregroundDecoration: BoxDecoration(
          borderRadius: AppTheme.borderRadius,
          border: Border.all(
            color: isSelected ? AppTheme.googleBlue : AppTheme.borderColor,
            width: isSelected ? 2.0 : 1.0,
          ),
        ),
        child: ClipRRect(
          borderRadius: AppTheme.borderRadius,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Icon area — Expanded fills most of the square card.
              Expanded(
                child: Stack(
                  children: [
                    // Full-bleed background tint
                    Positioned.fill(child: Container(color: bgTint)),

                    // Icon with guaranteed top spacing:
                    // SizedBox(10) = hard 10px gap from top (≥5% of 180px cell).
                    // Icon is then centered in the remaining space below.
                    Positioned.fill(
                      child: Column(
                        children: [
                          const SizedBox(height: 10), // hard top spacer ≥5%
                          Expanded(
                            child: Center(
                              child: Icon(Icons.folder_rounded, size: 82, color: iconColor),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Select checkbox — top-left, same style as picture/video cards
                    if (isSelectMode)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppTheme.googleBlue
                                : Colors.black.withValues(alpha: 0.5),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isSelected
                                  ? Colors.white
                                  : Colors.white.withValues(alpha: 0.8),
                              width: 1.8,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.4),
                                blurRadius: 4,
                              ),
                            ],
                          ),
                          child: isSelected
                              ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                              : null,
                        ),
                      ),
                  ],
                ),
              ),

              // Footer — compact padding so it doesn't eat too much of the square.
              // top/bottom: 6px (tighter than picture/video's 8px).
              Container(
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(
                      color: isSelected
                          ? AppTheme.googleBlue.withValues(alpha: 0.18)
                          : AppTheme.folderYellow.withValues(alpha: 0.10),
                    ),
                  ),
                ),
                padding: const EdgeInsets.only(left: 10, right: 2, top: 6, bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        folder.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: isSelected ? AppTheme.googleBlue : Colors.white,
                        ),
                      ),
                    ),
                    if (isSelectMode)
                      const SizedBox(width: 4)
                    else
                      IconButton(
                        icon: const Icon(Icons.more_vert_rounded,
                            color: Color(0xFF80868B), size: 18),
                        onPressed: () => _showFolderOptionsModal(context, folder),
                        padding: EdgeInsets.zero,
                        alignment: Alignment.center,
                        constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                        splashRadius: 18,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
