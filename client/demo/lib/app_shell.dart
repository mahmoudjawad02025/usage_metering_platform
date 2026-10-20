import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'core/feature_refresh.dart';
import 'core/layout.dart';
import 'features/auth/auth_cubit.dart';
import 'features/consume/consume_cubit.dart';
import 'features/consume/consume_repository.dart';
import 'features/consume/view/consume_page.dart';
import 'features/dashboard/dashboard_cubit.dart';
import 'features/dashboard/dashboard_repository.dart';
import 'features/dashboard/view/dashboard_page.dart';
import 'features/history/history_cubit.dart';
import 'features/history/history_repository.dart';
import 'features/history/view/history_page.dart';
import 'features/plans/plans_cubit.dart';
import 'features/plans/plans_repository.dart';
import 'features/plans/view/plans_page.dart';
import 'features/scenarios/scenarios_cubit.dart';
import 'features/scenarios/view/scenarios_page.dart';
import 'features/users/users_cubit.dart';
import 'features/users/users_repository.dart';
import 'features/users/view/users_page.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (context) =>
              DashboardCubit(context.read<DashboardRepository>())..load(),
        ),
        BlocProvider(
          create: (context) =>
              UsersCubit(context.read<UsersRepository>())..load(),
        ),
        BlocProvider(
          create: (context) =>
              PlansCubit(context.read<PlansRepository>())..load(),
        ),
        BlocProvider(
          create: (context) =>
              ConsumeCubit(context.read<ConsumeRepository>())..load(),
        ),
        BlocProvider(
          create: (context) =>
              HistoryCubit(context.read<HistoryRepository>())..load(),
        ),
        BlocProvider(
          create: (context) => ScenariosCubit(
            users: context.read<UsersRepository>(),
            plans: context.read<PlansRepository>(),
            consume: context.read<ConsumeRepository>(),
            dashboard: context.read<DashboardRepository>(),
          ),
        ),
      ],
      child: const _AppShellBody(),
    );
  }
}

class _AppShellBody extends StatefulWidget {
  const _AppShellBody();

  @override
  State<_AppShellBody> createState() => _AppShellBodyState();
}

class _AppShellBodyState extends State<_AppShellBody> {
  int _index = 0;

  static const _destinations = [
    (icon: Icons.dashboard_outlined, label: 'Dashboard'),
    (icon: Icons.people_outline, label: 'Users'),
    (icon: Icons.list_alt, label: 'Plans'),
    (icon: Icons.bolt_outlined, label: 'Consume'),
    (icon: Icons.history, label: 'History'),
    (icon: Icons.science_outlined, label: 'Scenarios'),
  ];

  Future<void> _selectTab(int value) async {
    setState(() => _index = value);
    try {
      await refreshTab(context, value);
    } catch (_) {
      // Page banners show load errors from the cubit.
    }
  }

  @override
  Widget build(BuildContext context) {
    final accountName =
        context.watch<AuthCubit>().state.accountName ?? 'Account';
    const pages = [
      DashboardPage(),
      UsersPage(),
      PlansPage(),
      ConsumePage(),
      HistoryPage(),
      ScenariosPage(),
    ];

    final body = IndexedStack(index: _index, children: pages);

    if (AppLayout.isWide(context)) {
      return Scaffold(
        appBar: AppBar(
          title: Text(accountName),
          actions: [
            TextButton.icon(
              onPressed: () => context.read<AuthCubit>().signOut(),
              icon: const Icon(Icons.logout),
              label: const Text('Sign out'),
            ),
          ],
        ),
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: _index,
              onDestinationSelected: _selectTab,
              labelType: NavigationRailLabelType.all,
              destinations: [
                for (final dest in _destinations)
                  NavigationRailDestination(
                    icon: Icon(dest.icon),
                    label: Text(dest.label),
                  ),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(child: body),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(accountName),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => context.read<AuthCubit>().signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _selectTab,
        destinations: [
          for (final dest in _destinations)
            NavigationDestination(icon: Icon(dest.icon), label: dest.label),
        ],
      ),
    );
  }
}
