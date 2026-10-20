import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/api_exception.dart';
import 'auth_repository.dart';
import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  AuthCubit(this._repository) : super(const AuthState());

  final AuthRepository _repository;

  Future<void> bootstrap() async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true));
    try {
      final session = await _repository.getSession();
      if (session.authenticated) {
        emit(AuthState(
          status: AuthStatus.authenticated,
          accountName: session.accountName,
        ));
      } else {
        emit(const AuthState(status: AuthStatus.unauthenticated));
      }
    } catch (err) {
      emit(AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: _message(err),
      ));
    }
  }

  Future<void> startDemo({bool fresh = false}) async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true, clearApiKey: true));
    try {
      final account = await _repository.startDemo(fresh: fresh);
      emit(AuthState(
        status: AuthStatus.authenticated,
        accountName: account.name,
      ));
    } catch (err) {
      emit(AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: _message(err),
      ));
    }
  }

  Future<void> signIn(String apiKey) async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true, clearApiKey: true));
    try {
      final account = await _repository.signIn(apiKey.trim());
      emit(AuthState(
        status: AuthStatus.authenticated,
        accountName: account.name,
      ));
    } catch (err) {
      emit(AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: _message(err),
      ));
    }
  }

  Future<void> signUp({required String name, String? planName}) async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true, clearApiKey: true));
    try {
      final result = await _repository.signUp(name: name.trim(), planName: planName);
      emit(AuthState(
        status: AuthStatus.authenticated,
        accountName: result.account.name,
        oneTimeApiKey: result.apiKey,
      ));
    } catch (err) {
      emit(AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: _message(err),
      ));
    }
  }

  Future<void> signOut() async {
    try {
      await _repository.signOut();
    } catch (_) {
      // Still clear local auth state.
    }
    emit(const AuthState(status: AuthStatus.unauthenticated));
  }

  void clearOneTimeApiKey() {
    emit(state.copyWith(clearApiKey: true));
  }

  void handleUnauthorized() {
    emit(const AuthState(
      status: AuthStatus.unauthenticated,
      errorMessage: 'Session expired. Please sign in again.',
    ));
  }

  String _message(Object err) {
    if (err is ApiException) return err.message;
    return 'Something went wrong.';
  }
}
