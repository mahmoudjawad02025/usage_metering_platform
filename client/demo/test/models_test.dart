import 'package:flutter_test/flutter_test.dart';
import 'package:usage_metering_demo/models.dart';
void main() {
  final rejected = <String, dynamic>{
    'processed': false,
    'decision': {
      'accepted': false,
      'replayed': false,
      'requestId': 'doc-1',
      'units': 25,
      'period': '2026-10',
      'rejection': {'rule': 'max_per_request', 'level': 'user', 'limit': 20},
      'account': {
        'plan': {'id': 'a1', 'name': 'Demo Tiny', 'monthlyAllowance': 100, 'maxPerRequest': 50},
        'consumed': 10,
        'remaining': 90,
      },
      'user': {
        'id': 'u1',
        'plan': {'id': 'b1', 'name': 'Basic', 'monthlyAllowance': 1000, 'maxPerRequest': 20},
        'consumed': 10,
        'remaining': 990,
      },
    },
  };
  test('parses a rejected decision with its explanation', () {
    final result = ProcessResult.fromJson(rejected);
    expect(result.processed, isFalse);
    expect(result.decision.accepted, isFalse);
    expect(result.decision.userId, 'u1');
    expect(result.decision.user.remaining, 990);
    expect(result.decision.rejection?.rule, 'max_per_request');
    expect(result.decision.rejection?.explanation, contains('per-request'));
  });
  test('describes a monthly rejection with the remaining units', () {
    const rejection = Rejection(rule: 'monthly_allowance', level: 'account', limit: 100, remaining: 40);
    expect(rejection.explanation, contains('shared account'));
    expect(rejection.explanation, contains('40 remaining'));
  });
  test('never reports more than 100 percent used', () {
    const usage = LevelUsage(
      plan: PlanInfo(id: 'p', name: 'Small', monthlyAllowance: 30, maxPerRequest: 5),
      consumed: 50,
      remaining: 0,
    );
    expect(usage.fractionUsed, 1.0);
  });
}