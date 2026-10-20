import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'api_client.dart';
import 'models.dart';
import 'widgets/choice_dropdown.dart';
import 'widgets/decision_card.dart';
import 'widgets/usage_panel.dart';
class DemoPage extends StatefulWidget {
  const DemoPage({super.key});
  @override
  State<DemoPage> createState() => _DemoPageState();
}
class _DemoPageState extends State<DemoPage> {
  final DemoApi _api = DemoApi();
  final TextEditingController _units = TextEditingController(text: '10');
  StatusSnapshot? _status;
  String? _selectedUserId;
  ProcessResult? _lastResult;
  ({String userId, int units, String requestId})? _lastRequest;
  final List<ProcessResult> _log = [];
  bool _busy = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    Future.microtask(() => _run(_refresh));
  }
  @override
  void dispose() {
    _units.dispose();
    super.dispose();
  }
  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    String? error;
    try {
      await action();
    } on ApiException catch (e) {
      error = e.message;
    } catch (_) {
      error = 'Something went wrong. Please try again.';
    }
    if (!mounted) return;
    setState(() {
      _busy = false;
      _error = error;
    });
  }
  Future<void> _refresh() async {
    final status = await _api.getStatus();
    if (!mounted) return;
    setState(() {
      _status = status;
      final stillThere = status.users.any((user) => user.id == _selectedUserId);
      if (!stillThere) {
        _selectedUserId = status.users.isEmpty ? null : status.users.first.id;
      }
    });
  }
  Future<void> _process() async {
    final userId = _selectedUserId;
    final units = int.tryParse(_units.text.trim());
    if (userId == null || units == null || units < 1) {
      setState(() => _error = 'Enter a whole number of units (1 or more).');
      return;
    }
    await _submit(
      userId: userId,
      units: units,
      requestId: 'doc-${DateTime.now().microsecondsSinceEpoch}',
    );
  }
  Future<void> _retry() async {
    final last = _lastRequest;
    if (last == null) return;
    await _submit(userId: last.userId, units: last.units, requestId: last.requestId);
  }
  Future<void> _submit({
    required String userId,
    required int units,
    required String requestId,
  }) {
    return _run(() async {
      final result = await _api.processDocument(userId: userId, units: units, requestId: requestId);
      if (!mounted) return;
      setState(() {
        _lastRequest = (userId: userId, units: units, requestId: requestId);
        _lastResult = result;
        _log.insert(0, result);
        if (_log.length > 6) _log.removeLast();
      });
      await _refresh();
    });
  }
  Future<void> _changeUserPlan(String userId, String planId) {
    return _run(() async {
      await _api.changeUserPlan(userId, planId);
      await _refresh();
    });
  }
  Future<void> _changeAccountPlan(String planId) {
    return _run(() async {
      await _api.changeAccountPlan(planId);
      await _refresh();
    });
  }
  Future<void> _reset() {
    return _run(() async {
      await _api.resetDemo();
      if (!mounted) return;
      setState(() {
        _lastResult = null;
        _lastRequest = null;
        _log.clear();
        _selectedUserId = null;
      });
      await _refresh();
    });
  }
  String _nameOf(StatusSnapshot status, String userId) {
    for (final user in status.users) {
      if (user.id == userId) return user.externalId;
    }
    return 'user';
  }
  Widget _processCard(StatusSnapshot status) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Process a document', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            ChoiceDropdown(
              label: 'User',
              value: _selectedUserId,
              options: {
                for (final user in status.users) user.id: '${user.externalId} · ${user.usage.plan.name}',
              },
              onChanged: _busy ? null : (id) => setState(() => _selectedUserId = id),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _units,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: 'Units (the cost of this document)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                for (final amount in [10, 25, 50])
                  ActionChip(label: Text('$amount units'), onPressed: () => _units.text = '$amount'),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: _busy || _selectedUserId == null ? null : _process,
                  icon: const Icon(Icons.description),
                  label: const Text('Process document'),
                ),
                OutlinedButton(
                  onPressed: _busy || _lastRequest == null ? null : _retry,
                  child: const Text('Retry last request'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
  Widget _recentCard(StatusSnapshot status) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Earlier decisions', style: Theme.of(context).textTheme.titleMedium),
            for (final entry in _log.skip(1))
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  entry.decision.accepted ? Icons.check_circle : Icons.cancel,
                  color: entry.decision.accepted ? Colors.green : Colors.red,
                ),
                title: Text('${_nameOf(status, entry.decision.userId)} · ${entry.decision.units} units'),
                subtitle: Text(
                  entry.decision.accepted ? 'accepted' : (entry.decision.rejection?.explanation ?? 'rejected'),
                ),
              ),
          ],
        ),
      ),
    );
  }
  @override
  Widget build(BuildContext context) {
    final status = _status;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Document processing demo'),
        actions: [
          IconButton(
            tooltip: 'Start over with a fresh demo account',
            onPressed: _busy ? null : _reset,
            icon: const Icon(Icons.restart_alt),
          ),
        ],
        bottom: _busy
            ? const PreferredSize(
                preferredSize: Size.fromHeight(3),
                child: LinearProgressIndicator(),
              )
            : null,
      ),
      body: status == null
          ? Center(
              child: _error == null
                  ? const CircularProgressIndicator()
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: _busy ? null : () => _run(_refresh),
                          child: const Text('Try again'),
                        ),
                      ],
                    ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1100),
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final wide = constraints.maxWidth >= 900;
                      final cardWidth = wide ? (constraints.maxWidth - 16) / 2 : constraints.maxWidth;
                      final result = _lastResult;
                      return Wrap(
                        spacing: 16,
                        runSpacing: 16,
                        crossAxisAlignment: WrapCrossAlignment.start,
                        children: [
                          SizedBox(
                            width: cardWidth,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _processCard(status),
                                if (_error != null)
                                  Card(
                                    color: Colors.red.shade50,
                                    child: Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Text(_error!),
                                    ),
                                  ),
                                if (result != null)
                                  DecisionCard(
                                    result: result,
                                    userName: _nameOf(status, result.decision.userId),
                                  ),
                                if (_log.length > 1) _recentCard(status),
                              ],
                            ),
                          ),
                          SizedBox(
                            width: cardWidth,
                            child: UsagePanel(
                              status: status,
                              busy: _busy,
                              onAccountPlanChanged: _changeAccountPlan,
                              onUserPlanChanged: _changeUserPlan,
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            ),
    );
  }
}