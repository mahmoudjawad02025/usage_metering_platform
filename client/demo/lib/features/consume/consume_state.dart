import '../../core/models.dart';

enum ConsumeStatus { initial, loading, success, failure }

class ConsumeState {
  const ConsumeState({
    this.status = ConsumeStatus.initial,
    this.users = const [],
    this.selectedUserId,
    this.units = 10,
    this.lastResult,
    this.lastRequestId,
    this.recent = const [],
    this.errorMessage,
    this.processing = false,
  });

  final ConsumeStatus status;
  final List<UserDto> users;
  final String? selectedUserId;
  final int units;
  final ConsumeResult? lastResult;
  final String? lastRequestId;
  final List<ConsumeResult> recent;
  final String? errorMessage;
  final bool processing;

  String? get selectedUserName {
    for (final user in users) {
      if (user.id == selectedUserId) return user.externalId;
    }
    return null;
  }

  ConsumeState copyWith({
    ConsumeStatus? status,
    List<UserDto>? users,
    String? selectedUserId,
    int? units,
    ConsumeResult? lastResult,
    String? lastRequestId,
    List<ConsumeResult>? recent,
    String? errorMessage,
    bool? processing,
    bool clearError = false,
  }) {
    return ConsumeState(
      status: status ?? this.status,
      users: users ?? this.users,
      selectedUserId: selectedUserId ?? this.selectedUserId,
      units: units ?? this.units,
      lastResult: lastResult ?? this.lastResult,
      lastRequestId: lastRequestId ?? this.lastRequestId,
      recent: recent ?? this.recent,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      processing: processing ?? this.processing,
    );
  }
}
