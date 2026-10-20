import 'package:flutter/material.dart';

import '../models.dart';

class PlanChip extends StatelessWidget {
  const PlanChip({super.key, required this.plan, this.showScope = false});

  final PlanDto plan;
  final bool showScope;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(
          plan.name,
          style: Theme.of(context).textTheme.titleSmall,
        ),
        if (showScope)
          Chip(
            label: Text(plan.scope),
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
          ),
        if (plan.isPredefined)
          const Chip(
            label: Text('predefined'),
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
          ),
        Text(
          '${plan.monthlyAllowance}/mo · ${plan.maxPerRequest}/req',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}
