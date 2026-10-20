import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/api_exception.dart';
import '../../../core/layout.dart';
import '../../../core/theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_banner.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/month_picker.dart';
import '../../../core/widgets/plan_chip.dart';
import '../../../core/widgets/section_title.dart';
import '../../../core/widgets/usage_bar.dart';
import '../../auth/auth_cubit.dart';
import '../dashboard_cubit.dart';
import '../dashboard_repository.dart';
import '../dashboard_state.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) =>
          DashboardCubit(context.read<DashboardRepository>())..load(),
      child: const _DashboardView(),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();

  void _handleError(BuildContext context, Object err) {
    if (err is ApiException && err.isUnauthorized) {
      context.read<AuthCubit>().handleUnauthorized();
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<DashboardCubit, DashboardState>(
      listener: (context, state) {
        // Errors are shown in the banner; 401 handled via catch in cubit callers.
      },
      builder: (context, state) {
        if (state.status == DashboardStatus.initial ||
            (state.status == DashboardStatus.loading && state.account == null)) {
          return const LoadingView(message: 'Loading dashboard…');
        }

        return ContentConstraint(
          child: RefreshIndicator(
            onRefresh: () async {
              try {
                await context.read<DashboardCubit>().load();
              } catch (err) {
                _handleError(context, err);
              }
            },
            child: ListView(
              children: [
                const SectionTitle(
                  'Dashboard',
                  subtitle: 'Account plan, shared usage, and per-user bars.',
                ),
                const SizedBox(height: AppSpacing.md),
                if (state.errorMessage != null) ...[
                  ErrorBanner(
                    message: state.errorMessage!,
                    onRetry: () async {
                      try {
                        await context.read<DashboardCubit>().load();
                      } catch (err) {
                        _handleError(context, err);
                      }
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                if (state.account == null)
                  const EmptyState(message: 'No account data yet.')
                else ...[
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          state.account!.name,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        PlanChip(plan: state.account!.plan, showScope: true),
                        const SizedBox(height: AppSpacing.md),
                        MonthPicker(
                          value: state.period,
                          onChanged: (period) async {
                            try {
                              await context
                                  .read<DashboardCubit>()
                                  .load(period: period);
                            } catch (err) {
                              _handleError(context, err);
                            }
                          },
                        ),
                        if (state.usage != null) ...[
                          const SizedBox(height: AppSpacing.md),
                          UsageBar(
                            label: 'Account usage (${state.usage!.period})',
                            usage: state.usage!.account,
                          ),
                        ],
                        const SizedBox(height: AppSpacing.md),
                        DropdownButtonFormField<String>(
                          // ignore: deprecated_member_use
                          value: state.accountPlans
                                  .any((p) => p.id == state.account!.plan.id)
                              ? state.account!.plan.id
                              : null,
                          decoration: const InputDecoration(
                            labelText: 'Change account plan',
                          ),
                          items: [
                            for (final plan in state.accountPlans)
                              DropdownMenuItem(
                                value: plan.id,
                                child: Text(plan.label),
                              ),
                          ],
                          onChanged: state.status == DashboardStatus.loading
                              ? null
                              : (planId) async {
                                  if (planId == null) return;
                                  try {
                                    await context
                                        .read<DashboardCubit>()
                                        .changeAccountPlan(planId);
                                  } catch (err) {
                                    _handleError(context, err);
                                  }
                                },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Users this month',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        if (state.usage == null ||
                            state.usage!.users.items.isEmpty)
                          const EmptyState(
                            message: 'No users with usage yet.',
                            icon: Icons.people_outline,
                          )
                        else
                          for (final user in state.usage!.users.items) ...[
                            UsageBar(
                              label: '${user.externalId} · ${user.usage.plan.name}',
                              usage: user.usage,
                              dense: true,
                            ),
                            const SizedBox(height: AppSpacing.sm),
                          ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
