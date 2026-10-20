import 'package:flutter/material.dart';

import '../../../core/widgets/empty_state.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(
      message: 'History loading…',
      icon: Icons.history,
    );
  }
}
