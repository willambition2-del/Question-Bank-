import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import '../models/student_model.dart';
import '../network/api_call.dart';
import '../network/api_response.dart';
import '../storage/token_storage.dart';
import 'interfaces.dart';

final class AuthApiRepository implements AuthRepository {
  final Dio _dio;
  final TokenStorage _tokens;

  AuthApiRepository(this._dio, this._tokens);

  @override
  Future<StudentModel?> login(String username, String password) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'identifier': username.trim(), 'password': password},
      );
      return _persistAuthResponse(requireObject(response.data));
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<GoogleAuthSession> loginWithGoogle(String idToken) async {
    if (kDebugMode) {
      print('Google account selected: YES');
      print('Google ID token present: ${idToken.isNotEmpty ? "YES" : "NO"}');
      print('Google ID token length: ${idToken.length}');
      const clientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
      print('GOOGLE_SERVER_CLIENT_ID present: ${clientId.isNotEmpty ? "YES" : "NO"}');
      if (clientId.isNotEmpty && clientId.contains('.')) {
        print('suffix: ${clientId.substring(clientId.indexOf('.'))}');
      }
    }
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/google',
        data: {'idToken': idToken},
      );
      final json = requireObject(response.data);
      final user = await _persistAuthResponse(json);
      return GoogleAuthSession(
        user: user,
        isNewUser: json['isNewUser'] == true,
      );
    } on DioException catch (error) {
      if (kDebugMode) {
        print('Google backend response:');
        print('status=${error.response?.statusCode}');
        final data = error.response?.data;
        if (data is Map) {
          print('code=${data["code"]}');
          print('message=${data["message"]}');
        } else {
          print('body=${error.response?.data}');
        }
      }
      throwApiError(error);
    }
  }

  @override
  Future<StudentModel?> register({
    required String name,
    required String username,
    required String phone,
    required String schoolName,
    required String password,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/register',
        data: {
          'name': name.trim(),
          'username': username.trim().toLowerCase(),
          if (phone.trim().isNotEmpty) 'phone': phone.trim(),
          if (schoolName.trim().isNotEmpty) 'schoolName': schoolName.trim(),
          'password': password,
        },
      );
      return _persistAuthResponse(requireObject(response.data));
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<StudentModel?> getLoggedInStudent() async {
    final access = await _tokens.readAccessToken();
    final refresh = await _tokens.readRefreshToken();
    if ((access == null || access.isEmpty) &&
        (refresh == null || refresh.isEmpty)) {
      return null;
    }
    try {
      final response = await _dio.get<Map<String, dynamic>>('/auth/me');
      return _studentFromJson(requireObject(response.data));
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        await _tokens.clear();
        return null;
      }
      throwApiError(error);
    }
  }

  @override
  Future<StudentModel> completeOnboarding({
    required String schoolName,
    required String governorate,
    required String gradeLevel,
    String? phone,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/users/complete-onboarding',
        data: {
          'schoolName': schoolName.trim(),
          'governorate': governorate.trim(),
          'gradeLevel': gradeLevel,
          if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
        },
      );
      return _studentFromJson(requireObject(response.data));
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<StudentModel> updateProfile({
    String? name,
    String? schoolName,
    String? governorate,
    String? gradeLevel,
    String? phone,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/users/me',
        data: {
          if (name != null) 'name': name.trim(),
          if (schoolName != null) 'schoolName': schoolName.trim(),
          if (governorate != null) 'governorate': governorate.trim(),
          if (gradeLevel != null) 'gradeLevel': gradeLevel,
          if (phone != null) 'phone': phone.trim(),
        },
      );
      return _studentFromJson(requireObject(response.data));
    } on DioException catch (error) {
      throwApiError(error);
    }
  }

  @override
  Future<void> updateStudentPointsAndStats(
    int points,
    int completedQuestions,
    double accuracy,
  ) async {
    // Scores, progress and points are server-owned quiz side effects.
  }

  @override
  Future<void> logout() async {
    try {
      await _dio.post<void>('/auth/logout');
    } on DioException {
      // Local logout is guaranteed even when the network is unavailable.
    } finally {
      await _tokens.clear();
    }
  }

  Future<StudentModel> _persistAuthResponse(Map<String, dynamic> json) async {
    final tokenJson = requireObject(json['tokens'], 'tokens');
    final access = tokenJson['accessToken']?.toString();
    final refresh = tokenJson['refreshToken']?.toString();
    if (access == null || refresh == null) {
      throw const FormatException('Authentication response omitted tokens');
    }
    await _tokens.write(
      TokenPair(
        accessToken: access,
        refreshToken: refresh,
        accessTokenExpiresIn: tokenJson['accessTokenExpiresIn']?.toString(),
      ),
    );
    return _studentFromJson(requireObject(json['user'], 'user'));
  }

  StudentModel _studentFromJson(Map<String, dynamic> json) {
    final backendId = json['id']?.toString() ?? '';
    final schoolName = json['schoolName']?.toString().trim() ?? '';
    final governorate = json['governorate']?.toString().trim();
    final gradeLevel = json['gradeLevel']?.toString().trim();
    final bool rawOnboarding = json['onboardingCompleted'] == true;
    final bool isComplete = rawOnboarding &&
        schoolName.isNotEmpty &&
        governorate != null &&
        governorate.isNotEmpty &&
        gradeLevel != null &&
        gradeLevel.isNotEmpty;

    return StudentModel(
      id: backendId,
      name: json['name']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString(),
      schoolName: schoolName,
      governorate: governorate,
      gradeLevel: gradeLevel ?? 'THIRD_SECONDARY',
      onboardingCompleted: isComplete,
      level: 1,
      points: 0,
      rank: 0,
      streakDays: 0,
      completedQuestions: 0,
      overallAccuracy: (json['overallAccuracy'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
