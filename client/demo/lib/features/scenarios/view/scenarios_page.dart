import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/feature_refresh.dart';
import '../../../core/layout.dart';
import '../../../core/theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/error_banner.dart';
import '../../../core/widgets/section_title.dart';
import '../scenarios_cubit.dart';
import '../scenarios_state.dart';

class ScenariosPage extends StatelessWidget {
  const ScenariosPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocListener<ScenariosCubit, ScenariosState>(
      listenWhen: (previous, current) {
        for (final def in scenarioDefinitions) {
          final before = previous.runFor(def.id).status;
          final after = current.runFor(def.id).status;
          if (before == ScenarioStatus.running &&
              (after == ScenarioStatus.success ||
                  after == ScenarioStatus.failure)) {
            return true;
          }
        }
        return false;
      },
      listener: (context, state) {
        refreshAfterScenarioRun(context);
      },
      child: const _ScenariosView(),
    );
  }
}

class _ScenariosView extends StatelessWidget {
  const _ScenariosView();

  @override
  Widget build(BuildContext context) {
    return ContentConstraint(
      child: ListView(
        children: [
          const SectionTitle(
            'Scenarios',
            subtitle:
                'Guided scripts that exercise the metering rules on your signed-in account. '
                'Each scenario reuses stable helper users/plans (scenario-1, …) so re-runs '
                'do not flood the database. History rows still accumulate; wipe with '
                'docker compose down -v when you want a clean slate.',
          ),
          const SizedBox(height: AppSpacing.md),
          for (final def in scenarioDefinitions) ...[
            _ScenarioCard(definition: def),
            const SizedBox(height: AppSpacing.md),
          ],
        ],
      ),
    );
  }
}

class _ScenarioCard extends StatelessWidget {
  const _ScenarioCard({required this.definition});

  final ScenarioDefinition definition;

  @override
  Widget build(BuildContext context) {
    final run = context.watch<ScenariosCubit>().state.runFor(definition.id);
    final running = run.status == ScenarioStatus.running;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(child: Text('${definition.id}')),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      definition.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(definition.description),
                  ],
                ),
              ),
              FilledButton(
                onPressed: running
                    ? null
                    : () => context.read<ScenariosCubit>().run(definition.id),
                child: Text(running ? 'Running…' : 'Run'),
              ),
            ],
          ),
          if (run.errorMessage != null) ...[
            const SizedBox(height: AppSpacing.sm),
            ErrorBanner(message: run.errorMessage!),
          ],
          if (run.steps.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            for (final step in run.steps)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: Icon(
                  step.passed ? Icons.check_circle : Icons.cancel,
                  color: step.passed ? Colors.green : Colors.red,
                ),
                title: Text(step.label),
                subtitle: Text(
                  'Expected: ${step.expected}\nActual: ${step.actual}',
                ),
                isThreeLine: true,
              ),
          ],
          if (run.status == ScenarioStatus.success)
            const Padding(
              padding: EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                'All steps passed.',
                style: TextStyle(
                  color: Colors.green,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
