enum ScenarioStatus { idle, running, success, failure }

class ScenarioStepResult {
  const ScenarioStepResult({
    required this.label,
    required this.expected,
    required this.actual,
    required this.passed,
  });

  final String label;
  final String expected;
  final String actual;
  final bool passed;
}

class ScenarioRunState {
  const ScenarioRunState({
    required this.id,
    this.status = ScenarioStatus.idle,
    this.steps = const [],
    this.errorMessage,
  });

  final int id;
  final ScenarioStatus status;
  final List<ScenarioStepResult> steps;
  final String? errorMessage;

  ScenarioRunState copyWith({
    ScenarioStatus? status,
    List<ScenarioStepResult>? steps,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ScenarioRunState(
      id: id,
      status: status ?? this.status,
      steps: steps ?? this.steps,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class ScenariosState {
  const ScenariosState({this.runs = const {}});

  final Map<int, ScenarioRunState> runs;

  ScenarioRunState runFor(int id) =>
      runs[id] ?? ScenarioRunState(id: id);

  ScenariosState withRun(ScenarioRunState run) {
    return ScenariosState(runs: {...runs, run.id: run});
  }
}

class ScenarioDefinition {
  const ScenarioDefinition({
    required this.id,
    required this.title,
    required this.description,
  });

  final int id;
  final String title;
  final String description;
}

const scenarioDefinitions = [
  ScenarioDefinition(
    id: 1,
    title: 'Accepted action',
    description: 'A user within limits processes a small request successfully.',
  ),
  ScenarioDefinition(
    id: 2,
    title: 'Rejected by a user limit',
    description: 'Units above the user per-request max are rejected.',
  ),
  ScenarioDefinition(
    id: 3,
    title: 'Rejected by the shared account limit',
    description:
        'Uses a small account plan so the shared monthly allowance blocks the request.',
  ),
  ScenarioDefinition(
    id: 4,
    title: 'Switch a plan, same request succeeds',
    description:
        'After upgrading the user plan, the same units are accepted — no client code change.',
  ),
  ScenarioDefinition(
    id: 5,
    title: 'Edit a custom plan',
    description:
        'Raising maxPerRequest on a custom plan applies to the next request.',
  ),
  ScenarioDefinition(
    id: 6,
    title: 'Lower allowance below usage',
    description: 'Remaining shows 0 and further requests are rejected.',
  ),
  ScenarioDefinition(
    id: 7,
    title: 'Idempotent retry',
    description:
        'Same requestId twice → replayed:true, counted once; different units → 409.',
  ),
];
