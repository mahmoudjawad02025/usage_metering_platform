import 'package:usage_metering_demo/core/api_exception.dart';
import 'package:usage_metering_demo/core/models.dart';
import 'package:usage_metering_demo/features/auth/auth_repository.dart';
import 'package:usage_metering_demo/features/consume/consume_repository.dart';
import 'package:usage_metering_demo/features/dashboard/dashboard_repository.dart';
import 'package:usage_metering_demo/features/plans/plans_repository.dart';
import 'package:usage_metering_demo/features/users/users_repository.dart';

PlanDto fakePlan({
  String id = 'plan-1',
  String scope = 'user',
  String name = 'Basic',
  int monthlyAllowance = 1000,
  int maxPerRequest = 20,
  bool isPredefined = true,
}) {
  return PlanDto(
    id: id,
    scope: scope,
    name: name,
    monthlyAllowance: monthlyAllowance,
    maxPerRequest: maxPerRequest,
    isPredefined: isPredefined,
  );
}

AccountDto fakeAccount({String name = 'Acme'}) {
  return AccountDto(
    id: 'acc-1',
    name: name,
    plan: fakePlan(scope: 'account', name: 'Starter', monthlyAllowance: 10000, maxPerRequest: 100),
  );
}

UserDto fakeUser({
  String id = 'user-1',
  String externalId = 'alice',
  PlanDto? plan,
}) {
  return UserDto(
    id: id,
    externalId: externalId,
    plan: plan ?? fakePlan(),
  );
}

LevelUsage fakeLevel({
  String planName = 'Basic',
  int allowance = 1000,
  int maxPerRequest = 20,
  int consumed = 0,
}) {
  return LevelUsage(
    plan: PlanViewDto(
      id: 'p',
      name: planName,
      monthlyAllowance: allowance,
      maxPerRequest: maxPerRequest,
    ),
    consumed: consumed,
    remaining: (allowance - consumed).clamp(0, allowance),
  );
}

ConsumeResult fakeConsume({
  bool accepted = true,
  bool replayed = false,
  String requestId = 'req-1',
  int units = 10,
  Rejection? rejection,
  int userConsumed = 10,
}) {
  return ConsumeResult(
    accepted: accepted,
    replayed: replayed,
    requestId: requestId,
    units: units,
    period: '2026-04',
    rejection: rejection,
    account: fakeLevel(planName: 'Starter', allowance: 10000, maxPerRequest: 100),
    user: fakeLevel(consumed: userConsumed),
  );
}

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository();

  bool signedIn = false;
  String? accountName = 'Demo';
  bool throwUnauthorizedOnSession = false;
  String? lastApiKey;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<SessionInfo> getSession() async {
    if (throwUnauthorizedOnSession) {
      throw const ApiException('Unauthorized', code: 'UNAUTHORIZED', status: 401);
    }
    return SessionInfo(authenticated: signedIn, accountName: accountName);
  }

  @override
  Future<AccountDto> signIn(String apiKey) async {
    lastApiKey = apiKey;
    if (apiKey == 'bad') {
      throw const ApiException('Invalid API key', code: 'UNAUTHORIZED', status: 401);
    }
    signedIn = true;
    accountName = 'Signed In Co';
    return fakeAccount(name: accountName!);
  }

  @override
  Future<SignUpResult> signUp({required String name, String? planName}) async {
    signedIn = true;
    accountName = name;
    return SignUpResult(account: fakeAccount(name: name), apiKey: 'umk_once');
  }

  @override
  Future<AccountDto> startDemo({bool fresh = false}) async {
    signedIn = true;
    accountName = fresh ? 'Fresh Demo' : 'Demo Acme';
    return fakeAccount(name: accountName!);
  }

  @override
  Future<void> signOut() async {
    signedIn = false;
  }
}

class FakeConsumeRepository implements ConsumeRepository {
  FakeConsumeRepository();

  final List<Map<String, Object>> calls = [];
  ConsumeResult? nextResult;
  Object? nextError;
  final Map<String, ConsumeResult> byRequestId = {};

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<List<UserDto>> listUsers() async => [fakeUser()];

  @override
  Future<ConsumeResult> consume({
    required String userId,
    required int units,
    required String requestId,
  }) async {
    calls.add({'userId': userId, 'units': units, 'requestId': requestId});
    if (nextError != null) {
      final err = nextError!;
      nextError = null;
      throw err;
    }
    if (byRequestId.containsKey(requestId)) {
      final previous = byRequestId[requestId]!;
      if (previous.units != units) {
        throw const ApiException(
          'requestId already used',
          code: 'REQUEST_ID_REUSED',
          status: 409,
        );
      }
      return ConsumeResult(
        accepted: previous.accepted,
        replayed: true,
        requestId: requestId,
        units: units,
        period: previous.period,
        rejection: previous.rejection,
        account: previous.account,
        user: previous.user,
      );
    }
    final result = nextResult ??
        fakeConsume(requestId: requestId, units: units, userConsumed: units);
    byRequestId[requestId] = result;
    nextResult = null;
    return result;
  }
}

class FakePlansRepository implements PlansRepository {
  FakePlansRepository();

  final List<PlanDto> plans = [
    fakePlan(id: 'basic', name: 'Basic', isPredefined: true),
    fakePlan(
      id: 'custom',
      name: 'Custom',
      isPredefined: false,
      maxPerRequest: 10,
      monthlyAllowance: 500,
    ),
  ];
  Object? updateError;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<PageDto<PlanDto>> listPlans({
    String? scope,
    int limit = 20,
    int offset = 0,
  }) async {
    final filtered = scope == null
        ? plans
        : plans.where((p) => p.scope == scope).toList();
    return PageDto(
      items: filtered,
      total: filtered.length,
      limit: limit,
      offset: offset,
    );
  }

  @override
  Future<PlanDto> getPlan(String id) async =>
      plans.firstWhere((p) => p.id == id);

  @override
  Future<PlanDto> createPlan({
    required String scope,
    required String name,
    required int monthlyAllowance,
    required int maxPerRequest,
  }) async {
    final plan = fakePlan(
      id: 'new-${plans.length}',
      scope: scope,
      name: name,
      monthlyAllowance: monthlyAllowance,
      maxPerRequest: maxPerRequest,
      isPredefined: false,
    );
    plans.add(plan);
    return plan;
  }

  @override
  Future<PlanDto> updatePlan(
    String id, {
    String? name,
    int? monthlyAllowance,
    int? maxPerRequest,
  }) async {
    if (updateError != null) throw updateError!;
    final index = plans.indexWhere((p) => p.id == id);
    final current = plans[index];
    if (current.isPredefined) {
      throw const ApiException(
        'Plan is read-only',
        code: 'PLAN_READ_ONLY',
        status: 403,
      );
    }
    final updated = PlanDto(
      id: current.id,
      scope: current.scope,
      name: name ?? current.name,
      monthlyAllowance: monthlyAllowance ?? current.monthlyAllowance,
      maxPerRequest: maxPerRequest ?? current.maxPerRequest,
      isPredefined: false,
    );
    plans[index] = updated;
    return updated;
  }
}

class FakeUsersRepository implements UsersRepository {
  FakeUsersRepository();

  final List<UserDto> users = [];

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<PageDto<UserDto>> listUsers({int limit = 20, int offset = 0}) async {
    return PageDto(items: users, total: users.length, limit: limit, offset: offset);
  }

  @override
  Future<UserDto> getUser(String id) async =>
      users.firstWhere((u) => u.id == id);

  @override
  Future<UserDto> registerUser({
    required String externalId,
    String? planId,
  }) async {
    final user = fakeUser(
      id: 'u-${users.length}',
      externalId: externalId,
      plan: fakePlan(id: planId ?? 'basic'),
    );
    users.add(user);
    return user;
  }

  @override
  Future<UserDto> changeUserPlan(String userId, String planId) async {
    final index = users.indexWhere((u) => u.id == userId);
    final updated = fakeUser(
      id: userId,
      externalId: users[index].externalId,
      plan: fakePlan(id: planId, name: 'Premium', maxPerRequest: 100),
    );
    users[index] = updated;
    return updated;
  }

  @override
  Future<List<PlanDto>> listUserPlans() async => [
        fakePlan(id: 'basic', name: 'Basic'),
        fakePlan(id: 'premium', name: 'Premium', maxPerRequest: 200, monthlyAllowance: 10000),
      ];

  @override
  Future<UserUsageResult> getUserUsage(String userId, {String? period}) async {
    return UserUsageResult(
      period: period ?? '2026-04',
      user: UserUsage(
        id: userId,
        externalId: 'x',
        usage: fakeLevel(consumed: 40, allowance: 10),
      ),
    );
  }
}

class FakeDashboardRepository implements DashboardRepository {
  FakeDashboardRepository();

  PlanDto accountPlan = fakePlan(
    id: 'tiny',
    scope: 'account',
    name: 'Demo Tiny',
    monthlyAllowance: 100,
    maxPerRequest: 50,
    isPredefined: false,
  );
  int accountRemaining = 100;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<AccountDto> getAccount() async => AccountDto(
        id: 'acc',
        name: 'Demo',
        plan: accountPlan,
      );

  @override
  Future<UsageSummary> getUsage({String? period, int limit = 100}) async {
    return UsageSummary(
      period: period ?? '2026-04',
      account: fakeLevel(
        planName: accountPlan.name,
        allowance: accountPlan.monthlyAllowance,
        maxPerRequest: accountPlan.maxPerRequest,
        consumed: accountPlan.monthlyAllowance - accountRemaining,
      ),
      users: const PageDto(items: [], total: 0, limit: 20, offset: 0),
    );
  }

  @override
  Future<List<PlanDto>> listAccountPlans() async => [accountPlan];

  @override
  Future<AccountDto> changeAccountPlan(String planId) async {
    accountPlan = fakePlan(
      id: planId,
      scope: 'account',
      name: 'Demo Tiny',
      monthlyAllowance: 100,
      maxPerRequest: 50,
      isPredefined: false,
    );
    return getAccount();
  }
}
