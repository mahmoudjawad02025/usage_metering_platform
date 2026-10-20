class PlanDto {
  const PlanDto({
    required this.id,
    required this.scope,
    required this.name,
    required this.monthlyAllowance,
    required this.maxPerRequest,
    required this.isPredefined,
  });

  final String id;
  final String scope;
  final String name;
  final int monthlyAllowance;
  final int maxPerRequest;
  final bool isPredefined;

  factory PlanDto.fromJson(Map<String, dynamic> json) => PlanDto(
        id: json['id'] as String,
        scope: json['scope'] as String,
        name: json['name'] as String,
        monthlyAllowance: json['monthlyAllowance'] as int,
        maxPerRequest: json['maxPerRequest'] as int,
        isPredefined: json['isPredefined'] as bool,
      );

  String get label =>
      '$name ($monthlyAllowance/month, $maxPerRequest/request)';
}

class PlanViewDto {
  const PlanViewDto({
    required this.id,
    required this.name,
    required this.monthlyAllowance,
    required this.maxPerRequest,
  });

  final String id;
  final String name;
  final int monthlyAllowance;
  final int maxPerRequest;

  factory PlanViewDto.fromJson(Map<String, dynamic> json) => PlanViewDto(
        id: json['id'] as String,
        name: json['name'] as String,
        monthlyAllowance: json['monthlyAllowance'] as int,
        maxPerRequest: json['maxPerRequest'] as int,
      );
}

class AccountDto {
  const AccountDto({
    required this.id,
    required this.name,
    required this.plan,
  });

  final String id;
  final String name;
  final PlanDto plan;

  factory AccountDto.fromJson(Map<String, dynamic> json) => AccountDto(
        id: json['id'] as String,
        name: json['name'] as String,
        plan: PlanDto.fromJson(json['plan'] as Map<String, dynamic>),
      );
}

class UserDto {
  const UserDto({
    required this.id,
    required this.externalId,
    required this.plan,
  });

  final String id;
  final String externalId;
  final PlanDto plan;

  factory UserDto.fromJson(Map<String, dynamic> json) => UserDto(
        id: json['id'] as String,
        externalId: json['externalId'] as String,
        plan: PlanDto.fromJson(json['plan'] as Map<String, dynamic>),
      );
}

class LevelUsage {
  const LevelUsage({
    required this.plan,
    required this.consumed,
    required this.remaining,
  });

  final PlanViewDto plan;
  final int consumed;
  final int remaining;

  factory LevelUsage.fromJson(Map<String, dynamic> json) => LevelUsage(
        plan: PlanViewDto.fromJson(json['plan'] as Map<String, dynamic>),
        consumed: json['consumed'] as int,
        remaining: json['remaining'] as int,
      );

  double get fractionUsed {
    if (plan.monthlyAllowance == 0) return 1.0;
    return (consumed / plan.monthlyAllowance).clamp(0.0, 1.0).toDouble();
  }
}

class UserUsage {
  const UserUsage({
    required this.id,
    required this.externalId,
    required this.usage,
  });

  final String id;
  final String externalId;
  final LevelUsage usage;

  factory UserUsage.fromJson(Map<String, dynamic> json) => UserUsage(
        id: json['id'] as String,
        externalId: json['externalId'] as String,
        usage: LevelUsage.fromJson(json),
      );
}

class PageDto<T> {
  const PageDto({
    required this.items,
    required this.total,
    required this.limit,
    required this.offset,
  });

  final List<T> items;
  final int total;
  final int limit;
  final int offset;

  bool get hasMore => offset + items.length < total;

  factory PageDto.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromItem,
  ) =>
      PageDto(
        items: (json['items'] as List<dynamic>)
            .map((item) => fromItem(item as Map<String, dynamic>))
            .toList(),
        total: json['total'] as int,
        limit: json['limit'] as int,
        offset: json['offset'] as int,
      );
}

class UsageSummary {
  const UsageSummary({
    required this.period,
    required this.account,
    required this.users,
  });

  final String period;
  final LevelUsage account;
  final PageDto<UserUsage> users;

  factory UsageSummary.fromJson(Map<String, dynamic> json) => UsageSummary(
        period: json['period'] as String,
        account: LevelUsage.fromJson(json['account'] as Map<String, dynamic>),
        users: PageDto.fromJson(
          json['users'] as Map<String, dynamic>,
          UserUsage.fromJson,
        ),
      );
}

class UserUsageResult {
  const UserUsageResult({required this.period, required this.user});

  final String period;
  final UserUsage user;

  factory UserUsageResult.fromJson(Map<String, dynamic> json) =>
      UserUsageResult(
        period: json['period'] as String,
        user: UserUsage.fromJson(json['user'] as Map<String, dynamic>),
      );
}

class Rejection {
  const Rejection({
    required this.rule,
    required this.level,
    required this.limit,
    this.remaining,
  });

  final String rule;
  final String level;
  final int limit;
  final int? remaining;

  factory Rejection.fromJson(Map<String, dynamic> json) => Rejection(
        rule: json['rule'] as String,
        level: json['level'] as String,
        limit: json['limit'] as int,
        remaining: json['remaining'] as int?,
      );

  String get explanation {
    final owner = level == 'user' ? "the user's" : "the shared account's";
    if (rule == 'max_per_request') {
      return 'Rejected by $owner per-request limit (at most $limit units per request).';
    }
    return 'Rejected by $owner monthly allowance '
        '(limit $limit, ${remaining ?? 0} units left).';
  }
}

class AppliedLimitSnapshot {
  const AppliedLimitSnapshot({
    required this.planId,
    required this.planName,
    required this.monthlyAllowance,
    required this.maxPerRequest,
    required this.consumedBefore,
  });

  final String planId;
  final String planName;
  final int monthlyAllowance;
  final int maxPerRequest;
  final int consumedBefore;

  factory AppliedLimitSnapshot.fromJson(Map<String, dynamic> json) =>
      AppliedLimitSnapshot(
        planId: json['planId'] as String,
        planName: json['planName'] as String,
        monthlyAllowance: json['monthlyAllowance'] as int,
        maxPerRequest: json['maxPerRequest'] as int,
        consumedBefore: json['consumedBefore'] as int,
      );
}

class AppliedLimits {
  const AppliedLimits({required this.account, required this.user});

  final AppliedLimitSnapshot account;
  final AppliedLimitSnapshot user;

  factory AppliedLimits.fromJson(Map<String, dynamic> json) => AppliedLimits(
        account: AppliedLimitSnapshot.fromJson(
          json['account'] as Map<String, dynamic>,
        ),
        user: AppliedLimitSnapshot.fromJson(
          json['user'] as Map<String, dynamic>,
        ),
      );
}

class ConsumeResult {
  const ConsumeResult({
    required this.accepted,
    required this.replayed,
    required this.requestId,
    required this.units,
    required this.period,
    required this.rejection,
    required this.account,
    required this.user,
  });

  final bool accepted;
  final bool replayed;
  final String requestId;
  final int units;
  final String period;
  final Rejection? rejection;
  final LevelUsage account;
  final LevelUsage user;

  bool get processed => accepted && !replayed;

  factory ConsumeResult.fromJson(Map<String, dynamic> json) {
    final userJson = json['user'] as Map<String, dynamic>;
    final rejectionJson = json['rejection'] as Map<String, dynamic>?;
    return ConsumeResult(
      accepted: json['accepted'] as bool,
      replayed: json['replayed'] as bool,
      requestId: json['requestId'] as String,
      units: json['units'] as int,
      period: json['period'] as String,
      rejection:
          rejectionJson == null ? null : Rejection.fromJson(rejectionJson),
      account: LevelUsage.fromJson(json['account'] as Map<String, dynamic>),
      user: LevelUsage.fromJson(userJson),
    );
  }
}

class HistoryItem {
  const HistoryItem({
    required this.id,
    required this.requestId,
    required this.userId,
    required this.units,
    required this.period,
    required this.accepted,
    required this.rejection,
    required this.appliedLimits,
    required this.createdAt,
  });

  final String id;
  final String requestId;
  final String userId;
  final int units;
  final String period;
  final bool accepted;
  final Rejection? rejection;
  final AppliedLimits appliedLimits;
  final String createdAt;

  factory HistoryItem.fromJson(Map<String, dynamic> json) {
    final rejectionJson = json['rejection'] as Map<String, dynamic>?;
    return HistoryItem(
      id: json['id'] as String,
      requestId: json['requestId'] as String,
      userId: json['userId'] as String,
      units: json['units'] as int,
      period: json['period'] as String,
      accepted: json['accepted'] as bool,
      rejection:
          rejectionJson == null ? null : Rejection.fromJson(rejectionJson),
      appliedLimits: AppliedLimits.fromJson(
        json['appliedLimits'] as Map<String, dynamic>,
      ),
      createdAt: json['createdAt'] as String,
    );
  }
}

class SessionInfo {
  const SessionInfo({required this.authenticated, this.accountName});

  final bool authenticated;
  final String? accountName;

  factory SessionInfo.fromJson(Map<String, dynamic> json) => SessionInfo(
        authenticated: json['authenticated'] as bool,
        accountName: json['accountName'] as String?,
      );
}

class SignUpResult {
  const SignUpResult({required this.account, required this.apiKey});

  final AccountDto account;
  final String apiKey;

  factory SignUpResult.fromJson(Map<String, dynamic> json) => SignUpResult(
        account: AccountDto.fromJson(json['account'] as Map<String, dynamic>),
        apiKey: json['apiKey'] as String,
      );
}
