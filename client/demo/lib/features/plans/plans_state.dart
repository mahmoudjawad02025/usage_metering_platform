import '../../core/models.dart';

enum PlansStatus { initial, loading, success, failure }

class PlansState {
  const PlansState({
    this.status = PlansStatus.initial,
    this.plans = const [],
    this.total = 0,
    this.limit = 20,
    this.offset = 0,
    this.scopeFilter,
    this.errorMessage,
  });

  final PlansStatus status;
  final List<PlanDto> plans;
  final int total;
  final int limit;
  final int offset;
  final String? scopeFilter;
  final String? errorMessage;

  PlansState copyWith({
    PlansStatus? status,
    List<PlanDto>? plans,
    int? total,
    int? limit,
    int? offset,
    String? scopeFilter,
    String? errorMessage,
    bool clearError = false,
    bool clearScope = false,
  }) {
    return PlansState(
      status: status ?? this.status,
      plans: plans ?? this.plans,
      total: total ?? this.total,
      limit: limit ?? this.limit,
      offset: offset ?? this.offset,
      scopeFilter: clearScope ? null : (scopeFilter ?? this.scopeFilter),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
