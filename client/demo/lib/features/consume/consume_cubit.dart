import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/api_exception.dart';
import 'consume_repository.dart';
import 'consume_state.dart';

class ConsumeCubit extends Cubit<ConsumeState> {
  ConsumeCubit(this._repository) : super(const ConsumeState());

  final ConsumeRepository _repository;
  static const _processingDelay = Duration(milliseconds: 300);

  Future<void> load() async {
    emit(state.copyWith(status: ConsumeStatus.loading, clearError: true));
    try {
      final users = await _repository.listUsers();
      emit(state.copyWith(
        status: ConsumeStatus.success,
        users: users,
        selectedUserId: state.selectedUserId ??
            (users.isNotEmpty ? users.first.id : null),
        clearError: true,
      ));
    } catch (err) {
      emit(state.copyWith(
        status: ConsumeStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  void selectUser(String userId) {
    emit(state.copyWith(selectedUserId: userId));
  }

  void setUnits(int units) {
    emit(state.copyWith(units: units));
  }

  Future<void> processDocument({String? requestId}) async {
    final userId = state.selectedUserId;
    if (userId == null) {
      emit(state.copyWith(errorMessage: 'Pick a user first.'));
      return;
    }
    final id = requestId ??
        'doc-${DateTime.now().toUtc().millisecondsSinceEpoch}';
    emit(state.copyWith(
      status: ConsumeStatus.loading,
      processing: true,
      clearError: true,
    ));
    try {
      final result = await _repository.consume(
        userId: userId,
        units: state.units,
        requestId: id,
      );
      if (result.processed) {
        await Future<void>.delayed(_processingDelay);
      }
      final recent = [result, ...state.recent].take(8).toList();
      emit(state.copyWith(
        status: ConsumeStatus.success,
        lastResult: result,
        lastRequestId: id,
        recent: recent,
        processing: false,
        clearError: true,
      ));
    } catch (err) {
      emit(state.copyWith(
        status: ConsumeStatus.failure,
        processing: false,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  Future<void> retryLast() async {
    final requestId = state.lastRequestId;
    if (requestId == null) {
      emit(state.copyWith(errorMessage: 'Nothing to retry yet.'));
      return;
    }
    await processDocument(requestId: requestId);
  }

  String _message(Object err) =>
      err is ApiException ? err.message : 'Something went wrong.';
}
