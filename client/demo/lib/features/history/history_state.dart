import '../../core/models.dart';
import '../../core/widgets/month_picker.dart';

enum HistoryStatus { initial, loading, success, failure }

class HistoryState {
  HistoryState({
    this.status = HistoryStatus.initial,
    this.items = const [],
    this.users = const [],
    this.total = 0,
    this.limit = 20,
    this.offset = 0,
    this.userId,
    this.acceptedFilter,
    String? period,
    this.errorMessage,
  }) : period = period ?? currentUtcMonth();

  final HistoryStatus status;
  final List<HistoryItem> items;
  final List<UserDto> users;
  final int total;
  final int limit;
  final int offset;
  final String? userId;
  final bool? acceptedFilter;
  final String period;
  final String? errorMessage;

  HistoryState copyWith({
    HistoryStatus? status,
    List<HistoryItem>? items,
    List<UserDto>? users,
    int? total,
    int? limit,
    int? offset,
    String? userId,
    bool? acceptedFilter,
    String? period,
    String? errorMessage,
    bool clearError = false,
    bool clearUser = false,
    bool clearAccepted = false,
  }) {
    return HistoryState(
      status: status ?? this.status,
      items: items ?? this.items,
      users: users ?? this.users,
      total: total ?? this.total,
      limit: limit ?? this.limit,
      offset: offset ?? this.offset,
      userId: clearUser ? null : (userId ?? this.userId),
      acceptedFilter:
          clearAccepted ? null : (acceptedFilter ?? this.acceptedFilter),
      period: period ?? this.period,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
