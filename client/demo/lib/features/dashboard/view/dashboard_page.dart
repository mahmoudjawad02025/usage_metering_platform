import 'package:flutter/material.dart';

import '../../../core/widgets/empty_state.dart';

/// Filled in step 4.
class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(
      message: 'Dashboard loading…',
      icon: Icons.dashboard_outlined,
    );
  }
}
