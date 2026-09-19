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

          // Items Grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: folders.length,
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 220,
              mainAxisExtent: 82,
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
        padding: const EdgeInsets.only(left: 10, right: 8, top: 8, bottom: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF1E2638) : AppTheme.bgCard,
          borderRadius: AppTheme.borderRadius,
          border: Border.all(
            color: isSelected ? AppTheme.googleBlue : AppTheme.borderColor,
            width: isSelected ? 1.8 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? AppTheme.googleBlue.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.15),
              blurRadius: isSelected ? 8 : 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isSelected
                    ? AppTheme.googleBlue.withValues(alpha: 0.2)
                    : AppTheme.folderYellow.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSelected
                      ? AppTheme.googleBlue.withValues(alpha: 0.4)
                      : AppTheme.folderYellow.withValues(alpha: 0.25),
                ),
              ),
              child: Icon(
                Icons.folder_rounded,
                color: isSelected ? AppTheme.googleBlue : AppTheme.folderYellow,
                size: 20,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    folder.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    folder.path,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: Color(0xFF9AA0A6),
                    ),
                  ),
                ],
              ),
            ),
            if (isSelectMode)
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: isSelected ? AppTheme.googleBlue : Colors.transparent,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.6),
                    width: 1.8,
                  ),
                ),
                child: isSelected
                    ? const Icon(Icons.check_rounded, size: 15, color: Colors.white)
                    : null,
              )
            else
              IconButton(
                icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF80868B), size: 18),
                onPressed: () => _showFolderOptionsModal(context, folder),
                padding: EdgeInsets.zero,
                alignment: Alignment.center,
                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                splashRadius: 18,
              ),
          ],
        ),
      ),
    );
  }
}
