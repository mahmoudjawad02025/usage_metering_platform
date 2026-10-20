import '../../core/api_client.dart';
import '../../core/models.dart';

class ConsumeRepository {
  ConsumeRepository(this._api);

  final ApiClient _api;

  Future<ConsumeResult> consume({
    required String userId,
    required int units,
    required String requestId,
  }) async {
    final json = await _api.post('/api/usage/consume', body: {
      'userId': userId,
      'units': units,
      'requestId': requestId,
    });
    return ConsumeResult.fromJson(json);
  }

  Future<List<UserDto>> listUsers() async {
    final json = await _api.get('/api/users', query: {'limit': '100'});
    return PageDto.fromJson(json, UserDto.fromJson).items;
  }
}
