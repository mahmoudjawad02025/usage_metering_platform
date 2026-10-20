import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';

class UsageBar extends StatelessWidget {
  const UsageBar({
    super.key,
    required this.label,
    required this.usage,
    this.dense = false,
  });

  final String label;
  final LevelUsage usage;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final limit = usage.plan.monthlyAllowance;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: dense
                    ? theme.textTheme.bodyMedium
                    : theme.textTheme.titleSmall,
              ),
            ),
            Text(
              '${usage.consumed} used · ${usage.remaining} left'
              '${limit > 0 ? ' / $limit' : ''}',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: usage.fractionUsed,
            minHeight: dense ? 6 : 10,
          ),
        ),
      ],
    );
  }
}
