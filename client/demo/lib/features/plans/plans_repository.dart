import '../../core/api_client.dart';
import '../../core/models.dart';

class PlansRepository {
  PlansRepository(this._api);

  final ApiClient _api;

  Future<PageDto<PlanDto>> listPlans({
    String? scope,
    int limit = 20,
    int offset = 0,
  }) async {
    final query = <String, String>{
      'limit': '$limit',
      'offset': '$offset',
    };
    if (scope != null) query['scope'] = scope;
    final json = await _api.get('/api/plans', query: query);
    return PageDto.fromJson(json, PlanDto.fromJson);
  }

  Future<PlanDto> getPlan(String id) async {
    final json = await _api.get('/api/plans/$id');
    return PlanDto.fromJson(json);
  }

  Future<PlanDto> createPlan({
    required String scope,
    required String name,
    required int monthlyAllowance,
    required int maxPerRequest,
  }) async {
    final json = await _api.post('/api/plans', body: {
      'scope': scope,
      'name': name,
      'monthlyAllowance': monthlyAllowance,
      'maxPerRequest': maxPerRequest,
    });
    return PlanDto.fromJson(json);
  }

  Future<PlanDto> updatePlan(
    String id, {
    String? name,
    int? monthlyAllowance,
    int? maxPerRequest,
  }) async {
    final body = <String, Object?>{};
    if (name != null) body['name'] = name;
    if (monthlyAllowance != null) body['monthlyAllowance'] = monthlyAllowance;
    if (maxPerRequest != null) body['maxPerRequest'] = maxPerRequest;
    final json = await _api.patch('/api/plans/$id', body: body);
    return PlanDto.fromJson(json);
  }
}
