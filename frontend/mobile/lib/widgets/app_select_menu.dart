import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

enum AppSelectSize { sm, md }
enum AppSelectAccent { blue, purple, amber, red }

class AppSelectItem<T> {
  final T value;
  final String label;

  const AppSelectItem({required this.value, required this.label});
}

/// Custom AppView-styled dropdown selector matching the AppView visual language.
/// Opens a styled popover menu with bounded height and scrolling to prevent clipping.
class AppSelectMenu<T> extends StatelessWidget {
  final List<AppSelectItem<T>> items;
  final T? value;
  final ValueChanged<T> onChanged;
  final bool disabled;
  final String placeholder;
  final AppSelectSize size;
  final AppSelectAccent accent;
  final double? width;

  const AppSelectMenu({
    super.key,
    required this.items,
    required this.value,
    required this.onChanged,
    this.disabled = false,
    this.placeholder = 'Chọn...',
    this.size = AppSelectSize.md,
    this.accent = AppSelectAccent.blue,
    this.width,
  });

  Color _getAccentColor() {
    switch (accent) {
      case AppSelectAccent.purple:
        return AppTheme.videoPurple;
      case AppSelectAccent.amber:
        return Colors.amber;
      case AppSelectAccent.red:
        return AppTheme.errorRed;
      case AppSelectAccent.blue:
        return AppTheme.googleBlue;
    }
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = _getAccentColor();
    final isSm = size == AppSelectSize.sm;

    final selectedItem = items.where((i) => i.value == value).firstOrNull;

    return Theme(
      data: Theme.of(context).copyWith(
        // Override highlightColor so Flutter's _PopupMenu does not wrap the
        // initialValue item in a ColoredBox(color: highlightColor) that produces
        // the heavy light/gray selection rectangle.
        highlightColor: Colors.transparent,
        popupMenuTheme: PopupMenuThemeData(
          color: AppTheme.bgBlock,
          surfaceTintColor: Colors.transparent,
          elevation: 12,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: AppTheme.borderColor),
          ),
        ),
      ),
      child: PopupMenuButton<T>(
        enabled: !disabled && items.isNotEmpty,
        tooltip: '',
        initialValue: value,
        constraints: const BoxConstraints(
          maxHeight: 250,
          minWidth: 130,
        ),
        position: PopupMenuPosition.under,
        offset: const Offset(0, 4),
        color: AppTheme.bgBlock,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppTheme.borderColor),
        ),
        onSelected: (val) {
          if (!disabled) {
            onChanged(val);
          }
        },
        itemBuilder: (BuildContext ctx) {
          return items.map((item) {
            final isSelected = item.value == value;
            return PopupMenuItem<T>(
              value: item.value,
              height: isSm ? 36 : 40,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: isSelected
                      ? accentColor.withValues(alpha: 0.10)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.label,
                        style: TextStyle(
                          fontSize: isSm ? 11.5 : 12.5,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          color: isSelected ? accentColor : Colors.white,
                        ),
                      ),
                    ),
                    if (isSelected) ...[
                      const SizedBox(width: 8),
                      Icon(
                        Icons.check_rounded,
                        color: accentColor,
                        size: isSm ? 15 : 17,
                      ),
                    ],
                  ],
                ),
              ),
            );
          }).toList();
        },
        child: Container(
          width: width,
          padding: EdgeInsets.symmetric(
            horizontal: isSm ? 10 : 12,
            vertical: isSm ? 6 : 9,
          ),
          decoration: BoxDecoration(
            color: AppTheme.bgCard,
            borderRadius: BorderRadius.circular(isSm ? 10 : 12),
            border: Border.all(
              color: disabled
                  ? AppTheme.borderColorSubtle
                  : (selectedItem != null
                      ? accentColor.withValues(alpha: 0.4)
                      : AppTheme.borderColor),
            ),
          ),
          child: Row(
            mainAxisSize: width != null ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  selectedItem != null ? selectedItem.label : placeholder,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: isSm ? 11.5 : 12.5,
                    fontWeight: selectedItem != null ? FontWeight.w600 : FontWeight.normal,
                    color: disabled
                        ? Colors.white38
                        : (selectedItem != null ? accentColor : Colors.white54),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Icon(
                Icons.keyboard_arrow_down_rounded,
                color: disabled
                    ? Colors.white24
                    : (selectedItem != null ? accentColor : Colors.white54),
                size: isSm ? 16 : 18,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
