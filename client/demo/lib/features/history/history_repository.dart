import '../../core/api_client.dart';
import '../../core/models.dart';

class HistoryRepository {
  HistoryRepository(this._api);

  final ApiClient _api;

  Future<PageDto<HistoryItem>> listHistory({
    String? userId,
    bool? accepted,
    String? period,
    int limit = 20,
    int offset = 0,
  }) async {
    final query = <String, String>{
      'limit': '$limit',
      'offset': '$offset',
    };
    if (userId != null) query['userId'] = userId;
    if (accepted != null) query['accepted'] = accepted ? 'true' : 'false';
    if (period != null) query['period'] = period;
    final json = await _api.get('/api/usage/history', query: query);
    return PageDto.fromJson(json, HistoryItem.fromJson);
  }

  Future<List<UserDto>> listUsers() async {
    final json = await _api.get('/api/users', query: {'limit': '100'});
    return PageDto.fromJson(json, UserDto.fromJson).items;
  }
}
