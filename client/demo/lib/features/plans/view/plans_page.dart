import 'package:flutter/material.dart';

import '../../../core/widgets/empty_state.dart';

class PlansPage extends StatelessWidget {
  const PlansPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(message: 'Plans loading…', icon: Icons.list_alt);
  }
}
