import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'app_shell.dart';
import 'core/api_client.dart';
import 'core/theme.dart';
import 'features/auth/auth_cubit.dart';
import 'features/auth/auth_repository.dart';
import 'features/auth/auth_state.dart';
import 'features/auth/view/auth_page.dart';
import 'features/consume/consume_repository.dart';
import 'features/dashboard/dashboard_repository.dart';
import 'features/history/history_repository.dart';
import 'features/plans/plans_repository.dart';
import 'features/users/users_repository.dart';

void main() {
  final apiClient = ApiClient();
  final authRepository = AuthRepository(apiClient);
  final dashboardRepository = DashboardRepository(apiClient);
  final usersRepository = UsersRepository(apiClient);
  final plansRepository = PlansRepository(apiClient);
  final consumeRepository = ConsumeRepository(apiClient);
  final historyRepository = HistoryRepository(apiClient);

  runApp(
    MultiRepositoryProvider(
      providers: [
        RepositoryProvider<ApiClient>.value(value: apiClient),
        RepositoryProvider<AuthRepository>.value(value: authRepository),
        RepositoryProvider<DashboardRepository>.value(
          value: dashboardRepository,
        ),
        RepositoryProvider<UsersRepository>.value(value: usersRepository),
        RepositoryProvider<PlansRepository>.value(value: plansRepository),
        RepositoryProvider<ConsumeRepository>.value(value: consumeRepository),
        RepositoryProvider<HistoryRepository>.value(value: historyRepository),
      ],
      child: BlocProvider(
        create: (_) => AuthCubit(authRepository)..bootstrap(),
        child: const UsageDemoApp(),
      ),
    ),
  );
}

class UsageDemoApp extends StatelessWidget {
  const UsageDemoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Usage metering demo',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      home: BlocBuilder<AuthCubit, AuthState>(
        builder: (context, state) {
          if (state.status == AuthStatus.initial) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (state.isAuthenticated && state.oneTimeApiKey == null) {
            return const AppShell();
          }
          return const AuthPage();
        },
      ),
    );
  }
}
