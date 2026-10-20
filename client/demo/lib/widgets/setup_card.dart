import 'package:flutter/material.dart';

class SetupCard extends StatefulWidget {
  const SetupCard({
    super.key,
    required this.busy,
    required this.onCreate,
  });

  final bool busy;
  final Future<void> Function(String adminKey) onCreate;

  @override
  State<SetupCard> createState() => _SetupCardState();
}

class _SetupCardState extends State<SetupCard> {
  final TextEditingController _adminKey = TextEditingController(
    text: 'change_me_to_a_long_random_admin_key',
  );

  @override
  void dispose() {
    _adminKey.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Create a demo account', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            TextField(
              controller: _adminKey,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Admin key',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: widget.busy
                  ? null
                  : () => widget.onCreate(_adminKey.text.trim()),
              child: const Text('Create demo account'),
            ),
            const SizedBox(height: 12),
            Text(
              'The admin key is used once and is not stored. Only the API key is kept in this browser.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
