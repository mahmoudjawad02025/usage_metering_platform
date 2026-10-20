import 'package:flutter_test/flutter_test.dart';
import 'package:usage_metering_demo/core/models.dart';

void main() {
  test('parses a rejected consume result with an explanation', () {
    final result = ConsumeResult.fromJson({
      'accepted': false,
      'replayed': false,
      'requestId': 'req-1',
      'units': 25,
      'period': '2026-04',
      'rejection': {
        'rule': 'max_per_request',
        'level': 'user',
        'limit': 20,
      },
      'account': {
        'plan': {
          'id': 'a',
          'name': 'Demo Tiny',
          'monthlyAllowance': 100,
          'maxPerRequest': 50,
        },
        'consumed': 0,
        'remaining': 100,
      },
      'user': {
        'id': 'u1',
        'plan': {
          'id': 'b',
          'name': 'Basic',
          'monthlyAllowance': 1000,
          'maxPerRequest': 20,
        },
        'consumed': 0,
        'remaining': 1000,
      },
    });

    expect(result.accepted, isFalse);
    expect(result.rejection?.explanation, contains("user's per-request"));
  });

  test('monthly account rejection mentions units left', () {
    final rejection = Rejection.fromJson({
      'rule': 'monthly_allowance',
      'level': 'account',
      'limit': 100,
      'remaining': 40,
    });
    expect(rejection.explanation, contains('shared account'));
    expect(rejection.explanation, contains('40 units left'));
  });

  test('fractionUsed is capped at 1.0', () {
    const usage = LevelUsage(
      plan: PlanViewDto(
        id: 'p',
        name: 'X',
        monthlyAllowance: 10,
        maxPerRequest: 5,
      ),
      consumed: 50,
      remaining: 0,
    );
    expect(usage.fractionUsed, 1.0);
  });
}
