import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/api_exception.dart';
import 'users_repository.dart';
import 'users_state.dart';

class UsersCubit extends Cubit<UsersState> {
  UsersCubit(this._repository) : super(UsersState());

  final UsersRepository _repository;

  Future<void> load({int? offset}) async {
    final nextOffset = offset ?? state.offset;
    emit(state.copyWith(
      status: UsersStatus.loading,
      offset: nextOffset,
      clearError: true,
    ));
    try {
      final page = await _repository.listUsers(
        limit: state.limit,
        offset: nextOffset,
      );
      final plans = await _repository.listUserPlans();
      emit(state.copyWith(
        status: UsersStatus.success,
        users: page.items,
        total: page.total,
        userPlans: plans,
        clearError: true,
      ));
    } catch (err) {
      emit(state.copyWith(
        status: UsersStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  Future<void> register({required String externalId, String? planId}) async {
    emit(state.copyWith(status: UsersStatus.loading, clearError: true));
    try {
      await _repository.registerUser(externalId: externalId, planId: planId);
      await load(offset: 0);
    } catch (err) {
      emit(state.copyWith(
        status: UsersStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  Future<void> changePlan(String userId, String planId) async {
    emit(state.copyWith(status: UsersStatus.loading, clearError: true));
    try {
      await _repository.changeUserPlan(userId, planId);
      await load();
      if (state.selectedUser?.id == userId) {
        await openUser(userId);
      }
    } catch (err) {
      emit(state.copyWith(
        status: UsersStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  Future<void> openUser(String userId, {String? period}) async {
    final nextPeriod = period ?? state.detailPeriod;
    emit(state.copyWith(
      status: UsersStatus.loading,
      detailPeriod: nextPeriod,
      clearError: true,
    ));
    try {
      final user = await _repository.getUser(userId);
      final usage =
          await _repository.getUserUsage(userId, period: nextPeriod);
      emit(state.copyWith(
        status: UsersStatus.success,
        selectedUser: user,
        selectedUsage: usage,
        clearError: true,
      ));
    } catch (err) {
      emit(state.copyWith(
        status: UsersStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  void clearSelection() {
    emit(state.copyWith(clearSelection: true));
  }

  String _message(Object err) =>
      err is ApiException ? err.message : 'Something went wrong.';
}
