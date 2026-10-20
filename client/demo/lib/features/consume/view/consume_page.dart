import 'package:flutter/material.dart';

import '../../../core/widgets/empty_state.dart';

class ConsumePage extends StatelessWidget {
  const ConsumePage({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(
      message: 'Consume playground loading…',
      icon: Icons.bolt_outlined,
    );
  }
}
