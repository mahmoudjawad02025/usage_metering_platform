import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/api_exception.dart';
import 'dashboard_repository.dart';
import 'dashboard_state.dart';

class DashboardCubit extends Cubit<DashboardState> {
  DashboardCubit(this._repository) : super(DashboardState());

  final DashboardRepository _repository;

  Future<void> load({String? period}) async {
    final nextPeriod = period ?? state.period;
    emit(state.copyWith(
      status: DashboardStatus.loading,
      period: nextPeriod,
      clearError: true,
    ));
    try {
      final account = await _repository.getAccount();
      final usage = await _repository.getUsage(period: nextPeriod);
      final accountPlans = await _repository.listAccountPlans();
      emit(state.copyWith(
        status: DashboardStatus.success,
        account: account,
        usage: usage,
        accountPlans: accountPlans,
        clearError: true,
      ));
    } catch (err) {
      emit(state.copyWith(
        status: DashboardStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  Future<void> changeAccountPlan(String planId) async {
    emit(state.copyWith(status: DashboardStatus.loading, clearError: true));
    try {
      await _repository.changeAccountPlan(planId);
      await load();
    } catch (err) {
      emit(state.copyWith(
        status: DashboardStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  String _message(Object err) =>
      err is ApiException ? err.message : 'Something went wrong.';
}
