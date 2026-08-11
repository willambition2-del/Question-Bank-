import 'package:dio/dio.dart';

import '../network/api_call.dart';
import '../network/api_response.dart';
import '../network/challenge_api_models.dart';

abstract interface class ChallengeRemoteDataSource {
  Future<Object?> get(String path, {Map<String, dynamic>? query});
  Future<Object?> post(String path, {Map<String, dynamic>? data});
}

final class DioChallengeRemoteDataSource implements ChallengeRemoteDataSource {
  final Dio _dio;
  DioChallengeRemoteDataSource(this._dio);

  @override
  Future<Object?> get(String path, {Map<String, dynamic>? query}) async {
    try {
      return (await _dio.get<Object?>(path, queryParameters: query)).data;
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<Object?> post(String path, {Map<String, dynamic>? data}) async {
    try {
      return (await _dio.post<Object?>(path, data: data)).data;
    } on DioException catch (error) {
      throwApiError(error);
    }
  }
}

final class ChallengeApiRepository {
  final ChallengeRemoteDataSource _remote;
  const ChallengeApiRepository(this._remote);

  Map<String, dynamic> _envelope(Object? raw) => requireObject(raw);
  Map<String, dynamic> _data(Object? raw) =>
      requireObject(_envelope(raw)['data'], 'data');

  Future<List<ChallengeModeInfo>> modes() async =>
      requireList(_envelope(await _remote.get('/challenges/modes'))['data'])
          .whereType<Map>()
          .map(
            (item) =>
                ChallengeModeInfo.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(growable: false);

  Future<({bool matched, Challenge challenge})> matchmake({
    required ChallengeMode mode,
    String? subjectId,
    String difficulty = 'MIXED',
    int questionCount = 10,
    int timePerQuestionSeconds = 30,
  }) async {
    final data = _data(
      await _remote.post(
        '/challenges/matchmaking',
        data: {
          'mode': mode.apiValue,
          if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
          'difficulty': difficulty,
          'questionCount': questionCount,
          'timePerQuestionSeconds': timePerQuestionSeconds,
        },
      ),
    );
    return (
      matched: data['matched'] == true,
      challenge: Challenge.fromJson(
        requireObject(data['challenge'], 'challenge'),
      ),
    );
  }

  Future<Challenge> create({
    required ChallengeMode mode,
    String? subjectId,
    String? unitId,
    String? lessonId,
    int questionCount = 10,
    int timePerQuestionSeconds = 30,
    String difficulty = 'MIXED',
    int maxPlayers = 2,
  }) async => Challenge.fromJson(
    _data(
      await _remote.post(
        '/challenges',
        data: {
          'mode': mode.apiValue,
          if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
          'unitId': ?unitId,
          'lessonId': ?lessonId,
          'questionCount': questionCount,
          'timePerQuestionSeconds': timePerQuestionSeconds,
          'difficulty': difficulty,
          'maxPlayers': maxPlayers,
        },
      ),
    ),
  );

  Future<Challenge> get(String id) async =>
      Challenge.fromJson(_data(await _remote.get('/challenges/$id')));
  Future<Challenge> cancel(String id) async =>
      Challenge.fromJson(_data(await _remote.post('/challenges/$id/cancel')));
  Future<Challenge> rematch(String id) async =>
      Challenge.fromJson(_data(await _remote.post('/challenges/$id/rematch')));
  Future<ChallengeResult> result(String id) async => ChallengeResult.fromJson(
    _data(await _remote.get('/challenges/$id/result')),
  );

  Future<Map<String, dynamic>> join(String id) async =>
      _data(await _remote.post('/challenges/$id/join'));
  Future<Map<String, dynamic>> leave(String id) async =>
      _data(await _remote.post('/challenges/$id/leave'));
  Future<Challenge> ready(String id) async =>
      Challenge.fromJson(_data(await _remote.post('/challenges/$id/ready')));
  Future<Map<String, dynamic>> invite(
    String id,
    String userId, {
    int? team,
  }) async => _data(
    await _remote.post(
      '/challenges/$id/invitations',
      data: {'userId': userId, 'team': ?team},
    ),
  );
  Future<Map<String, dynamic>> accept(String id) async =>
      _data(await _remote.post('/challenges/$id/accept'));
  Future<Map<String, dynamic>> reject(String id) async =>
      _data(await _remote.post('/challenges/$id/reject'));

  Future<ChallengePage> list({
    int page = 1,
    int limit = 20,
    String? status,
    ChallengeMode? mode,
    bool history = false,
  }) async {
    final envelope = _envelope(
      await _remote.get(
        history ? '/challenges/history' : '/challenges',
        query: {
          'page': page,
          'limit': limit,
          'status': ?status,
          if (mode != null) 'mode': mode.apiValue,
        },
      ),
    );
    return ChallengePage(
      requireList(envelope['data'])
          .whereType<Map>()
          .map((item) => Challenge.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      PageMeta.fromJson(requireObject(envelope['meta'], 'meta')),
    );
  }
}
