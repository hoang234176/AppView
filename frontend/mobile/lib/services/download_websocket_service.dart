import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../api/api_config.dart';

class DownloadWebSocketService {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  bool _isDisposed = false;
  final Function(Map<String, dynamic>) onEvent;

  DownloadWebSocketService({required this.onEvent});

  void connect() {
    _isDisposed = false;
    final wsUrl = ApiConfig.downloadWsUrl;
    try {
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      if (kDebugMode) {
        print('[MOBILE WS DOWNLOAD] Kết nối đến: $wsUrl');
      }

      _subscription = _channel!.stream.listen(
        (message) {
          try {
            final data = jsonDecode(message.toString());
            if (data is Map<String, dynamic>) {
              onEvent(data);
            }
          } catch (e) {
            if (kDebugMode) {
              print('[MOBILE WS DOWNLOAD] Lỗi parse message: $e');
            }
          }
        },
        onError: (error) {
          if (kDebugMode) {
            print('[MOBILE WS DOWNLOAD] Lỗi WebSocket: $error');
          }
          _scheduleReconnect();
        },
        onDone: () {
          if (kDebugMode) {
            print('[MOBILE WS DOWNLOAD] Kết nối kết thúc');
          }
          _scheduleReconnect();
        },
      );
    } catch (e) {
      if (kDebugMode) {
        print('[MOBILE WS DOWNLOAD] Lỗi khởi tạo: $e');
      }
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (_isDisposed) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      if (!_isDisposed) {
        connect();
      }
    });
  }

  void disconnect() {
    _isDisposed = true;
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    _channel?.sink.close();
    _channel = null;
  }
}
