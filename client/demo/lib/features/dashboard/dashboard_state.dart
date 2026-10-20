import '../../core/models.dart';
import '../../core/widgets/month_picker.dart';

enum DashboardStatus { initial, loading, success, failure }

class DashboardState {
  DashboardState({
    this.status = DashboardStatus.initial,
    this.account,
    this.usage,
    this.accountPlans = const [],
    String? period,
    this.errorMessage,
  }) : period = period ?? currentUtcMonth();

  final DashboardStatus status;
  final AccountDto? account;
  final UsageSummary? usage;
  final List<PlanDto> accountPlans;
  final String period;
  final String? errorMessage;

  DashboardState copyWith({
    DashboardStatus? status,
    AccountDto? account,
    UsageSummary? usage,
    List<PlanDto>? accountPlans,
    String? period,
    String? errorMessage,
    bool clearError = false,
  }) {
    return DashboardState(
      status: status ?? this.status,
      account: account ?? this.account,
      usage: usage ?? this.usage,
      accountPlans: accountPlans ?? this.accountPlans,
      period: period ?? this.period,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
