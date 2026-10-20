class PlanInfo {
  const PlanInfo({
    required this.id,
    required this.name,
    required this.monthlyAllowance,
    required this.maxPerRequest,
  });
  final String id;
  final String name;
  final int monthlyAllowance;
  final int maxPerRequest;
  factory PlanInfo.fromJson(Map<String, dynamic> json) => PlanInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        monthlyAllowance: json['monthlyAllowance'] as int,
        maxPerRequest: json['maxPerRequest'] as int,
      );
  String get label => '$name ($monthlyAllowance/month, $maxPerRequest/request)';
}
class LevelUsage {
  const LevelUsage({required this.plan, required this.consumed, required this.remaining});
  final PlanInfo plan;
  final int consumed;
  final int remaining;
  factory LevelUsage.fromJson(Map<String, dynamic> json) => LevelUsage(
        plan: PlanInfo.fromJson(json['plan'] as Map<String, dynamic>),
        consumed: json['consumed'] as int,
        remaining: json['remaining'] as int,
      );
  double get fractionUsed {
    if (plan.monthlyAllowance == 0) return 1.0;
    return (consumed / plan.monthlyAllowance).clamp(0.0, 1.0).toDouble();
  }
}
class UserUsage {
  const UserUsage({required this.id, required this.externalId, required this.usage});
  final String id;
  final String externalId;
  final LevelUsage usage;
  factory UserUsage.fromJson(Map<String, dynamic> json) => UserUsage(
        id: json['id'] as String,
        externalId: json['externalId'] as String,
        usage: LevelUsage.fromJson(json),
      );
}
class Rejection {
  const Rejection({required this.rule, required this.level, required this.limit, this.remaining});
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
    return 'Rejected by $owner monthly allowance (limit $limit, ${remaining ?? 0} remaining).';
  }
}
class Decision {
  const Decision({
    required this.accepted,
    required this.replayed,
    required this.requestId,
    required this.units,
    required this.userId,
    required this.rejection,
    required this.account,
    required this.user,
  });
  final bool accepted;
  final bool replayed;
  final String requestId;
  final int units;
  final String userId;
  final Rejection? rejection;
  final LevelUsage account;
  final LevelUsage user;
  factory Decision.fromJson(Map<String, dynamic> json) {
    final userJson = json['user'] as Map<String, dynamic>;
    final rejectionJson = json['rejection'] as Map<String, dynamic>?;
    return Decision(
      accepted: json['accepted'] as bool,
      replayed: json['replayed'] as bool,
      requestId: json['requestId'] as String,
      units: json['units'] as int,
      userId: userJson['id'] as String,
      rejection: rejectionJson == null ? null : Rejection.fromJson(rejectionJson),
      account: LevelUsage.fromJson(json['account'] as Map<String, dynamic>),
      user: LevelUsage.fromJson(userJson),
    );
  }
}
class ProcessResult {
  const ProcessResult({required this.processed, required this.decision});
  final bool processed;
  final Decision decision;
}

class StatusSnapshot {
  const StatusSnapshot({
    required this.accountName,
    required this.period,
    required this.account,
    required this.users,
    required this.accountPlans,
    required this.userPlans,
  });
  final String accountName;
  final String period;
  final LevelUsage account;
  final List<UserUsage> users;
  final List<PlanInfo> accountPlans;
  final List<PlanInfo> userPlans;

  factory StatusSnapshot.fromResponses(
    Map<String, dynamic> account,
    Map<String, dynamic> usage,
    Map<String, dynamic> plans,
  ) {
    final usersPage = usage['users'] as Map<String, dynamic>;
    final planItems = (plans['items'] as List<dynamic>).cast<Map<String, dynamic>>();
    return StatusSnapshot(
      accountName: account['name'] as String,
      period: usage['period'] as String,
      account: LevelUsage.fromJson(usage['account'] as Map<String, dynamic>),
      users: (usersPage['items'] as List<dynamic>)
          .map((item) => UserUsage.fromJson(item as Map<String, dynamic>))
          .toList(),
      accountPlans: [
        for (final plan in planItems)
          if (plan['scope'] == 'account') PlanInfo.fromJson(plan),
      ],
      userPlans: [
        for (final plan in planItems)
          if (plan['scope'] == 'user') PlanInfo.fromJson(plan),
      ],
    );
  }
}