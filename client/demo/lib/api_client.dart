import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

const String _apiBase = String.fromEnvironment('API_BASE');
const String _prefsKey = 'demo_api_key';

class ApiException implements Exception {
  const ApiException(this.message, {this.code, this.status});
  final String message;
  final String? code;
  final int? status;

  @override
  String toString() => message;
}

class DemoApi {
  DemoApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  String? apiKey;

  Uri _uri(String path) {
    final origin = _apiBase.isEmpty ? Uri.base.origin : _apiBase;
    final base = _apiBase.isEmpty ? '$origin/svc' : origin;
    return Uri.parse('$base$path');
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Object? body,
    Map<String, String>? headers,
  }) async {
    final request = http.Request(method, _uri(path))
      ..headers['content-type'] = 'application/json';
    if (headers != null) request.headers.addAll(headers);
    final key = apiKey;
    if (key != null && key.isNotEmpty) {
      request.headers['x-api-key'] = key;
    }
    if (body != null) request.body = jsonEncode(body);

    http.Response response;
    try {
      response = await http.Response.fromStream(await _client.send(request));
    } catch (_) {
      throw const ApiException('Could not reach the metering service.');
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
      throw const ApiException('The metering service sent an unexpected answer.');
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
        );
      }
    }
    return ApiException('The metering service answered with status $status.', status: status);
  }

  Future<String?> loadKey() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_prefsKey);
  }

  Future<void> saveKey(String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, key);
  }

  Future<void> clearKey() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsKey);
  }

  Future<bool> hasValidKey() async {
    try {
      await _send('GET', '/accounts/me');
      return true;
    } on ApiException catch (e) {
      if (e.status == 401) return false;
      rethrow;
    }
  }

  Future<void> createDemoAccount(String adminKey) async {
    final stamp = DateTime.now().toUtc().toIso8601String().substring(0, 16).replaceFirst('T', ' ');
    final created = await _send(
      'POST',
      '/accounts',
      body: {'name': 'Acme Docs (demo $stamp UTC)'},
      headers: {'x-admin-key': adminKey},
    );
    final key = created['apiKey'];
    if (key is! String || key.isEmpty) {
      throw const ApiException('Account create response did not include an API key.');
    }
    apiKey = key;

    final tiny = await _send(
      'POST',
      '/plans',
      body: {
        'scope': 'account',
        'name': 'Demo Tiny',
        'monthlyAllowance': 100,
        'maxPerRequest': 50,
      },
    );
    await _send('PUT', '/accounts/me/plan', body: {'planId': tiny['id']});

    await _send(
      'POST',
      '/plans',
      body: {
        'scope': 'user',
        'name': 'Demo Boost',
        'monthlyAllowance': 1000,
        'maxPerRequest': 100,
      },
    );

    final plansPage = await _send('GET', '/plans?limit=100');
    final items = (plansPage['items'] as List<dynamic>).cast<Map<String, dynamic>>();
    String planId(String scope, String name) {
      for (final plan in items) {
        if (plan['scope'] == scope && plan['name'] == name) {
          return plan['id'] as String;
        }
      }
      throw ApiException('The $scope plan "$name" was not found');
    }

    await _send('POST', '/users', body: {'externalId': 'alice', 'planId': planId('user', 'Basic')});
    await _send('POST', '/users', body: {'externalId': 'bob', 'planId': planId('user', 'Premium')});
  }

  Future<StatusSnapshot> getStatus() async {
    final results = await Future.wait([
      _send('GET', '/accounts/me'),
      _send('GET', '/usage?limit=100'),
      _send('GET', '/plans?limit=100'),
    ]);
    return StatusSnapshot.fromResponses(results[0], results[1], results[2]);
  }

  Future<ProcessResult> processDocument({
    required String userId,
    required int units,
    required String requestId,
  }) async {
    final json = await _send(
      'POST',
      '/usage/consume',
      body: {'userId': userId, 'units': units, 'requestId': requestId},
    );
    final decision = Decision.fromJson(json);
    final processed = decision.accepted && !decision.replayed;
    if (processed) {
      await Future<void>.delayed(const Duration(milliseconds: 300));
    }
    return ProcessResult(processed: processed, decision: decision);
  }

  Future<void> changeUserPlan(String userId, String planId) async {
    await _send('PUT', '/users/$userId/plan', body: {'planId': planId});
  }

  Future<void> changeAccountPlan(String planId) async {
    await _send('PUT', '/accounts/me/plan', body: {'planId': planId});
  }
}
