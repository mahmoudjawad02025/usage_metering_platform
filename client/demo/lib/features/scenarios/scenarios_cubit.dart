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

  // requestId must be unique per attempt; helper users/plans are reused.
  String _requestId(String prefix) =>
      '$prefix-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${_random.nextInt(999)}';

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

  Future<UserDto?> _findUserByExternalId(String externalId) async {
    var offset = 0;
    const limit = 100;
    for (;;) {
      final page = await _users.listUsers(limit: limit, offset: offset);
      for (final user in page.items) {
        if (user.externalId == externalId) return user;
      }
      offset += page.items.length;
      if (offset >= page.total || page.items.isEmpty) return null;
    }
  }

  /// Create once; on conflict look up the existing user and optionally reset plan.
  Future<UserDto> _ensureUser(String externalId, {String? planId}) async {
    final existing = await _findUserByExternalId(externalId);
    if (existing != null) {
      if (planId != null && existing.plan.id != planId) {
        return _users.changeUserPlan(existing.id, planId);
      }
      return existing;
    }
    try {
      return await _users.registerUser(externalId: externalId, planId: planId);
    } on ApiException catch (err) {
      if (err.code != 'CONFLICT') rethrow;
      final again = await _findUserByExternalId(externalId);
      if (again == null) rethrow;
      if (planId != null && again.plan.id != planId) {
        return _users.changeUserPlan(again.id, planId);
      }
      return again;
    }
  }

  Future<PlanDto> _ensureCustomPlan({
    required String scope,
    required String name,
    required int monthlyAllowance,
    required int maxPerRequest,
  }) async {
    final page = await _plans.listPlans(scope: scope, limit: 100);
    final existing = page.items.where((p) => p.name == name).toList();
    if (existing.isNotEmpty) {
      final plan = existing.first;
      return _plans.updatePlan(
        plan.id,
        monthlyAllowance: monthlyAllowance,
        maxPerRequest: maxPerRequest,
      );
    }
    try {
      return await _plans.createPlan(
        scope: scope,
        name: name,
        monthlyAllowance: monthlyAllowance,
        maxPerRequest: maxPerRequest,
      );
    } on ApiException catch (err) {
      if (err.code != 'CONFLICT') rethrow;
      final again = await _plans.listPlans(scope: scope, limit: 100);
      final plan = again.items.firstWhere((p) => p.name == name);
      return _plans.updatePlan(
        plan.id,
        monthlyAllowance: monthlyAllowance,
        maxPerRequest: maxPerRequest,
      );
    }
  }

  Future<PlanDto> _ensureTinyAccountPlan() async {
    final page = await _plans.listPlans(scope: 'account', limit: 100);
    final existing = page.items.where((p) => p.name == 'Demo Tiny').toList();
    if (existing.isNotEmpty) {
      final plan = existing.first;
      await _dashboard.changeAccountPlan(plan.id);
      return plan;
    }
    final plan = await _ensureCustomPlan(
      scope: 'account',
      name: 'Demo Tiny',
      monthlyAllowance: 100,
      maxPerRequest: 50,
    );
    await _dashboard.changeAccountPlan(plan.id);
    return plan;
  }

  // Scenario 3 may leave the account on Demo Tiny with no remaining units;
  // switch to Pro so later scenarios aren't rejected for the wrong reason.
  Future<void> _ensureGenerousAccountPlan() async {
    final pro = await _findPlan('account', 'Pro');
    await _dashboard.changeAccountPlan(pro.id);
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
    await _ensureGenerousAccountPlan();
    final basic = await _findPlan('user', 'Basic');
    final user = await _ensureUser('scenario-1', planId: basic.id);
    final result = await _consume.consume(
      userId: user.id,
      units: 10,
      requestId: _requestId('sc1'),
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
    await _ensureGenerousAccountPlan();
    final basic = await _findPlan('user', 'Basic');
    final user = await _ensureUser('scenario-2', planId: basic.id);
    final result = await _consume.consume(
      userId: user.id,
      units: 25,
      requestId: _requestId('sc2'),
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
    final user = await _ensureUser('scenario-3', planId: premium.id);

    var remaining = (await _dashboard.getUsage()).account.remaining;
    while (remaining > 0) {
      final units =
          remaining > tiny.maxPerRequest ? tiny.maxPerRequest : remaining;
      final drain = await _consume.consume(
        userId: user.id,
        units: units,
        requestId: _requestId('sc3d'),
      );
      if (!drain.accepted) break;
      remaining = drain.account.remaining;
    }

    final result = await _consume.consume(
      userId: user.id,
      units: 1,
      requestId: _requestId('sc3'),
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
    await _ensureGenerousAccountPlan();
    final basic = await _findPlan('user', 'Basic');
    PlanDto boostPlan;
    try {
      boostPlan = await _findPlan('user', 'Demo Boost');
    } catch (_) {
      boostPlan = await _ensureCustomPlan(
        scope: 'user',
        name: 'Demo Boost',
        monthlyAllowance: 1000,
        maxPerRequest: 100,
      );
    }

    final user = await _ensureUser('scenario-4', planId: basic.id);
    final first = await _consume.consume(
      userId: user.id,
      units: 25,
      requestId: _requestId('sc4a'),
    );
    await _users.changeUserPlan(user.id, boostPlan.id);
    final second = await _consume.consume(
      userId: user.id,
      units: 25,
      requestId: _requestId('sc4b'),
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
    await _ensureGenerousAccountPlan();
    final plan = await _ensureCustomPlan(
      scope: 'user',
      name: 'Scenario Editable',
      monthlyAllowance: 5000,
      maxPerRequest: 10,
    );
    final user = await _ensureUser('scenario-5', planId: plan.id);
    final first = await _consume.consume(
      userId: user.id,
      units: 20,
      requestId: _requestId('sc5a'),
    );
    await _plans.updatePlan(plan.id, maxPerRequest: 50);
    final second = await _consume.consume(
      userId: user.id,
      units: 20,
      requestId: _requestId('sc5b'),
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
    await _ensureGenerousAccountPlan();
    final userProbe = await _ensureUser('scenario-6');
    final usageBefore = await _users.getUserUsage(userProbe.id);
    final consumed = usageBefore.user.usage.consumed;
    // Reused user may already have usage; raise allowance so we still have +50 headroom.
    final plan = await _ensureCustomPlan(
      scope: 'user',
      name: 'Scenario Shrink',
      monthlyAllowance: consumed + 50,
      maxPerRequest: 50,
    );
    final user = await _ensureUser('scenario-6', planId: plan.id);
    final first = await _consume.consume(
      userId: user.id,
      units: 40,
      requestId: _requestId('sc6a'),
    );
    final afterFirst = first.user.consumed;
    await _plans.updatePlan(plan.id, monthlyAllowance: afterFirst);
    final usage = await _users.getUserUsage(user.id);
    final second = await _consume.consume(
      userId: user.id,
      units: 1,
      requestId: _requestId('sc6b'),
    );
    return [
      _step(
        label: 'Consume 40 with headroom',
        expected: 'accepted',
        actual: first.accepted ? 'accepted' : 'rejected',
        passed: first.accepted,
      ),
      _step(
        label: 'After lowering allowance to current usage',
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
    await _ensureGenerousAccountPlan();
    final basic = await _findPlan('user', 'Basic');
    final user = await _ensureUser('scenario-7', planId: basic.id);
    final requestId = _requestId('sc7');
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
        actual: 'accepted=${first.accepted}, replayed=${first.replayed}',
        passed: first.accepted && !first.replayed,
      ),
      _step(
        label: 'Retry same requestId',
        expected: 'replayed=true, same consumed',
        actual:
            'replayed=${second.replayed}, consumed=${second.user.consumed}',
        passed:
            second.replayed && second.user.consumed == first.user.consumed,
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
