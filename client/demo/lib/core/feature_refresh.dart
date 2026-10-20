import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../features/consume/consume_cubit.dart';
import '../features/dashboard/dashboard_cubit.dart';
import '../features/history/history_cubit.dart';
import '../features/plans/plans_cubit.dart';
import '../features/users/users_cubit.dart';

// IndexedStack keeps pages (and Cubits) alive, so we must reload after
// mutations / tab focus — otherwise UI stays stale until a manual refresh.
/// Reloads the cubit for the selected shell tab.
Future<void> refreshTab(BuildContext context, int index) async {
  switch (index) {
    case 0:
      await context.read<DashboardCubit>().load();
    case 1:
      await context.read<UsersCubit>().load();
    case 2:
      await context.read<PlansCubit>().load();
    case 3:
      await context.read<ConsumeCubit>().load();
    case 4:
      await context.read<HistoryCubit>().load();
    case 5:
      break; // Scenarios keep last run results; no list to reload.
  }
}

Future<void> refreshAfterUsersMutation(BuildContext context) async {
  await Future.wait([
    context.read<UsersCubit>().load(),
    context.read<ConsumeCubit>().load(),
    context.read<DashboardCubit>().load(),
  ]);
}

Future<void> refreshAfterPlansMutation(BuildContext context) async {
  await Future.wait([
    context.read<PlansCubit>().load(),
    context.read<DashboardCubit>().load(),
    context.read<UsersCubit>().load(),
  ]);
}

Future<void> refreshAfterConsumeMutation(BuildContext context) async {
  await Future.wait([
    context.read<DashboardCubit>().load(),
    context.read<HistoryCubit>().load(),
  ]);
}

Future<void> refreshAfterScenarioRun(BuildContext context) async {
  await Future.wait([
    context.read<UsersCubit>().load(),
    context.read<PlansCubit>().load(),
    context.read<DashboardCubit>().load(),
    context.read<ConsumeCubit>().load(),
    context.read<HistoryCubit>().load(),
  ]);
}
