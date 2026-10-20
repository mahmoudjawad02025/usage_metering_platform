import 'package:flutter/material.dart';

import '../theme.dart';

class PaginationBar extends StatelessWidget {
  const PaginationBar({
    super.key,
    required this.total,
    required this.limit,
    required this.offset,
    required this.onPrev,
    required this.onNext,
  });

  final int total;
  final int limit;
  final int offset;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    if (total == 0) return const SizedBox.shrink();
    final start = offset + 1;
    final end = (offset + limit).clamp(0, total);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Text('$start–$end of $total'),
          const Spacer(),
          IconButton(
            onPressed: onPrev,
            icon: const Icon(Icons.chevron_left),
            tooltip: 'Previous page',
          ),
          IconButton(
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right),
            tooltip: 'Next page',
          ),
        ],
      ),
    );
  }
}
