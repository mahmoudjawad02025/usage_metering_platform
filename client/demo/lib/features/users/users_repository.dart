import '../../core/api_client.dart';
import '../../core/models.dart';

class UsersRepository {
  UsersRepository(this._api);

  final ApiClient _api;

  Future<PageDto<UserDto>> listUsers({int limit = 20, int offset = 0}) async {
    final json = await _api.get(
      '/api/users',
      query: {'limit': '$limit', 'offset': '$offset'},
    );
    return PageDto.fromJson(json, UserDto.fromJson);
  }

  Future<UserDto> getUser(String id) async {
    final json = await _api.get('/api/users/$id');
    return UserDto.fromJson(json);
  }

  Future<UserDto> registerUser({
    required String externalId,
    String? planId,
  }) async {
    final body = <String, Object?>{'externalId': externalId};
    if (planId != null) body['planId'] = planId;
    final json = await _api.post('/api/users', body: body);
    return UserDto.fromJson(json);
  }

  Future<UserDto> changeUserPlan(String userId, String planId) async {
    final json = await _api.put(
      '/api/users/$userId/plan',
      body: {'planId': planId},
    );
    return UserDto.fromJson(json);
  }

  Future<List<PlanDto>> listUserPlans() async {
    final json = await _api.get(
      '/api/plans',
      query: {'scope': 'user', 'limit': '100'},
    );
    return PageDto.fromJson(json, PlanDto.fromJson).items;
  }

  Future<UserUsageResult> getUserUsage(String userId, {String? period}) async {
    final query = <String, String>{};
    if (period != null) query['period'] = period;
    final json = await _api.get(
      '/api/usage/users/$userId',
      query: query.isEmpty ? null : query,
    );
    return UserUsageResult.fromJson(json);
  }
}
