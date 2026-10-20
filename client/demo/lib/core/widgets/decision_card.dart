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
    final accepted = result.accepted;
    final color = accepted ? Colors.green : Colors.red;
    final who = userName ?? 'user';
    final title = accepted
        ? 'Accepted: ${result.units} units for $who'
        : 'Rejected: ${result.units} units for $who';

    return AppCard(
      color: color.shade50,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                accepted ? Icons.check_circle : Icons.cancel,
                color: color.shade700,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ),
              if (result.replayed) const Chip(label: Text('replayed')),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(_message()),
          const Divider(height: 24),
          UsageBar(label: 'Account (${result.account.plan.name})', usage: result.account, dense: true),
          const SizedBox(height: AppSpacing.sm),
          UsageBar(label: 'User (${result.user.plan.name})', usage: result.user, dense: true),
        ],
      ),
    );
  }
}
