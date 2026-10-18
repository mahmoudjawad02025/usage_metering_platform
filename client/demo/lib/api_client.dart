import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';
const String _apiBase = String.fromEnvironment('API_BASE');
class ApiException implements Exception {
  const ApiException(this.message, {this.code});
  final String message;
  final String? code;
  @override
  String toString() => message;
}
class DemoApi {
  DemoApi({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;
  Uri _uri(String path) {
    final origin = _apiBase.isEmpty ? Uri.base.origin : _apiBase;
    return Uri.parse('$origin$path');
  }
  Future<Map<String, dynamic>> _send(String method, String path, {Object? body}) async {
    final request = http.Request(method, _uri(path))..headers['content-type'] = 'application/json';
    if (body != null) request.body = jsonEncode(body);
    http.Response response;
    try {
      response = await http.Response.fromStream(await _client.send(request));
    } catch (_) {
      throw const ApiException('Could not reach the demo server.');
    }
    Object? payload;
    try {
      payload = response.body.isEmpty ? null : jsonDecode(response.body);
    } catch (_) {
      payload = null;
    }
    if (response.statusCode >= 400) throw _errorFrom(payload, response.statusCode);
    if (payload is! Map<String, dynamic>) {
      throw const ApiException('The demo server sent an unexpected answer.');
    }
    return payload;
  }
  ApiException _errorFrom(Object? payload, int status) {
    if (payload is Map<String, dynamic>) {
      final error = payload['error'];
      if (error is Map<String, dynamic> && error['message'] is String) {
        return ApiException(error['message'] as String, code: error['code'] as String?);
      }
    }
    return ApiException('The demo server answered with status $status.');
  }
  Future<StatusSnapshot> getStatus() async =>
      StatusSnapshot.fromJson(await _send('GET', '/api/status'));
  Future<ProcessResult> processDocument({
    required String userId,
    required int units,
    required String requestId,
  }) async {
    final json = await _send(
      'POST',
      '/api/process-document',
      body: {'userId': userId, 'units': units, 'requestId': requestId},
    );
    return ProcessResult.fromJson(json);
  }
  Future<void> changeUserPlan(String userId, String planId) async {
    await _send('PUT', '/api/users/$userId/plan', body: {'planId': planId});
  }
  Future<void> changeAccountPlan(String planId) async {
    await _send('PUT', '/api/account/plan', body: {'planId': planId});
  }
  Future<void> resetDemo() async {
    await _send('POST', '/api/reset');
  }
}