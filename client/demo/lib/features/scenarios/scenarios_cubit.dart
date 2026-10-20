import 'dart:math';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/api_exception.dart';
import '../../core/models.dart';
import '../consume/consume_repository.dart';
import '../dashboard/dashboard_repository.dart';
import '../plans/plans_repository.dart';
import '../users/users_repository.dart';
import 'scenarios_state.dart';

class ScenariosCubit extends Cubit<ScenariosState> {
  ScenariosCubit({
    required UsersRepository users,
    required PlansRepository plans,
    required ConsumeRepository consume,
    required DashboardRepository dashboard,
  })  : _users = users,
        _plans = plans,
        _consume = consume,
        _dashboard = dashboard,
        super(const ScenariosState());

  final UsersRepository _users;
  final PlansRepository _plans;
  final ConsumeRepository _consume;
  final DashboardRepository _dashboard;
  final _random = Random();

  String _suffix() =>
      '${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${_random.nextInt(999)}';

  Future<void> run(int id) async {
    emit(state.withRun(ScenarioRunState(
      id: id,
      status: ScenarioStatus.running,
      steps: const [],
    )));
    try {
      final steps = switch (id) {
        1 => await _scenario1(),
        2 => await _scenario2(),
        3 => await _scenario3(),
        4 => await _scenario4(),
        5 => await _scenario5(),
        6 => await _scenario6(),
        7 => await _scenario7(),
        _ => throw StateError('Unknown scenario $id'),
      };
      final passed = steps.every((step) => step.passed);
      emit(state.withRun(ScenarioRunState(
        id: id,
        status: passed ? ScenarioStatus.success : ScenarioStatus.failure,
        steps: steps,
        errorMessage: passed ? null : 'One or more steps did not match.',
      )));
    } catch (err) {
      emit(state.withRun(ScenarioRunState(
        id: id,
        status: ScenarioStatus.failure,
        steps: state.runFor(id).steps,
        errorMessage: err is ApiException ? err.message : '$err',
      )));
    }
  }

  Future<PlanDto> _findPlan(String scope, String name) async {
    final page = await _plans.listPlans(scope: scope, limit: 100);
    return page.items.firstWhere(
      (plan) => plan.name == name && plan.scope == scope,
      orElse: () => throw StateError('Plan $name ($scope) not found'),
    );
  }

  Future<PlanDto> _ensureTinyAccountPlan() async {
    final page = await _plans.listPlans(scope: 'account', limit: 100);
    final existing = page.items.where((p) => p.name == 'Demo Tiny').toList();
    if (existing.isNotEmpty) {
      final plan = existing.first;
      await _dashboard.changeAccountPlan(plan.id);
      return plan;
    }
    final plan = await _plans.createPlan(
      scope: 'account',
      name: 'Demo Tiny ${_suffix()}',
      monthlyAllowance: 100,
      maxPerRequest: 50,
    );
    await _dashboard.changeAccountPlan(plan.id);
    return plan;
  }

  ScenarioStepResult _step({
    required String label,
    required String expected,
    required String actual,
    required bool passed,
  }) {
    return ScenarioStepResult(
      label: label,
      expected: expected,
      actual: actual,
      passed: passed,
    );
  }

  Future<List<ScenarioStepResult>> _scenario1() async {
    final basic = await _findPlan('user', 'Basic');
    final user = await _users.registerUser(
      externalId: 'sc1-${_suffix()}',
      planId: basic.id,
    );
    final result = await _consume.consume(
      userId: user.id,
      units: 10,
      requestId: 'sc1-${_suffix()}',
    );
    return [
      _step(
        label: 'Consume 10 units',
        expected: 'accepted=true',
        actual: 'accepted=${result.accepted}',
        passed: result.accepted && !result.replayed,
      ),
    ];
  }

  Future<List<ScenarioStepResult>> _scenario2() async {
    final basic = await _findPlan('user', 'Basic');
    final user = await _users.registerUser(
      externalId: 'sc2-${_suffix()}',
      planId: basic.id,
    );
    final result = await _consume.consume(
      userId: user.id,
      units: 25,
      requestId: 'sc2-${_suffix()}',
    );
    final rejection = result.rejection;
    final passed = !result.accepted &&
        rejection?.rule == 'max_per_request' &&
        rejection?.level == 'user';
    return [
      _step(
        label: 'Consume 25 units on Basic (max 20/request)',
        expected: 'rejected by user max_per_request',
        actual: result.accepted
            ? 'accepted'
            : '${rejection?.level} ${rejection?.rule}',
        passed: passed,
      ),
    ];
  }

  Future<List<ScenarioStepResult>> _scenario3() async {
    final steps = <ScenarioStepResult>[];
    final tiny = await _ensureTinyAccountPlan();
    steps.add(_step(
      label: 'Ensure small account plan',
      expected: 'account on a ~100/month plan',
      actual: '${tiny.name} (${tiny.monthlyAllowance}/mo)',
      passed: tiny.monthlyAllowance <= 100,
    ));

    final premium = await _findPlan('user', 'Premium');
    final user = await _users.registerUser(
      externalId: 'sc3-${_suffix()}',
      planId: premium.id,
    );

    // Drain account allowance with large accepted chunks under account maxPerRequest.
    var remaining = (await _dashboard.getUsage()).account.remaining;
    while (remaining > 0) {
      final units = remaining > tiny.maxPerRequest ? tiny.maxPerRequest : remaining;
      final drain = await _consume.consume(
        userId: user.id,
        units: units,
        requestId: 'sc3-drain-${_suffix()}',
      );
      if (!drain.accepted) break;
      remaining = drain.account.remaining;
    }

    final result = await _consume.consume(
      userId: user.id,
      units: 1,
      requestId: 'sc3-${_suffix()}',
    );
    final rejection = result.rejection;
    final passed = !result.accepted &&
        rejection?.rule == 'monthly_allowance' &&
        rejection?.level == 'account';
    steps.add(_step(
      label: 'Consume after account allowance exhausted',
      expected: 'rejected by account monthly_allowance',
      actual: result.accepted
          ? 'accepted'
          : '${rejection?.level} ${rejection?.rule}',
      passed: passed,
    ));
    return steps;
  }

  Future<List<ScenarioStepResult>> _scenario4() async {
    final basic = await _findPlan('user', 'Basic');
    final boostPage = await _plans.listPlans(scope: 'user', limit: 100);
    var boost = boostPage.items.where((p) => p.name == 'Demo Boost').toList();
    late PlanDto boostPlan;
    if (boost.isEmpty) {
      boostPlan = await _plans.createPlan(
        scope: 'user',
        name: 'Demo Boost ${_suffix()}',
        monthlyAllowance: 1000,
        maxPerRequest: 100,
      );
    } else {
      boostPlan = boost.first;
    }

    final user = await _users.registerUser(
      externalId: 'sc4-${_suffix()}',
      planId: basic.id,
    );
    final first = await _consume.consume(
      userId: user.id,
      units: 25,
      requestId: 'sc4-a-${_suffix()}',
    );
    await _users.changeUserPlan(user.id, boostPlan.id);
    final second = await _consume.consume(
      userId: user.id,
      units: 25,
      requestId: 'sc4-b-${_suffix()}',
    );
    return [
      _step(
        label: '25 units on Basic',
        expected: 'rejected',
        actual: first.accepted ? 'accepted' : 'rejected',
        passed: !first.accepted,
      ),
      _step(
        label: 'Same 25 units after switching to higher plan',
        expected: 'accepted',
        actual: second.accepted ? 'accepted' : 'rejected',
        passed: second.accepted,
      ),
    ];
  }

  Future<List<ScenarioStepResult>> _scenario5() async {
    final plan = await _plans.createPlan(
      scope: 'user',
      name: 'Editable ${_suffix()}',
      monthlyAllowance: 500,
      maxPerRequest: 10,
    );
    final user = await _users.registerUser(
      externalId: 'sc5-${_suffix()}',
      planId: plan.id,
    );
    final first = await _consume.consume(
      userId: user.id,
      units: 20,
      requestId: 'sc5-a-${_suffix()}',
    );
    await _plans.updatePlan(plan.id, maxPerRequest: 50);
    final second = await _consume.consume(
      userId: user.id,
      units: 20,
      requestId: 'sc5-b-${_suffix()}',
    );
    return [
      _step(
        label: '20 units with maxPerRequest=10',
        expected: 'rejected',
        actual: first.accepted ? 'accepted' : 'rejected',
        passed: !first.accepted,
      ),
      _step(
        label: 'After raising maxPerRequest to 50',
        expected: 'accepted',
        actual: second.accepted ? 'accepted' : 'rejected',
        passed: second.accepted,
      ),
    ];
  }

  Future<List<ScenarioStepResult>> _scenario6() async {
    final plan = await _plans.createPlan(
      scope: 'user',
      name: 'Shrink ${_suffix()}',
      monthlyAllowance: 50,
      maxPerRequest: 50,
    );
    final user = await _users.registerUser(
      externalId: 'sc6-${_suffix()}',
      planId: plan.id,
    );
    final first = await _consume.consume(
      userId: user.id,
      units: 40,
      requestId: 'sc6-a-${_suffix()}',
    );
    await _plans.updatePlan(plan.id, monthlyAllowance: 10);
    final usage = await _users.getUserUsage(user.id);
    final second = await _consume.consume(
      userId: user.id,
      units: 1,
      requestId: 'sc6-b-${_suffix()}',
    );
    return [
      _step(
        label: 'Consume 40 of 50',
        expected: 'accepted',
        actual: first.accepted ? 'accepted' : 'rejected',
        passed: first.accepted,
      ),
      _step(
        label: 'After lowering allowance to 10',
        expected: 'remaining=0',
        actual: 'remaining=${usage.user.usage.remaining}',
        passed: usage.user.usage.remaining == 0,
      ),
      _step(
        label: 'Further consume',
        expected: 'rejected',
        actual: second.accepted ? 'accepted' : 'rejected',
        passed: !second.accepted,
      ),
    ];
  }

  Future<List<ScenarioStepResult>> _scenario7() async {
    final basic = await _findPlan('user', 'Basic');
    final user = await _users.registerUser(
      externalId: 'sc7-${_suffix()}',
      planId: basic.id,
    );
    final requestId = 'sc7-${_suffix()}';
    final first = await _consume.consume(
      userId: user.id,
      units: 5,
      requestId: requestId,
    );
    final second = await _consume.consume(
      userId: user.id,
      units: 5,
      requestId: requestId,
    );
    Object? conflict;
    try {
      await _consume.consume(
        userId: user.id,
        units: 6,
        requestId: requestId,
      );
    } catch (err) {
      conflict = err;
    }
    final conflictCode =
        conflict is ApiException ? conflict.code : conflict?.runtimeType;
    return [
      _step(
        label: 'First consume',
        expected: 'accepted, counted',
        actual:
            'accepted=${first.accepted}, consumed=${first.user.consumed}',
        passed: first.accepted && !first.replayed && first.user.consumed == 5,
      ),
      _step(
        label: 'Retry same requestId',
        expected: 'replayed=true, consumed still 5',
        actual:
            'replayed=${second.replayed}, consumed=${second.user.consumed}',
        passed: second.replayed && second.user.consumed == 5,
      ),
      _step(
        label: 'Same requestId, different units',
        expected: '409 REQUEST_ID_REUSED',
        actual: '$conflictCode',
        passed: conflict is ApiException &&
            conflict.code == 'REQUEST_ID_REUSED',
      ),
    ];
  }
}
