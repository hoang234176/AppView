import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../api/api_config.dart';

typedef FilesystemEventHandler = void Function(Map<String, dynamic> event);
typedef RealtimeConnectedHandler = void Function();

/// One bounded-retry Coordinator invalidation socket for the mobile app.
/// Events are best-effort, so every successful connection asks the owner to
/// refetch canonical state rather than relying on replay.
class FilesystemEventsService {
  FilesystemEventsService({
    required FilesystemEventHandler onEvent,
    required RealtimeConnectedHandler onConnected,
  }) : _onEvent = onEvent,
       _onConnected = onConnected;

  final FilesystemEventHandler _onEvent;
  final RealtimeConnectedHandler _onConnected;
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _reconnectTimer;
  bool _stopped = true;
  int _attempt = 0;

  void start() {
    if (!_stopped) {
      if (_channel == null && _reconnectTimer == null) {
        _connect();
      }
      return;
    }
    _stopped = false;
    _connect();
  }

  Future<void> _connect() async {
    if (_stopped || _channel != null) return;
    final url = ApiConfig.coordinatorEventsWsUrl;
    if (url.isEmpty) return;

    final channel = WebSocketChannel.connect(Uri.parse(url));
    _channel = channel;
    _subscription = channel.stream.listen(
      _handleMessage,
      onError: (_, __) => _handleDisconnect(channel),
      onDone: () => _handleDisconnect(channel),
      cancelOnError: false,
    );
    try {
      await channel.ready;
      if (_stopped || !identical(_channel, channel)) return;
      _attempt = 0;
      _onConnected();
    } catch (_) {
      _handleDisconnect(channel);
    }
  }

  void _handleMessage(dynamic message) {
    if (message is! String) return;
    try {
      final decoded = jsonDecode(message);
      if (decoded is! Map || decoded['type'] != 'filesystem_event') return;
      final event = decoded['event'];
      if (event is Map) {
        _onEvent(Map<String, dynamic>.from(event));
      }
    } catch (_) {
      // Ignore malformed best-effort invalidation messages.
    }
  }

  void _handleDisconnect(WebSocketChannel channel) {
    if (!identical(_channel, channel)) {
      return;
    }
    _channel = null;
    _subscription?.cancel();
    _subscription = null;
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_stopped ||
        _reconnectTimer != null ||
        ApiConfig.coordinatorEventsWsUrl.isEmpty) {
      return;
    }
    final seconds = (1 << _attempt.clamp(0, 4)).clamp(1, 15).toInt();
    _attempt = (_attempt + 1).clamp(0, 4).toInt();
    _reconnectTimer = Timer(Duration(seconds: seconds), () {
      _reconnectTimer = null;
      _connect();
    });
  }

  Future<void> dispose() async {
    _stopped = true;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    final subscription = _subscription;
    _subscription = null;
    final channel = _channel;
    _channel = null;
    await subscription?.cancel();
    await channel?.sink.close();
  }
}
