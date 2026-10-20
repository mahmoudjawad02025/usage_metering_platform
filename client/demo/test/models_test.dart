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
    final decision = Decision.fromJson(rejected['decision'] as Map<String, dynamic>);
    expect(decision.accepted, isFalse);
    expect(decision.userId, 'u1');
    expect(decision.user.remaining, 990);
    expect(decision.rejection?.rule, 'max_per_request');
    expect(decision.rejection?.explanation, contains('per-request'));
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

  test('builds a status snapshot from service responses', () {
    final snapshot = StatusSnapshot.fromResponses(
      {'name': 'Acme Docs'},
      {
        'period': '2026-10',
        'account': {
          'plan': {'id': 'a1', 'name': 'Demo Tiny', 'monthlyAllowance': 100, 'maxPerRequest': 50},
          'consumed': 10,
          'remaining': 90,
        },
        'users': {
          'items': [
            {
              'id': 'u1',
              'externalId': 'alice',
              'plan': {'id': 'b1', 'name': 'Basic', 'monthlyAllowance': 1000, 'maxPerRequest': 20},
              'consumed': 10,
              'remaining': 990,
            },
          ],
          'total': 1,
          'limit': 100,
          'offset': 0,
        },
      },
      {
        'items': [
          {
            'id': 'a1',
            'scope': 'account',
            'name': 'Demo Tiny',
            'monthlyAllowance': 100,
            'maxPerRequest': 50,
          },
          {
            'id': 'b1',
            'scope': 'user',
            'name': 'Basic',
            'monthlyAllowance': 1000,
            'maxPerRequest': 20,
          },
          {
            'id': 'b2',
            'scope': 'user',
            'name': 'Premium',
            'monthlyAllowance': 10000,
            'maxPerRequest': 200,
          },
        ],
        'total': 3,
        'limit': 100,
        'offset': 0,
      },
    );

    expect(snapshot.accountName, 'Acme Docs');
    expect(snapshot.period, '2026-10');
    expect(snapshot.users.single.externalId, 'alice');
    expect(snapshot.accountPlans.map((p) => p.name), ['Demo Tiny']);
    expect(snapshot.userPlans.map((p) => p.name), ['Basic', 'Premium']);
  });
}
