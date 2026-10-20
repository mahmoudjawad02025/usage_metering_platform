import 'package:flutter_test/flutter_test.dart';
import 'package:usage_metering_demo/core/models.dart';
import 'package:usage_metering_demo/features/consume/consume_cubit.dart';
import 'package:usage_metering_demo/features/consume/consume_state.dart';

import 'fakes.dart';

void main() {
  late FakeConsumeRepository repo;
  late ConsumeCubit cubit;

  setUp(() async {
    repo = FakeConsumeRepository();
    cubit = ConsumeCubit(repo);
    await cubit.load();
  });

  tearDown(() async {
    await cubit.close();
  });

  test('processDocument accepted path', () async {
    repo.nextResult = fakeConsume(accepted: true, replayed: false, userConsumed: 10);
    await cubit.processDocument(requestId: 'r1');
    expect(cubit.state.status, ConsumeStatus.success);
    expect(cubit.state.lastResult?.accepted, isTrue);
    expect(cubit.state.lastResult?.replayed, isFalse);
  });

  test('processDocument rejected path', () async {
    repo.nextResult = fakeConsume(
      accepted: false,
      units: 25,
      rejection: const Rejection(
        rule: 'max_per_request',
        level: 'user',
        limit: 20,
      ),
      userConsumed: 0,
    );
    await cubit.processDocument(requestId: 'r2');
    expect(cubit.state.lastResult?.accepted, isFalse);
    expect(cubit.state.lastResult?.rejection?.level, 'user');
  });

  test('retryLast replays same requestId', () async {
    repo.nextResult = fakeConsume(requestId: 'same', units: 10, userConsumed: 10);
    await cubit.processDocument(requestId: 'same');
    await cubit.retryLast();
    expect(cubit.state.lastResult?.replayed, isTrue);
    expect(cubit.state.lastResult?.user.consumed, 10);
    expect(repo.calls.where((c) => c['requestId'] == 'same').length, 2);
  });
}
