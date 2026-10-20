import 'package:flutter/material.dart';

import '../../../core/widgets/empty_state.dart';

class UsersPage extends StatelessWidget {
  const UsersPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(message: 'Users loading…', icon: Icons.people_outline);
  }
}
