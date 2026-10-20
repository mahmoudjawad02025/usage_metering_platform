import '../../core/api_client.dart';
import '../../core/models.dart';

class AuthRepository {
  AuthRepository(this._api);

  final ApiClient _api;

  Future<SessionInfo> getSession() async {
    final json = await _api.get('/api/auth/session');
    return SessionInfo.fromJson(json);
  }

  Future<AccountDto> signIn(String apiKey) async {
    final json = await _api.post('/api/auth/sign-in', body: {'apiKey': apiKey});
    return AccountDto.fromJson(json['account'] as Map<String, dynamic>);
  }

  Future<SignUpResult> signUp({
    required String name,
    String? planName,
  }) async {
    final body = <String, Object?>{'name': name};
    if (planName != null) body['planName'] = planName;
    final json = await _api.post('/api/auth/sign-up', body: body);
    return SignUpResult.fromJson(json);
  }

  Future<AccountDto> startDemo({bool fresh = false}) async {
    final json = await _api.post(
      '/api/auth/demo',
      body: fresh ? {'fresh': true} : {},
    );
    return AccountDto.fromJson(json['account'] as Map<String, dynamic>);
  }

  Future<void> signOut() async {
    await _api.post('/api/auth/sign-out');
  }
}
