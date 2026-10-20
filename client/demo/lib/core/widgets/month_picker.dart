import 'package:flutter/material.dart';

String currentUtcMonth() {
  final now = DateTime.now().toUtc();
  return '${now.year.toString().padLeft(4, '0')}-'
      '${now.month.toString().padLeft(2, '0')}';
}

List<String> recentUtcMonths({int count = 6}) {
  final now = DateTime.now().toUtc();
  return List.generate(count, (index) {
    final date = DateTime.utc(now.year, now.month - index, 1);
    return '${date.year.toString().padLeft(4, '0')}-'
        '${date.month.toString().padLeft(2, '0')}';
  });
}

class MonthPicker extends StatelessWidget {
  const MonthPicker({
    super.key,
    required this.value,
    required this.onChanged,
    this.months,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final List<String>? months;

  @override
  Widget build(BuildContext context) {
    final options = months ?? recentUtcMonths();
    return DropdownButtonFormField<String>(
      // ignore: deprecated_member_use
      value: options.contains(value) ? value : options.first,
      decoration: const InputDecoration(labelText: 'Month (UTC)'),
      items: [
        for (final month in options)
          DropdownMenuItem(value: month, child: Text(month)),
      ],
      onChanged: (next) {
        if (next != null) onChanged(next);
      },
    );
  }
}
