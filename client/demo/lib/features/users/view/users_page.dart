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
import '../../../core/widgets/pagination_bar.dart';
import '../../../core/widgets/plan_chip.dart';
import '../../../core/widgets/section_title.dart';
import '../../../core/widgets/usage_bar.dart';
import '../../auth/auth_cubit.dart';
import '../users_cubit.dart';
import '../users_repository.dart';
import '../users_state.dart';

class UsersPage extends StatelessWidget {
  const UsersPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => UsersCubit(context.read<UsersRepository>())..load(),
      child: const _UsersView(),
    );
  }
}

class _UsersView extends StatefulWidget {
  const _UsersView();

  @override
  State<_UsersView> createState() => _UsersViewState();
}

class _UsersViewState extends State<_UsersView> {
  final _externalIdController = TextEditingController();
  String? _registerPlanId;

  @override
  void dispose() {
    _externalIdController.dispose();
    super.dispose();
  }

  void _handleError(Object err) {
    if (err is ApiException && err.isUnauthorized) {
      context.read<AuthCubit>().handleUnauthorized();
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<UsersCubit, UsersState>(
      builder: (context, state) {
        if (state.status == UsersStatus.initial && state.users.isEmpty) {
          return const LoadingView(message: 'Loading users…');
        }

        return ContentConstraint(
          child: ListView(
            children: [
              const SectionTitle(
                'Users',
                subtitle: 'Register users, change plans, inspect monthly usage.',
              ),
              const SizedBox(height: AppSpacing.md),
              if (state.errorMessage != null) ...[
                ErrorBanner(
                  message: state.errorMessage!,
                  onRetry: () async {
                    try {
                      await context.read<UsersCubit>().load();
                    } catch (err) {
                      _handleError(err);
                    }
                  },
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Register user',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: _externalIdController,
                      decoration: const InputDecoration(
                        labelText: 'External ID',
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    DropdownButtonFormField<String?>(
                      // ignore: deprecated_member_use
                      value: _registerPlanId,
                      decoration: const InputDecoration(
                        labelText: 'User plan (optional)',
                      ),
                      items: [
                        const DropdownMenuItem(
                          value: null,
                          child: Text('Basic (default)'),
                        ),
                        for (final plan in state.userPlans)
                          DropdownMenuItem(
                            value: plan.id,
                            child: Text(plan.label),
                          ),
                      ],
                      onChanged: (value) =>
                          setState(() => _registerPlanId = value),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    FilledButton(
                      onPressed: state.status == UsersStatus.loading
                          ? null
                          : () async {
                              final id = _externalIdController.text.trim();
                              if (id.isEmpty) return;
                              try {
                                await context.read<UsersCubit>().register(
                                      externalId: id,
                                      planId: _registerPlanId,
                                    );
                                _externalIdController.clear();
                              } catch (err) {
                                _handleError(err);
                              }
                            },
                      child: const Text('Register'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (state.users.isEmpty)
                      const EmptyState(message: 'No users yet.')
                    else
                      for (final user in state.users)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(user.externalId),
                          subtitle: PlanChip(plan: user.plan),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () async {
                            try {
                              await context
                                  .read<UsersCubit>()
                                  .openUser(user.id);
                            } catch (err) {
                              _handleError(err);
                            }
                          },
                        ),
                    PaginationBar(
                      total: state.total,
                      limit: state.limit,
                      offset: state.offset,
                      onPrev: state.offset == 0
                          ? null
                          : () async {
                              try {
                                await context.read<UsersCubit>().load(
                                      offset: (state.offset - state.limit)
                                          .clamp(0, state.total),
                                    );
                              } catch (err) {
                                _handleError(err);
                              }
                            },
                      onNext: state.offset + state.limit >= state.total
                          ? null
                          : () async {
                              try {
                                await context
                                    .read<UsersCubit>()
                                    .load(offset: state.offset + state.limit);
                              } catch (err) {
                                _handleError(err);
                              }
                            },
                    ),
                  ],
                ),
              ),
              if (state.selectedUser != null) ...[
                const SizedBox(height: AppSpacing.md),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              state.selectedUser!.externalId,
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                          ),
                          IconButton(
                            onPressed: () =>
                                context.read<UsersCubit>().clearSelection(),
                            icon: const Icon(Icons.close),
                          ),
                        ],
                      ),
                      PlanChip(plan: state.selectedUser!.plan),
                      const SizedBox(height: AppSpacing.md),
                      DropdownButtonFormField<String>(
                        // ignore: deprecated_member_use
                        value: state.userPlans
                                .any((p) => p.id == state.selectedUser!.plan.id)
                            ? state.selectedUser!.plan.id
                            : null,
                        decoration: const InputDecoration(
                          labelText: 'Change user plan',
                        ),
                        items: [
                          for (final plan in state.userPlans)
                            DropdownMenuItem(
                              value: plan.id,
                              child: Text(plan.label),
                            ),
                        ],
                        onChanged: (planId) async {
                          if (planId == null) return;
                          try {
                            await context.read<UsersCubit>().changePlan(
                                  state.selectedUser!.id,
                                  planId,
                                );
                          } catch (err) {
                            _handleError(err);
                          }
                        },
                      ),
                      const SizedBox(height: AppSpacing.md),
                      MonthPicker(
                        value: state.detailPeriod,
                        onChanged: (period) async {
                          try {
                            await context.read<UsersCubit>().openUser(
                                  state.selectedUser!.id,
                                  period: period,
                                );
                          } catch (err) {
                            _handleError(err);
                          }
                        },
                      ),
                      if (state.selectedUsage != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        UsageBar(
                          label: 'Usage (${state.selectedUsage!.period})',
                          usage: state.selectedUsage!.user.usage,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
