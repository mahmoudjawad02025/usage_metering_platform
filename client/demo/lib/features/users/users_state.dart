import '../../core/models.dart';
import '../../core/widgets/month_picker.dart';

enum UsersStatus { initial, loading, success, failure }

class UsersState {
  UsersState({
    this.status = UsersStatus.initial,
    this.users = const [],
    this.userPlans = const [],
    this.total = 0,
    this.limit = 20,
    this.offset = 0,
    this.selectedUser,
    this.selectedUsage,
    String? detailPeriod,
    this.errorMessage,
  }) : detailPeriod = detailPeriod ?? currentUtcMonth();

  final UsersStatus status;
  final List<UserDto> users;
  final List<PlanDto> userPlans;
  final int total;
  final int limit;
  final int offset;
  final UserDto? selectedUser;
  final UserUsageResult? selectedUsage;
  final String detailPeriod;
  final String? errorMessage;

  UsersState copyWith({
    UsersStatus? status,
    List<UserDto>? users,
    List<PlanDto>? userPlans,
    int? total,
    int? limit,
    int? offset,
    UserDto? selectedUser,
    UserUsageResult? selectedUsage,
    String? detailPeriod,
    String? errorMessage,
    bool clearError = false,
    bool clearSelection = false,
  }) {
    return UsersState(
      status: status ?? this.status,
      users: users ?? this.users,
      userPlans: userPlans ?? this.userPlans,
      total: total ?? this.total,
      limit: limit ?? this.limit,
      offset: offset ?? this.offset,
      selectedUser: clearSelection ? null : (selectedUser ?? this.selectedUser),
      selectedUsage:
          clearSelection ? null : (selectedUsage ?? this.selectedUsage),
      detailPeriod: detailPeriod ?? this.detailPeriod,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
