import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/api_exception.dart';
import '../../../core/layout.dart';
import '../../../core/theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/decision_card.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_banner.dart';
import '../../../core/widgets/loading_view.dart';
import '../../../core/widgets/section_title.dart';
import '../../auth/auth_cubit.dart';
import '../consume_cubit.dart';
import '../consume_repository.dart';
import '../consume_state.dart';

class ConsumePage extends StatelessWidget {
  const ConsumePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) =>
          ConsumeCubit(context.read<ConsumeRepository>())..load(),
      child: const _ConsumeView(),
    );
  }
}

class _ConsumeView extends StatefulWidget {
  const _ConsumeView();

  @override
  State<_ConsumeView> createState() => _ConsumeViewState();
}

class _ConsumeViewState extends State<_ConsumeView> {
  late final TextEditingController _unitsController;

  @override
  void initState() {
    super.initState();
    _unitsController = TextEditingController(text: '10');
  }

  @override
  void dispose() {
    _unitsController.dispose();
    super.dispose();
  }

  void _handleError(Object err) {
    if (err is ApiException && err.isUnauthorized) {
      context.read<AuthCubit>().handleUnauthorized();
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ConsumeCubit, ConsumeState>(
      listener: (context, state) {
        if (_unitsController.text != '${state.units}') {
          _unitsController.text = '${state.units}';
        }
      },
      builder: (context, state) {
        if (state.status == ConsumeStatus.initial && state.users.isEmpty) {
          return const LoadingView(message: 'Loading consume playground…');
        }

        return ContentConstraint(
          child: ListView(
            children: [
              const SectionTitle(
                'Consume',
                subtitle:
                    'Simulate processing a document. Only newly accepted requests run the simulated work.',
              ),
              const SizedBox(height: AppSpacing.md),
              if (state.errorMessage != null) ...[
                ErrorBanner(message: state.errorMessage!),
                const SizedBox(height: AppSpacing.md),
              ],
              ResponsiveTwoColumn(
                left: AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (state.users.isEmpty)
                        const EmptyState(message: 'Register a user first.')
                      else ...[
                        DropdownButtonFormField<String>(
                          // ignore: deprecated_member_use
                          value: state.selectedUserId,
                          decoration: const InputDecoration(labelText: 'User'),
                          items: [
                            for (final user in state.users)
                              DropdownMenuItem(
                                value: user.id,
                                child: Text(
                                  '${user.externalId} (${user.plan.name})',
                                ),
                              ),
                          ],
                          onChanged: state.processing
                              ? null
                              : (value) {
                                  if (value != null) {
                                    context
                                        .read<ConsumeCubit>()
                                        .selectUser(value);
                                  }
                                },
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        TextField(
                          controller: _unitsController,
                          decoration: const InputDecoration(labelText: 'Units'),
                          keyboardType: TextInputType.number,
                          onChanged: (value) {
                            final units = int.tryParse(value);
                            if (units != null && units > 0) {
                              context.read<ConsumeCubit>().setUnits(units);
                            }
                          },
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: AppSpacing.xs,
                          children: [
                            for (final chip in const [10, 25, 50])
                              ActionChip(
                                label: Text('$chip'),
                                onPressed: state.processing
                                    ? null
                                    : () {
                                        context
                                            .read<ConsumeCubit>()
                                            .setUnits(chip);
                                        _unitsController.text = '$chip';
                                      },
                              ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        FilledButton.icon(
                          onPressed: state.processing
                              ? null
                              : () async {
                                  try {
                                    await context
                                        .read<ConsumeCubit>()
                                        .processDocument();
                                  } catch (err) {
                                    _handleError(err);
                                  }
                                },
                          icon: state.processing
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.description_outlined),
                          label: Text(
                            state.processing
                                ? 'Processing…'
                                : 'Process document',
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        OutlinedButton.icon(
                          onPressed: state.processing ||
                                  state.lastRequestId == null
                              ? null
                              : () async {
                                  try {
                                    await context
                                        .read<ConsumeCubit>()
                                        .retryLast();
                                  } catch (err) {
                                    _handleError(err);
                                  }
                                },
                          icon: const Icon(Icons.replay),
                          label: const Text('Retry last request'),
                        ),
                      ],
                    ],
                  ),
                ),
                right: Column(
                  children: [
                    if (state.lastResult != null)
                      DecisionCard(
                        result: state.lastResult!,
                        userName: state.selectedUserName,
                      )
                    else
                      const AppCard(
                        child: EmptyState(
                          message: 'Process a document to see the decision.',
                          icon: Icons.bolt_outlined,
                        ),
                      ),
                    const SizedBox(height: AppSpacing.md),
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Recent decisions',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          if (state.recent.isEmpty)
                            const Text('No decisions yet.')
                          else
                            for (final item in state.recent)
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                dense: true,
                                leading: Icon(
                                  item.accepted
                                      ? Icons.check_circle
                                      : Icons.cancel,
                                  color: item.accepted
                                      ? Colors.green
                                      : Colors.red,
                                ),
                                title: Text(
                                  '${item.units} units · ${item.accepted ? 'accepted' : 'rejected'}'
                                  '${item.replayed ? ' (replayed)' : ''}',
                                ),
                                subtitle: Text(
                                  item.rejection?.explanation ??
                                      item.requestId,
                                ),
                              ),
                        ],
                      ),
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
