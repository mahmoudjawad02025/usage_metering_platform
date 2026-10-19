import 'package:flutter/material.dart';
class ChoiceDropdown extends StatelessWidget {
  const ChoiceDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });
  final String label;
  final String? value;
  final Map<String, String> options;
  final ValueChanged<String>? onChanged;
  @override
  Widget build(BuildContext context) {
    final callback = onChanged;
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          value: options.containsKey(value) ? value : null,
          items: [
            for (final entry in options.entries)
              DropdownMenuItem<String>(
                value: entry.key,
                child: Text(entry.value, overflow: TextOverflow.ellipsis),
              ),
          ],
          onChanged: callback == null
              ? null
              : (selected) {
                  if (selected != null) callback(selected);
                },
        ),
      ),
    );
  }
}