import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_exception.dart';
import 'http_client_stub.dart'
    if (dart.library.html) 'http_client_web.dart' as platform;

const String _apiBase = String.fromEnvironment('API_BASE');

/// The only place that talks HTTP. Browser cookies carry the BFF session.
class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? platform.createHttpClient();

  final http.Client _client;

  Uri _uri(String path, [Map<String, String>? query]) {
    final origin = _apiBase.isEmpty ? Uri.base.origin : _apiBase;
    final base = Uri.parse('$origin$path');
    if (query == null || query.isEmpty) return base;
    return base.replace(queryParameters: {
      ...base.queryParameters,
      ...query,
    });
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
  }) =>
      _send('GET', path, query: query);

  Future<Map<String, dynamic>> post(String path, {Object? body}) =>
      _send('POST', path, body: body);

  Future<Map<String, dynamic>> put(String path, {Object? body}) =>
      _send('PUT', path, body: body);

  Future<Map<String, dynamic>> patch(String path, {Object? body}) =>
      _send('PATCH', path, body: body);

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Object? body,
    Map<String, String>? query,
  }) async {
    final request = http.Request(method, _uri(path, query))
      ..headers['content-type'] = 'application/json'
      ..headers['accept'] = 'application/json';
    if (body != null) request.body = jsonEncode(body);

    late http.Response response;
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

    if (response.statusCode >= 400) {
      throw _errorFrom(payload, response.statusCode);
    }

    if (payload is! Map<String, dynamic>) {
      throw const ApiException('The demo server sent an unexpected answer.');
    }
    return payload;
  }

  ApiException _errorFrom(Object? payload, int status) {
    if (payload is Map<String, dynamic>) {
      final error = payload['error'];
      if (error is Map<String, dynamic> && error['message'] is String) {
        return ApiException(
          error['message'] as String,
          code: error['code'] as String?,
          status: status,
          details: error['details'],
        );
      }
    }
    return ApiException(
      'The demo server answered with status $status.',
      status: status,
    );
  }

  void close() => _client.close();
}
