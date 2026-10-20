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
import '../../../core/widgets/section_title.dart';
import '../../auth/auth_cubit.dart';
import '../history_cubit.dart';
import '../history_state.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const _HistoryView();
  }
}

class _HistoryView extends StatelessWidget {
  const _HistoryView();

  void _handleError(BuildContext context, Object err) {
    if (err is ApiException && err.isUnauthorized) {
      context.read<AuthCubit>().handleUnauthorized();
    }
  }

  String _userName(HistoryState state, String userId) {
    for (final user in state.users) {
      if (user.id == userId) return user.externalId;
    }
    return userId;
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<HistoryCubit, HistoryState>(
      builder: (context, state) {
        if (state.status == HistoryStatus.initial && state.items.isEmpty) {
          return const LoadingView(message: 'Loading history…');
        }

        return ContentConstraint(
          child: ListView(
            children: [
              const SectionTitle(
                'History',
                subtitle:
                    'Past decisions with the limits that applied at that time.',
              ),
              const SizedBox(height: AppSpacing.md),
              if (state.errorMessage != null) ...[
                ErrorBanner(
                  message: state.errorMessage!,
                  onRetry: () async {
                    try {
                      await context.read<HistoryCubit>().load();
                    } catch (err) {
                      _handleError(context, err);
                    }
                  },
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              AppCard(
                child: Column(
                  children: [
                    MonthPicker(
                      value: state.period,
                      onChanged: (period) async {
                        try {
                          await context
                              .read<HistoryCubit>()
                              .load(period: period, offset: 0);
                        } catch (err) {
                          _handleError(context, err);
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    DropdownButtonFormField<String?>(
                      // ignore: deprecated_member_use
                      value: state.userId,
                      decoration: const InputDecoration(labelText: 'User'),
                      items: [
                        const DropdownMenuItem(
                          value: null,
                          child: Text('All users'),
                        ),
                        for (final user in state.users)
                          DropdownMenuItem(
                            value: user.id,
                            child: Text(user.externalId),
                          ),
                      ],
                      onChanged: (value) async {
                        try {
                          if (value == null) {
                            await context
                                .read<HistoryCubit>()
                                .load(clearUser: true, offset: 0);
                          } else {
                            await context
                                .read<HistoryCubit>()
                                .load(userId: value, offset: 0);
                          }
                        } catch (err) {
                          _handleError(context, err);
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    DropdownButtonFormField<String>(
                      // ignore: deprecated_member_use
                      value: state.acceptedFilter == null
                          ? 'all'
                          : (state.acceptedFilter! ? 'accepted' : 'rejected'),
                      decoration: const InputDecoration(labelText: 'Outcome'),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('All')),
                        DropdownMenuItem(
                          value: 'accepted',
                          child: Text('Accepted'),
                        ),
                        DropdownMenuItem(
                          value: 'rejected',
                          child: Text('Rejected'),
                        ),
                      ],
                      onChanged: (value) async {
                        try {
                          if (value == 'all') {
                            await context
                                .read<HistoryCubit>()
                                .load(clearAccepted: true, offset: 0);
                          } else {
                            await context.read<HistoryCubit>().load(
                                  accepted: value == 'accepted',
                                  offset: 0,
                                );
                          }
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
                  children: [
                    if (state.items.isEmpty)
                      const EmptyState(message: 'No history for these filters.')
                    else
                      for (final item in state.items)
                        ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          leading: Icon(
                            item.accepted ? Icons.check_circle : Icons.cancel,
                            color: item.accepted ? Colors.green : Colors.red,
                          ),
                          title: Text(
                            '${item.units} units · ${_userName(state, item.userId)} · '
                            '${item.accepted ? 'accepted' : 'rejected'}',
                          ),
                          subtitle: Text(
                            item.rejection?.explanation ??
                                'Accepted · ${item.requestId}',
                          ),
                          children: [
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Padding(
                                padding: const EdgeInsets.only(
                                  bottom: AppSpacing.md,
                                ),
                                child: Text(
                                  'Applied limits\n'
                                  'Account: ${item.appliedLimits.account.planName} '
                                  '(${item.appliedLimits.account.monthlyAllowance}/mo, '
                                  '${item.appliedLimits.account.maxPerRequest}/req, '
                                  'consumed before ${item.appliedLimits.account.consumedBefore})\n'
                                  'User: ${item.appliedLimits.user.planName} '
                                  '(${item.appliedLimits.user.monthlyAllowance}/mo, '
                                  '${item.appliedLimits.user.maxPerRequest}/req, '
                                  'consumed before ${item.appliedLimits.user.consumedBefore})',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ),
                            ),
                          ],
                        ),
                    PaginationBar(
                      total: state.total,
                      limit: state.limit,
                      offset: state.offset,
                      onPrev: state.offset == 0
                          ? null
                          : () async {
                              try {
                                await context.read<HistoryCubit>().load(
                                      offset: (state.offset - state.limit)
                                          .clamp(0, state.total),
                                    );
                              } catch (err) {
                                _handleError(context, err);
                              }
                            },
                      onNext: state.offset + state.limit >= state.total
                          ? null
                          : () async {
                              try {
                                await context.read<HistoryCubit>().load(
                                      offset: state.offset + state.limit,
                                    );
                              } catch (err) {
                                _handleError(context, err);
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
