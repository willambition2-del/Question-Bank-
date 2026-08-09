import 'dart:async';
import 'dart:convert';

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/config/api_config.dart';
import '../../../core/storage/token_storage.dart';

enum ChallengeSocketStatus { disconnected, connecting, connected, reconnecting }

enum ChallengeSocketEventType {
  state,
  connectionRestored,
  error,
  connectionLost,
  joined,
  participantJoined,
  participantLeft,
  readyUpdated,
  countdown,
  started,
  question,
  roundCompleted,
  scoreUpdated,
  completed,
}

final class ChallengeSocketEvent {
  final ChallengeSocketEventType type;
  final Map<String, dynamic> data;
  const ChallengeSocketEvent(this.type, this.data);

  static const names = <String, ChallengeSocketEventType>{
    'challenge:state': ChallengeSocketEventType.state,
    'challenge:connection_restored':
        ChallengeSocketEventType.connectionRestored,
    'challenge:error': ChallengeSocketEventType.error,
    'challenge:connection_lost': ChallengeSocketEventType.connectionLost,
    'challenge:joined': ChallengeSocketEventType.joined,
    'challenge:participant_joined': ChallengeSocketEventType.participantJoined,
    'challenge:participant_left': ChallengeSocketEventType.participantLeft,
    'challenge:ready_updated': ChallengeSocketEventType.readyUpdated,
    'challenge:countdown': ChallengeSocketEventType.countdown,
    'challenge:started': ChallengeSocketEventType.started,
    'challenge:question': ChallengeSocketEventType.question,
    'challenge:round_completed': ChallengeSocketEventType.roundCompleted,
    'challenge:score_updated': ChallengeSocketEventType.scoreUpdated,
    'challenge:completed': ChallengeSocketEventType.completed,
  };

  static ChallengeSocketEvent? parse(String name, Object? payload) {
    final type = names[name];
    if (type == null || payload is! Map) return null;
    return ChallengeSocketEvent(type, Map<String, dynamic>.from(payload));
  }
}

class ChallengeSocketService {
  final TokenStorage _tokens;
  io.Socket? _socket;
  String? _userId;
  ChallengeSocketStatus _status = ChallengeSocketStatus.disconnected;
  final _events = StreamController<ChallengeSocketEvent>.broadcast();
  final _statuses = StreamController<ChallengeSocketStatus>.broadcast();

  ChallengeSocketService(this._tokens);
  ChallengeSocketStatus get status => _status;
  Stream<ChallengeSocketEvent> get events => _events.stream;
  Stream<ChallengeSocketStatus> get statuses => _statuses.stream;
  String? get userId => _userId;

  String get _namespaceUrl {
    final api = ApiConfig.baseUri;
    return api
        .replace(path: '/challenges', query: null, fragment: null)
        .toString();
  }

  Future<void> connect() async {
    if (_socket?.connected == true ||
        _status == ChallengeSocketStatus.connecting) {
      return;
    }
    final token = await _tokens.readAccessToken();
    if (token == null || token.isEmpty) {
      throw StateError('Authentication token is required for challenges');
    }
    _userId = _readSubject(token);
    _replaceStatus(ChallengeSocketStatus.connecting);
    _socket?.dispose();
    final socket = io.io(
      _namespaceUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .enableReconnection()
          .build(),
    );
    _socket = socket;
    socket.onConnect((_) => _replaceStatus(ChallengeSocketStatus.connected));
    socket.onDisconnect(
      (_) => _replaceStatus(ChallengeSocketStatus.disconnected),
    );
    socket.onReconnectAttempt(
      (_) => _replaceStatus(ChallengeSocketStatus.reconnecting),
    );
    for (final name in ChallengeSocketEvent.names.keys) {
      socket.on(name, (payload) {
        final event = ChallengeSocketEvent.parse(name, payload);
        if (event != null) _events.add(event);
      });
    }
    socket.connect();
  }

  Future<void> reauthenticate() async {
    if (_socket == null) return;
    disconnect();
    await connect();
  }

  void join(String challengeId) =>
      _emit('challenge:join', {'challengeId': challengeId});
  void leave(String challengeId) =>
      _emit('challenge:leave', {'challengeId': challengeId});
  void ready(String challengeId) =>
      _emit('challenge:ready', {'challengeId': challengeId});
  void sync(String challengeId) =>
      _emit('challenge:sync', {'challengeId': challengeId});
  void heartbeat(String challengeId) =>
      _emit('challenge:heartbeat', {'challengeId': challengeId});
  void rematch(String challengeId) =>
      _emit('challenge:rematch', {'challengeId': challengeId});
  void answer({
    required String challengeId,
    required String questionId,
    String? selectedOptionId,
    bool? selectedBoolean,
  }) => _emit('challenge:answer', {
    'challengeId': challengeId,
    'questionId': questionId,
    'selectedOptionId': ?selectedOptionId,
    'selectedBoolean': ?selectedBoolean,
  });

  void _emit(String event, Map<String, dynamic> data) {
    if (_socket?.connected != true) {
      throw StateError('Challenge socket is not connected');
    }
    _socket!.emit(event, data);
  }

  String? _readSubject(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      );
      return payload is Map ? payload['sub']?.toString() : null;
    } catch (_) {
      return null;
    }
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _replaceStatus(ChallengeSocketStatus.disconnected);
  }

  void _replaceStatus(ChallengeSocketStatus value) {
    if (_status == value) return;
    _status = value;
    if (!_statuses.isClosed) _statuses.add(value);
  }

  void dispose() {
    disconnect();
    _events.close();
    _statuses.close();
  }
}
