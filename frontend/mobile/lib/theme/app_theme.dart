import 'package:flutter/material.dart';

class AppTheme {
  AppTheme._();

  // Tahoe Dark Colors from web/src/styles/index.css
  static const Color bgApp = Color(0xFF0B0C0E);
  static const Color bgBlock = Color(0xFF1C1D21);
  static const Color bgCard = Color(0xFF202124);
  static const Color bgSearch = Color(0xFF28292D);
  static const Color bgHover = Color(0xFF2D2F31);
  static const Color borderColor = Color(0xFF383C42);
  static const Color borderColorSubtle = Color(0x66383C42);

  // Accent Colors
  static const Color googleBlue = Color(0xFF8AB4F8);
  static const Color googleBlueHover = Color(0xFFAECBFA);
  static const Color folderYellow = Color(0xFFFDE047);
  static const Color folderYellowDeep = Color(0xFFEAB308);
  static const Color videoPurple = Color(0xFFC084FC);
  static const Color videoPurpleDeep = Color(0xFF9333EA);
  static const Color errorRed = Color(0xFFEF4444);
  static const Color errorRedDark = Color(0xFF450A0A);
  // Đồng bộ Tailwind web: text-gray-400 và text-emerald-400.
  static const Color downloadSizeColor = Color(0xFF9CA3AF);
  static const Color downloadSpeedColor = Color(0xFF34D399);

  // Global Rounded Radius Tokens
  static const double radius = 28.0;
  static final BorderRadius borderRadius = BorderRadius.circular(radius);
  static const double radiusCard = 18.0;
  static final BorderRadius borderRadiusCard = BorderRadius.circular(radiusCard);
  static const double radiusPill = 999.0;
  static final BorderRadius borderRadiusPill = BorderRadius.circular(radiusPill);

  // Surface & Input Backgrounds
  static const Color bgDialog = Color(0xFF1C1D21);
  static const Color bgInput = Color(0xFF131417);
  static const Color borderStroke = Color(0x1FFFFFFF); // Colors.white.withValues(alpha: 0.12)

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgApp,
      primaryColor: googleBlue,
      canvasColor: bgBlock,
      cardColor: bgCard,
      dividerColor: borderColor,
      colorScheme: const ColorScheme.dark(
        primary: googleBlue,
        onPrimary: bgBlock,
        secondary: videoPurple,
        onSecondary: Colors.white,
        surface: bgBlock,
        onSurface: Color(0xFFE8EAED),
        error: errorRed,
        outline: borderColor,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: bgBlock,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: bgDialog,
        shape: RoundedRectangleBorder(
          borderRadius: borderRadius,
          side: const BorderSide(color: borderColor),
        ),
      ),
      cardTheme: CardThemeData(
        color: bgCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: borderRadiusCard,
          side: const BorderSide(color: borderColor),
        ),
      ),
      textTheme: const TextTheme(
        bodyLarge: TextStyle(fontSize: 16),
        bodyMedium: TextStyle(fontSize: 14),
        bodySmall: TextStyle(fontSize: 12),
        titleLarge: TextStyle(fontSize: 20),
        titleMedium: TextStyle(fontSize: 18),
        titleSmall: TextStyle(fontSize: 16),
        labelLarge: TextStyle(fontSize: 16),
        labelMedium: TextStyle(fontSize: 14),
        labelSmall: TextStyle(fontSize: 13),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgInput,
        hintStyle: const TextStyle(color: Color(0xFF9AA0A6), fontSize: 13.5),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: borderRadiusPill,
          borderSide: const BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: borderRadiusPill,
          borderSide: const BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: borderRadiusPill,
          borderSide: const BorderSide(color: googleBlue, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: googleBlue,
          foregroundColor: const Color(0xFF1C1D21),
          shape: const StadiumBorder(),
          elevation: 0,
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFFE8EAED),
          backgroundColor: bgCard,
          side: const BorderSide(color: borderColor),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        ),
      ),
    );
  }
}
