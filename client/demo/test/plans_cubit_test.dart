import 'package:flutter_test/flutter_test.dart';
import 'package:usage_metering_demo/core/api_exception.dart';
import 'package:usage_metering_demo/features/plans/plans_cubit.dart';
import 'package:usage_metering_demo/features/plans/plans_state.dart';

import 'fakes.dart';

void main() {
  late FakePlansRepository repo;
  late PlansCubit cubit;

  setUp(() {
    repo = FakePlansRepository();
    cubit = PlansCubit(repo);
  });

  tearDown(() async {
    await cubit.close();
  });

  test('create adds a custom plan and reloads', () async {
    await cubit.create(
      scope: 'user',
      name: 'Team',
      monthlyAllowance: 200,
      maxPerRequest: 15,
    );
    expect(cubit.state.status, PlansStatus.success);
    expect(cubit.state.plans.any((p) => p.name == 'Team'), isTrue);
  });

  test('edit predefined plan surfaces PLAN_READ_ONLY', () async {
    await cubit.load();
    try {
      await cubit.update('basic', name: 'Nope');
      fail('expected error');
    } catch (err) {
      expect(err, isA<ApiException>());
      expect((err as ApiException).code, 'PLAN_READ_ONLY');
    }
    expect(cubit.state.status, PlansStatus.failure);
    expect(cubit.state.errorMessage, contains('read-only'));
  });
}
