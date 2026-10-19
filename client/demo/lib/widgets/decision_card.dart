import 'package:flutter/material.dart';
import '../models.dart';
class DecisionCard extends StatelessWidget {
  const DecisionCard({super.key, required this.result, required this.userName});
  final ProcessResult result;
  final String userName;
  String _message() {
    final decision = result.decision;
    final base = decision.accepted
        ? (result.processed
            ? 'The document was processed (simulated).'
            : 'The document was not processed again.')
        : (decision.rejection?.explanation ?? 'Rejected.');
    if (!decision.replayed) return base;
    return '$base Replayed: the stored decision was returned and nothing was counted again.';
  }
  Widget _usageLine(String label, LevelUsage usage) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text('$label (${usage.plan.name})')),
          Text('${usage.consumed} used · ${usage.remaining} remaining'),
        ],
      ),
    );
  }
  @override
  Widget build(BuildContext context) {
    final decision = result.decision;
    final accepted = decision.accepted;
    final color = accepted ? Colors.green : Colors.red;
    final title = accepted
        ? 'Accepted: ${decision.units} units for $userName'
        : 'Rejected: ${decision.units} units for $userName';
    return Card(
      color: color.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(accepted ? Icons.check_circle : Icons.cancel, color: color.shade700),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                ),
                if (decision.replayed) const Chip(label: Text('replayed')),
              ],
            ),
            const SizedBox(height: 8),
            Text(_message()),
            const Divider(height: 24),
            _usageLine('Account', decision.account),
            _usageLine('User', decision.user),
          ],
        ),
      ),
    );
  }
}