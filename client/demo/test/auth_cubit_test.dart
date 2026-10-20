import 'package:flutter_test/flutter_test.dart';
import 'package:usage_metering_demo/features/auth/auth_cubit.dart';
import 'package:usage_metering_demo/features/auth/auth_state.dart';

import 'fakes.dart';

void main() {
  late FakeAuthRepository repo;
  late AuthCubit cubit;

  setUp(() {
    repo = FakeAuthRepository();
    cubit = AuthCubit(repo);
  });

  tearDown(() async {
    await cubit.close();
  });

  test('startDemo authenticates', () async {
    await cubit.startDemo();
    expect(cubit.state.status, AuthStatus.authenticated);
    expect(cubit.state.accountName, 'Demo Acme');
  });

  test('signIn with valid key authenticates', () async {
    await cubit.signIn('umk_good');
    expect(cubit.state.status, AuthStatus.authenticated);
    expect(repo.lastApiKey, 'umk_good');
  });

  test('signIn with bad key fails', () async {
    await cubit.signIn('bad');
    expect(cubit.state.status, AuthStatus.unauthenticated);
    expect(cubit.state.errorMessage, contains('Invalid'));
  });

  test('handleUnauthorized returns to sign-in', () {
    cubit.handleUnauthorized();
    expect(cubit.state.status, AuthStatus.unauthenticated);
    expect(cubit.state.errorMessage, contains('Session expired'));
  });

  test('signUp exposes one-time API key', () async {
    await cubit.signUp(name: 'New Co');
    expect(cubit.state.isAuthenticated, isTrue);
    expect(cubit.state.oneTimeApiKey, 'umk_once');
  });
}
