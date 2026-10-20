import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/api_exception.dart';
import 'history_repository.dart';
import 'history_state.dart';

class HistoryCubit extends Cubit<HistoryState> {
  HistoryCubit(this._repository) : super(HistoryState());

  final HistoryRepository _repository;

  Future<void> load({
    String? userId,
    bool? accepted,
    String? period,
    int? offset,
    bool clearUser = false,
    bool clearAccepted = false,
  }) async {
    final nextUser = clearUser ? null : (userId ?? state.userId);
    final nextAccepted =
        clearAccepted ? null : (accepted ?? state.acceptedFilter);
    final nextPeriod = period ?? state.period;
    final nextOffset = offset ?? state.offset;

    emit(state.copyWith(
      status: HistoryStatus.loading,
      userId: nextUser,
      acceptedFilter: nextAccepted,
      period: nextPeriod,
      offset: nextOffset,
      clearUser: clearUser,
      clearAccepted: clearAccepted,
      clearError: true,
    ));

    try {
      final users = state.users.isEmpty
          ? await _repository.listUsers()
          : state.users;
      final page = await _repository.listHistory(
        userId: nextUser,
        accepted: nextAccepted,
        period: nextPeriod,
        limit: state.limit,
        offset: nextOffset,
      );
      emit(state.copyWith(
        status: HistoryStatus.success,
        users: users,
        items: page.items,
        total: page.total,
        clearError: true,
      ));
    } catch (err) {
      emit(state.copyWith(
        status: HistoryStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  String _message(Object err) =>
      err is ApiException ? err.message : 'Something went wrong.';
}
