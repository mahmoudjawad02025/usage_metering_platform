import 'package:flutter/material.dart';

import '../../../core/widgets/empty_state.dart';

class ScenariosPage extends StatelessWidget {
  const ScenariosPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(
      message: 'Scenarios loading…',
      icon: Icons.science_outlined,
    );
  }
}
