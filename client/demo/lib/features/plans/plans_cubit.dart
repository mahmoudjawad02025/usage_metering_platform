import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/api_exception.dart';
import 'plans_repository.dart';
import 'plans_state.dart';

class PlansCubit extends Cubit<PlansState> {
  PlansCubit(this._repository) : super(const PlansState());

  final PlansRepository _repository;

  Future<void> load({String? scope, int? offset, bool clearScope = false}) async {
    final nextScope = clearScope ? null : (scope ?? state.scopeFilter);
    final nextOffset = offset ?? state.offset;
    emit(state.copyWith(
      status: PlansStatus.loading,
      scopeFilter: nextScope,
      offset: nextOffset,
      clearScope: clearScope,
      clearError: true,
    ));
    try {
      final page = await _repository.listPlans(
        scope: nextScope,
        limit: state.limit,
        offset: nextOffset,
      );
      emit(state.copyWith(
        status: PlansStatus.success,
        plans: page.items,
        total: page.total,
        clearError: true,
      ));
    } catch (err) {
      emit(state.copyWith(
        status: PlansStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  Future<void> create({
    required String scope,
    required String name,
    required int monthlyAllowance,
    required int maxPerRequest,
  }) async {
    emit(state.copyWith(status: PlansStatus.loading, clearError: true));
    try {
      await _repository.createPlan(
        scope: scope,
        name: name,
        monthlyAllowance: monthlyAllowance,
        maxPerRequest: maxPerRequest,
      );
      await load(offset: 0);
    } catch (err) {
      emit(state.copyWith(
        status: PlansStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  Future<void> update(
    String id, {
    String? name,
    int? monthlyAllowance,
    int? maxPerRequest,
  }) async {
    emit(state.copyWith(status: PlansStatus.loading, clearError: true));
    try {
      await _repository.updatePlan(
        id,
        name: name,
        monthlyAllowance: monthlyAllowance,
        maxPerRequest: maxPerRequest,
      );
      await load();
    } catch (err) {
      emit(state.copyWith(
        status: PlansStatus.failure,
        errorMessage: _message(err),
      ));
      rethrow;
    }
  }

  String _message(Object err) =>
      err is ApiException ? err.message : 'Something went wrong.';
}
