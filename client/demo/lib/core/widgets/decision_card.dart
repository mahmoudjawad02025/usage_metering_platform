import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';
import 'app_card.dart';
import 'usage_bar.dart';

class DecisionCard extends StatelessWidget {
  const DecisionCard({
    super.key,
    required this.result,
    this.userName,
  });

  final ConsumeResult result;
  final String? userName;

  String _message() {
    if (result.accepted) {
      if (result.replayed) {
        return 'Replayed: the stored decision was returned and nothing was counted again.';
      }
      return 'Accepted. The simulated document was processed.';
    }
    return result.rejection?.explanation ?? 'Rejected.';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final accepted = result.accepted;
    final statusColor = accepted ? scheme.primary : scheme.error;
    final who = userName ?? 'user';
    final title = accepted
        ? 'Accepted: ${result.units} units for $who'
        : 'Rejected: ${result.units} units for $who';

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                accepted ? Icons.check_circle : Icons.cancel,
                color: statusColor,
                size: 28,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: scheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _message(),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              if (result.replayed) ...[
                const SizedBox(width: AppSpacing.xs),
                Chip(
                  label: const Text('replayed'),
                  visualDensity: VisualDensity.compact,
                  side: BorderSide(color: scheme.outlineVariant),
                  backgroundColor: scheme.surfaceContainerHighest,
                  labelStyle: theme.textTheme.labelMedium?.copyWith(
                    color: scheme.onSurface,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Divider(height: 1, color: scheme.outlineVariant),
          const SizedBox(height: AppSpacing.md),
          UsageBar(
            label: 'Account (${result.account.plan.name})',
            usage: result.account,
            dense: true,
          ),
          const SizedBox(height: AppSpacing.sm),
          UsageBar(
            label: 'User (${result.user.plan.name})',
            usage: result.user,
            dense: true,
          ),
        ],
      ),
    );
  }
}
