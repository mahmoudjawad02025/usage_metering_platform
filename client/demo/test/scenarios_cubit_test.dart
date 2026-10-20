import 'package:flutter_test/flutter_test.dart';
import 'package:usage_metering_demo/core/models.dart';
import 'package:usage_metering_demo/features/scenarios/scenarios_cubit.dart';
import 'package:usage_metering_demo/features/scenarios/scenarios_state.dart';

import 'fakes.dart';

void main() {
  late FakeUsersRepository users;
  late FakePlansRepository plans;
  late FakeConsumeRepository consume;
  late FakeDashboardRepository dashboard;
  late ScenariosCubit cubit;

  setUp(() {
    users = FakeUsersRepository();
    plans = FakePlansRepository();
    consume = FakeConsumeRepository();
    dashboard = FakeDashboardRepository();
    cubit = ScenariosCubit(
      users: users,
      plans: plans,
      consume: consume,
      dashboard: dashboard,
    );
  });

  tearDown(() async {
    await cubit.close();
  });

  test('scenario 2 rejects by user per-request limit', () async {
    consume.nextResult = fakeConsume(
      accepted: false,
      units: 25,
      rejection: const Rejection(
        rule: 'max_per_request',
        level: 'user',
        limit: 20,
      ),
      userConsumed: 0,
    );
    await cubit.run(2);
    final run = cubit.state.runFor(2);
    expect(run.status, ScenarioStatus.success);
    expect(run.steps.first.passed, isTrue);
  });

  test('scenario 7 idempotent retry and conflict', () async {
    // First call uses nextResult; subsequent calls use byRequestId logic.
    consume.nextResult = fakeConsume(
      accepted: true,
      units: 5,
      requestId: 'will-be-overwritten',
      userConsumed: 5,
    );
    await cubit.run(7);
    final run = cubit.state.runFor(7);
    expect(run.status, ScenarioStatus.success, reason: run.errorMessage);
    expect(run.steps.length, 3);
    expect(run.steps.every((s) => s.passed), isTrue);
  });
}
