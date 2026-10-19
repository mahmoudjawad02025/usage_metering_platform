import 'package:flutter/material.dart';
import '../models.dart';
import 'choice_dropdown.dart';
class UsagePanel extends StatelessWidget {
  const UsagePanel({
    super.key,
    required this.status,
    required this.busy,
    required this.onAccountPlanChanged,
    required this.onUserPlanChanged,
  });
  final StatusSnapshot status;
  final bool busy;
  final ValueChanged<String> onAccountPlanChanged;
  final void Function(String userId, String planId) onUserPlanChanged;
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Usage in ${status.period} (UTC)', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            _LevelRow(
              title: 'Account: ${status.accountName}',
              usage: status.account,
              plans: status.accountPlans,
              onChanged: busy ? null : onAccountPlanChanged,
            ),
            const Divider(height: 24),
            for (final user in status.users) ...[
              _LevelRow(
                title: user.externalId,
                usage: user.usage,
                plans: status.userPlans,
                onChanged: busy ? null : (planId) => onUserPlanChanged(user.id, planId),
              ),
              const SizedBox(height: 16),
            ],
          ],
        ),
      ),
    );
  }
}
class _LevelRow extends StatelessWidget {
  const _LevelRow({
    required this.title,
    required this.usage,
    required this.plans,
    required this.onChanged,
  });
  final String title;
  final LevelUsage usage;
  final List<PlanInfo> plans;
  final ValueChanged<String>? onChanged;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ChoiceDropdown(
          label: 'Plan',
          value: usage.plan.id,
          options: {for (final plan in plans) plan.id: plan.label},
          onChanged: onChanged,
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(value: usage.fractionUsed, minHeight: 8),
        const SizedBox(height: 4),
        Text(
          '${usage.consumed} used · ${usage.remaining} remaining of ${usage.plan.monthlyAllowance} '
          '(max ${usage.plan.maxPerRequest} per request)',
        ),
      ],
    );
  }
}