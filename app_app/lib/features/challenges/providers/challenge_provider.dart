import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/challenge_api_models.dart';
import '../../../core/repositories/challenge_api_repository.dart';
import '../../../core/repositories/providers.dart';
import '../services/challenge_socket_service.dart';

class ChallengeState {
  final String status;
  final Challenge? challenge;
  final ChallengeResult? result;
  final ChallengeQuestion? currentQuestion;
  final int countdownSeconds;
  final int timerSeconds;
  final String? selectedOptionId;
  final bool hasPlayerAnswered;
  final bool? playerLastCorrect;
  final int playerScore;
  final int opponentScore;
  final ChallengeUser? opponent;
  final ChallengeMode mode;
  final ChallengeSocketStatus connectionStatus;
  final String? errorMessage;

  const ChallengeState({
    this.status = 'idle',
    this.challenge,
    this.result,
    this.currentQuestion,
    this.countdownSeconds = 0,
    this.timerSeconds = 0,
    this.selectedOptionId,
    this.hasPlayerAnswered = false,
    this.playerLastCorrect,
    this.playerScore = 0,
    this.opponentScore = 0,
    this.opponent,
    this.mode = ChallengeMode.oneVsOne,
    this.connectionStatus = ChallengeSocketStatus.disconnected,
    this.errorMessage,
  });

  String get opponentStatus => status == 'active' ? 'thinking' : 'answered';
  int get questionIndex =>
      currentQuestion?.sortOrder ?? challenge?.currentSortOrder ?? 0;
  int get maxTimerSeconds => challenge?.timePerQuestionSeconds ?? 0;
  int get questionCount => challenge?.questionCount ?? 0;
  List<ChallengeParticipant> get participants =>
      challenge?.participants ?? const [];

  ChallengeState copyWith({
    String? status,
    Challenge? challenge,
    ChallengeResult? result,
    ChallengeQuestion? currentQuestion,
    bool clearQuestion = false,
    int? countdownSeconds,
    int? timerSeconds,
    String? selectedOptionId,
    bool clearSelection = false,
    bool? hasPlayerAnswered,
    bool? playerLastCorrect,
    bool clearPlayerResult = false,
    int? playerScore,
    int? opponentScore,
    ChallengeUser? opponent,
    ChallengeMode? mode,
    ChallengeSocketStatus? connectionStatus,
    String? errorMessage,
    bool clearError = false,
  }) => ChallengeState(
    status: status ?? this.status,
    challenge: challenge ?? this.challenge,
    result: result ?? this.result,
    currentQuestion: clearQuestion
        ? null
        : currentQuestion ?? this.currentQuestion,
    countdownSeconds: countdownSeconds ?? this.countdownSeconds,
    timerSeconds: timerSeconds ?? this.timerSeconds,
    selectedOptionId: clearSelection
        ? null
        : selectedOptionId ?? this.selectedOptionId,
    hasPlayerAnswered: hasPlayerAnswered ?? this.hasPlayerAnswered,
    playerLastCorrect: clearPlayerResult
        ? null
        : playerLastCorrect ?? this.playerLastCorrect,
    playerScore: playerScore ?? this.playerScore,
    opponentScore: opponentScore ?? this.opponentScore,
    opponent: opponent ?? this.opponent,
    mode: mode ?? this.mode,
    connectionStatus: connectionStatus ?? this.connectionStatus,
    errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
  );
}

class ChallengeNotifier extends Notifier<ChallengeState> {
  StreamSubscription<ChallengeSocketEvent>? _events;
  StreamSubscription<ChallengeSocketStatus>? _statuses;
  Timer? _displayTimer;
  Timer? _heartbeat;
  Timer? _roundSync;

  ChallengeApiRepository get _repository =>
      ref.read(challengeApiRepositoryProvider);
  ChallengeSocketService get _socket =>
      ref.read(challengeSocketServiceProvider);

  @override
  ChallengeState build() {
    final socket = _socket;
    _events = socket.events.listen(_handleEvent);
    _statuses = socket.statuses.listen((value) {
      state = state.copyWith(connectionStatus: value);
    });
    ref.onDispose(() {
      _events?.cancel();
      _statuses?.cancel();
      _displayTimer?.cancel();
      _heartbeat?.cancel();
      _roundSync?.cancel();
      socket.disconnect();
    });
    return const ChallengeState();
  }

  Future<void> joinExisting(String challengeId) async {
    await exitMatch(notifyServer: false);
    state = const ChallengeState(
      status: 'searching',
      mode: ChallengeMode.twoVsTwo,
    );
    try {
      await _repository.join(challengeId);
      final challenge = await _repository.get(challengeId);
      state = state.copyWith(
        challenge: challenge,
        mode: challenge.mode,
        status: 'lobby',
      );
      await _socket.connect();
      _socket.join(challengeId);
      _socket.sync(challengeId);
    } catch (error) {
      state = state.copyWith(status: 'error', errorMessage: error.toString());
    }
  }

  Future<void> createFriendChallenge(String userId, {String? subjectId}) async {
    await exitMatch(notifyServer: false);
    state = const ChallengeState(status: 'searching');
    try {
      final challenge = await _repository.create(
        mode: ChallengeMode.oneVsOne,
        subjectId: subjectId,
      );
      await _repository.invite(challenge.id, userId);
      state = state.copyWith(challenge: challenge, status: 'lobby');
      await _socket.connect();
      _socket.join(challenge.id);
      _socket.ready(challenge.id);
    } catch (error) {
      state = state.copyWith(status: 'error', errorMessage: error.toString());
    }
  }

  Future<void> acceptInvitation(String challengeId) async {
    await _repository.accept(challengeId);
    await joinExisting(challengeId);
  }

  Future<void> searchOpponent(ChallengeMode mode, {String? subjectId}) async {
    await _start(
      () => _repository.matchmake(mode: mode, subjectId: subjectId),
      mode,
    );
  }

  Future<void> setupTeamMatch({required String subjectId}) async {
    await _start(
      () async => (
        matched: false,
        challenge: await _repository.create(
          mode: ChallengeMode.twoVsTwo,
          subjectId: subjectId,
          maxPlayers: 4,
        ),
      ),
      ChallengeMode.twoVsTwo,
    );
  }

  Future<void> _start(
    Future<({bool matched, Challenge challenge})> Function() request,
    ChallengeMode mode,
  ) async {
    await exitMatch(notifyServer: false);
    state = ChallengeState(
      status: 'searching',
      mode: mode,
      connectionStatus: _socket.status,
    );
    try {
      final match = await request();
      state = state.copyWith(
        challenge: match.challenge,
        status: match.matched ? 'lobby' : 'searching',
      );
      await _socket.connect();
      _socket.join(match.challenge.id);
      _socket.sync(match.challenge.id);
      if (mode != ChallengeMode.twoVsTwo) _socket.ready(match.challenge.id);
      _heartbeat = Timer.periodic(const Duration(seconds: 20), (_) {
        if (_socket.status == ChallengeSocketStatus.connected) {
          _socket.heartbeat(match.challenge.id);
        }
      });
    } catch (error) {
      state = state.copyWith(status: 'error', errorMessage: error.toString());
    }
  }

  void setReady() {
    final id = state.challenge?.id;
    if (id != null) _socket.ready(id);
  }

  void submitPlayerAnswer(String optionId) {
    final challenge = state.challenge;
    final question = state.currentQuestion;
    if (challenge == null || question == null || state.hasPlayerAnswered) {
      return;
    }
    state = state.copyWith(
      selectedOptionId: optionId,
      hasPlayerAnswered: true,
      clearError: true,
    );
    _socket.answer(
      challengeId: challenge.id,
      questionId: question.id,
      selectedOptionId: question.type == 'TRUE_FALSE' ? null : optionId,
      selectedBoolean: question.type == 'TRUE_FALSE'
          ? optionId.toLowerCase() == 'true'
          : null,
    );
  }

  Future<void> exitMatch({bool notifyServer = true}) async {
    _displayTimer?.cancel();
    _heartbeat?.cancel();
    _roundSync?.cancel();
    final id = state.challenge?.id;
    if (notifyServer &&
        id != null &&
        _socket.status == ChallengeSocketStatus.connected) {
      _socket.leave(id);
    }
    _socket.disconnect();
    state = const ChallengeState();
  }

  void _handleEvent(ChallengeSocketEvent event) {
    switch (event.type) {
      case ChallengeSocketEventType.state:
        _applyChallenge(Challenge.fromJson(event.data));
      case ChallengeSocketEventType.readyUpdated:
        final current = state.challenge;
        if (current != null) {
          _applyChallenge(
            Challenge.fromJson({
              ..._challengeJson(current),
              'participants': event.data['participants'],
            }),
          );
        }
      case ChallengeSocketEventType.countdown:
        state = state.copyWith(
          status: 'countdown',
          countdownSeconds: (event.data['seconds'] as num?)?.toInt() ?? 0,
        );
        _startCountdownDisplay();
      case ChallengeSocketEventType.started:
        state = state.copyWith(
          status: 'active',
          clearSelection: true,
          hasPlayerAnswered: false,
          clearPlayerResult: true,
        );
      case ChallengeSocketEventType.question:
        final raw = event.data['question'];
        if (raw is Map) {
          final question = ChallengeQuestion.fromJson({
            'sortOrder': event.data['sortOrder'],
            'question': raw,
          });
          state = state.copyWith(
            status: 'active',
            currentQuestion: question,
            clearSelection: true,
            hasPlayerAnswered: false,
            clearPlayerResult: true,
            timerSeconds: state.maxTimerSeconds,
          );
          _startQuestionDisplayTimer();
        }
      case ChallengeSocketEventType.roundCompleted:
        final round = ChallengeRoundResult.fromJson(event.data);
        state = state.copyWith(
          status: 'results',
          playerLastCorrect: round.isCorrect,
          playerScore: round.totalScore,
        );
        _roundSync?.cancel();
        final delay =
            round.roundEndsAt?.difference(DateTime.now().toUtc()) ??
            const Duration(milliseconds: 250);
        _roundSync = Timer(delay.isNegative ? Duration.zero : delay, () {
          final id = state.challenge?.id;
          if (id != null && _socket.status == ChallengeSocketStatus.connected) {
            _socket.sync(id);
          }
        });
      case ChallengeSocketEventType.scoreUpdated:
        _applyScore(event.data);
      case ChallengeSocketEventType.completed:
        _applyResult(ChallengeResult.fromJson(event.data));
      case ChallengeSocketEventType.error:
        state = state.copyWith(
          errorMessage:
              event.data['message']?.toString() ?? 'Challenge operation failed',
        );
      case ChallengeSocketEventType.connectionRestored:
        final id = state.challenge?.id;
        if (id != null) _socket.sync(id);
      case ChallengeSocketEventType.connectionLost:
      case ChallengeSocketEventType.joined:
      case ChallengeSocketEventType.participantJoined:
      case ChallengeSocketEventType.participantLeft:
        final id = state.challenge?.id;
        if (id != null) _socket.sync(id);
    }
  }

  void _applyChallenge(Challenge challenge) {
    final me = challenge.participants
        .where((p) => p.userId == _socket.userId)
        .firstOrNull;
    final opponent = challenge.participants
        .where((p) => p.userId != _socket.userId)
        .firstOrNull;
    final question = challenge.questions.firstOrNull;
    final uiStatus = switch (challenge.status) {
      'COUNTDOWN' => 'countdown',
      'IN_PROGRESS' => 'active',
      'COMPLETED' => 'completed',
      'WAITING' => 'lobby',
      _ => 'searching',
    };
    state = state.copyWith(
      challenge: challenge,
      mode: challenge.mode,
      status: uiStatus,
      currentQuestion: question,
      clearQuestion: question == null && challenge.status != 'IN_PROGRESS',
      playerScore: me?.score ?? state.playerScore,
      opponentScore: opponent?.score ?? state.opponentScore,
      opponent: opponent?.user,
      timerSeconds: question == null
          ? state.timerSeconds
          : challenge.timePerQuestionSeconds,
    );
    if (question != null) _startQuestionDisplayTimer();
    if (challenge.status == 'COMPLETED') _loadResult(challenge.id);
  }

  void _applyScore(Map<String, dynamic> data) {
    final score = (data['totalScore'] as num?)?.toInt() ?? 0;
    if (data['userId']?.toString() == _socket.userId) {
      state = state.copyWith(playerScore: score);
    } else {
      state = state.copyWith(opponentScore: score);
    }
  }

  Future<void> _loadResult(String id) async {
    try {
      _applyResult(await _repository.result(id));
    } catch (error) {
      state = state.copyWith(errorMessage: error.toString());
    }
  }

  void _applyResult(ChallengeResult result) {
    final me = result.standings
        .where((p) => p.userId == _socket.userId)
        .firstOrNull;
    final opponent = result.standings
        .where((p) => p.userId != _socket.userId)
        .firstOrNull;
    state = state.copyWith(
      status: 'completed',
      result: result,
      playerScore: me?.score ?? state.playerScore,
      opponentScore: opponent?.score ?? state.opponentScore,
      opponent: opponent?.user,
    );
  }

  void _startCountdownDisplay() {
    _displayTimer?.cancel();
    _displayTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (state.status != 'countdown' || state.countdownSeconds <= 0) {
        return timer.cancel();
      }
      state = state.copyWith(countdownSeconds: state.countdownSeconds - 1);
    });
  }

  void _startQuestionDisplayTimer() {
    _displayTimer?.cancel();
    final startedAt = DateTime.now().toUtc();
    final duration = state.maxTimerSeconds;
    _displayTimer = Timer.periodic(const Duration(milliseconds: 250), (timer) {
      if (state.status != 'active' && state.status != 'results') {
        return timer.cancel();
      }
      final remaining =
          duration - DateTime.now().toUtc().difference(startedAt).inSeconds;
      state = state.copyWith(timerSeconds: remaining.clamp(0, duration));
    });
  }

  Map<String, dynamic> _challengeJson(Challenge value) => {
    'id': value.id,
    'mode': value.mode.apiValue,
    'status': value.status,
    'subjectId': value.subjectId,
    'questionCount': value.questionCount,
    'timePerQuestionSeconds': value.timePerQuestionSeconds,
    'maxPlayers': value.maxPlayers,
    'startedAt': value.startedAt?.toIso8601String(),
    'completedAt': value.completedAt?.toIso8601String(),
    'currentSortOrder': value.currentSortOrder,
    'questions': value.questions
        .map(
          (q) => {
            'sortOrder': q.sortOrder,
            'question': {
              'id': q.id,
              'type': q.type,
              'questionText': q.questionText,
              'options': q.options.entries
                  .map((o) => {'id': o.key, 'optionText': o.value})
                  .toList(),
            },
          },
        )
        .toList(),
  };
}

final challengeActiveListProvider = FutureProvider<ChallengePage>(
  (ref) => ref.read(challengeApiRepositoryProvider).list(status: 'WAITING'),
);

final challengeHistoryProvider = FutureProvider<ChallengePage>(
  (ref) =>
      ref.read(challengeApiRepositoryProvider).list(history: true, limit: 20),
);

final challengeModesProvider = FutureProvider<List<ChallengeModeInfo>>(
  (ref) => ref.read(challengeApiRepositoryProvider).modes(),
);

final challengeProvider = NotifierProvider<ChallengeNotifier, ChallengeState>(
  ChallengeNotifier.new,
);
