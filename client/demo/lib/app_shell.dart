import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'core/layout.dart';
import 'features/auth/auth_cubit.dart';
import 'features/consume/view/consume_page.dart';
import 'features/dashboard/view/dashboard_page.dart';
import 'features/history/view/history_page.dart';
import 'features/plans/view/plans_page.dart';
import 'features/scenarios/view/scenarios_page.dart';
import 'features/users/view/users_page.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  static const _destinations = [
    (icon: Icons.dashboard_outlined, label: 'Dashboard'),
    (icon: Icons.people_outline, label: 'Users'),
    (icon: Icons.list_alt, label: 'Plans'),
    (icon: Icons.bolt_outlined, label: 'Consume'),
    (icon: Icons.history, label: 'History'),
    (icon: Icons.science_outlined, label: 'Scenarios'),
  ];

  @override
  Widget build(BuildContext context) {
    final accountName =
        context.watch<AuthCubit>().state.accountName ?? 'Account';
    final pages = const [
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
              onDestinationSelected: (value) => setState(() => _index = value),
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
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: [
          for (final dest in _destinations)
            NavigationDestination(icon: Icon(dest.icon), label: dest.label),
        ],
      ),
    );
  }
}
