import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/api_exception.dart';
import '../../../core/layout.dart';
import '../../../core/models.dart';
import '../../../core/theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_banner.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/pagination_bar.dart';
import '../../../core/widgets/plan_chip.dart';
import '../../../core/widgets/section_title.dart';
import '../../auth/auth_cubit.dart';
import '../plans_cubit.dart';
import '../plans_repository.dart';
import '../plans_state.dart';

class PlansPage extends StatelessWidget {
  const PlansPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => PlansCubit(context.read<PlansRepository>())..load(),
      child: const _PlansView(),
    );
  }
}

class _PlansView extends StatefulWidget {
  const _PlansView();

  @override
  State<_PlansView> createState() => _PlansViewState();
}

class _PlansViewState extends State<_PlansView> {
  final _nameController = TextEditingController();
  final _monthlyController = TextEditingController(text: '500');
  final _maxController = TextEditingController(text: '25');
  String _createScope = 'user';

  @override
  void dispose() {
    _nameController.dispose();
    _monthlyController.dispose();
    _maxController.dispose();
    super.dispose();
  }

  void _handleError(Object err) {
    if (err is ApiException && err.isUnauthorized) {
      context.read<AuthCubit>().handleUnauthorized();
    }
  }

  Future<void> _editPlan(PlanDto plan) async {
    if (plan.isPredefined) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Predefined plans are read-only. Create a custom plan to edit limits.',
          ),
        ),
      );
      return;
    }

    final nameController = TextEditingController(text: plan.name);
    final monthlyController =
        TextEditingController(text: '${plan.monthlyAllowance}');
    final maxController =
        TextEditingController(text: '${plan.maxPerRequest}');

    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit custom plan'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Edits apply to the next request. Existing usage counters stay the same.',
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            TextField(
              controller: monthlyController,
              decoration: const InputDecoration(labelText: 'Monthly allowance'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: maxController,
              decoration: const InputDecoration(labelText: 'Max per request'),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (saved != true || !mounted) return;
    try {
      await context.read<PlansCubit>().update(
            plan.id,
            name: nameController.text.trim(),
            monthlyAllowance: int.parse(monthlyController.text.trim()),
            maxPerRequest: int.parse(maxController.text.trim()),
          );
    } catch (err) {
      _handleError(err);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PlansCubit, PlansState>(
      builder: (context, state) {
        if (state.status == PlansStatus.initial && state.plans.isEmpty) {
          return const LoadingView(message: 'Loading plans…');
        }

        return ContentConstraint(
          child: ListView(
            children: [
              const SectionTitle(
                'Plans',
                subtitle:
                    'Predefined plans are read-only. Custom plan edits apply on the next request.',
              ),
              const SizedBox(height: AppSpacing.md),
              if (state.errorMessage != null) ...[
                ErrorBanner(
                  message: state.errorMessage!,
                  onRetry: () async {
                    try {
                      await context.read<PlansCubit>().load();
                    } catch (err) {
                      _handleError(err);
                    }
                  },
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              Wrap(
                spacing: AppSpacing.sm,
                children: [
                  FilterChip(
                    label: const Text('All'),
                    selected: state.scopeFilter == null,
                    onSelected: (_) async {
                      try {
                        await context
                            .read<PlansCubit>()
                            .load(clearScope: true, offset: 0);
                      } catch (err) {
                        _handleError(err);
                      }
                    },
                  ),
                  FilterChip(
                    label: const Text('Account'),
                    selected: state.scopeFilter == 'account',
                    onSelected: (_) async {
                      try {
                        await context
                            .read<PlansCubit>()
                            .load(scope: 'account', offset: 0);
                      } catch (err) {
                        _handleError(err);
                      }
                    },
                  ),
                  FilterChip(
                    label: const Text('User'),
                    selected: state.scopeFilter == 'user',
                    onSelected: (_) async {
                      try {
                        await context
                            .read<PlansCubit>()
                            .load(scope: 'user', offset: 0);
                      } catch (err) {
                        _handleError(err);
                      }
                    },
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Create custom plan',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    DropdownButtonFormField<String>(
                      // ignore: deprecated_member_use
                      value: _createScope,
                      decoration: const InputDecoration(labelText: 'Scope'),
                      items: const [
                        DropdownMenuItem(value: 'user', child: Text('User')),
                        DropdownMenuItem(
                          value: 'account',
                          child: Text('Account'),
                        ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _createScope = value);
                        }
                      },
                    ),
                    TextField(
                      controller: _nameController,
                      decoration: const InputDecoration(labelText: 'Name'),
                    ),
                    TextField(
                      controller: _monthlyController,
                      decoration: const InputDecoration(
                        labelText: 'Monthly allowance (0…1e9)',
                      ),
                      keyboardType: TextInputType.number,
                    ),
                    TextField(
                      controller: _maxController,
                      decoration: const InputDecoration(
                        labelText: 'Max per request (1…1e9)',
                      ),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    FilledButton(
                      onPressed: state.status == PlansStatus.loading
                          ? null
                          : () async {
                              final name = _nameController.text.trim();
                              final monthly =
                                  int.tryParse(_monthlyController.text.trim());
                              final max =
                                  int.tryParse(_maxController.text.trim());
                              if (name.isEmpty ||
                                  monthly == null ||
                                  max == null ||
                                  monthly < 0 ||
                                  max < 1) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Enter a name and valid limits.',
                                    ),
                                  ),
                                );
                                return;
                              }
                              try {
                                await context.read<PlansCubit>().create(
                                      scope: _createScope,
                                      name: name,
                                      monthlyAllowance: monthly,
                                      maxPerRequest: max,
                                    );
                                _nameController.clear();
                              } catch (err) {
                                _handleError(err);
                              }
                            },
                      child: const Text('Create plan'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AppCard(
                child: Column(
                  children: [
                    if (state.plans.isEmpty)
                      const EmptyState(message: 'No plans match this filter.')
                    else
                      for (final plan in state.plans)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: PlanChip(plan: plan, showScope: true),
                          subtitle: Text(
                            plan.isPredefined
                                ? 'Read-only predefined plan'
                                : 'Tap to edit (applies to next request)',
                          ),
                          trailing: plan.isPredefined
                              ? null
                              : const Icon(Icons.edit_outlined),
                          onTap: () => _editPlan(plan),
                        ),
                    PaginationBar(
                      total: state.total,
                      limit: state.limit,
                      offset: state.offset,
                      onPrev: state.offset == 0
                          ? null
                          : () async {
                              try {
                                await context.read<PlansCubit>().load(
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
                                await context.read<PlansCubit>().load(
                                      offset: state.offset + state.limit,
                                    );
                              } catch (err) {
                                _handleError(err);
                              }
                            },
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
