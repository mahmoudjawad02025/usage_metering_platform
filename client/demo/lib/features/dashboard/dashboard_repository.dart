import '../../core/api_client.dart';
import '../../core/models.dart';

class DashboardRepository {
  DashboardRepository(this._api);

  final ApiClient _api;

  Future<AccountDto> getAccount() async {
    final json = await _api.get('/api/account/me');
    return AccountDto.fromJson(json);
  }

  Future<UsageSummary> getUsage({String? period, int limit = 100}) async {
    final query = <String, String>{'limit': '$limit'};
    if (period != null) query['period'] = period;
    final json = await _api.get('/api/usage', query: query);
    return UsageSummary.fromJson(json);
  }

  Future<List<PlanDto>> listAccountPlans() async {
    final json = await _api.get(
      '/api/plans',
      query: {'scope': 'account', 'limit': '100'},
    );
    return PageDto.fromJson(json, PlanDto.fromJson).items;
  }

  Future<AccountDto> changeAccountPlan(String planId) async {
    final json = await _api.put(
      '/api/account/me/plan',
      body: {'planId': planId},
    );
    return AccountDto.fromJson(json);
  }
}
