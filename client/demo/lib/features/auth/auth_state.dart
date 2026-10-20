import '../../core/models.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated, failure }

class AuthState {
  const AuthState({
    this.status = AuthStatus.initial,
    this.accountName,
    this.oneTimeApiKey,
    this.errorMessage,
  });

  final AuthStatus status;
  final String? accountName;
  final String? oneTimeApiKey;
  final String? errorMessage;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    String? accountName,
    String? oneTimeApiKey,
    String? errorMessage,
    bool clearApiKey = false,
    bool clearError = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      accountName: accountName ?? this.accountName,
      oneTimeApiKey: clearApiKey ? null : (oneTimeApiKey ?? this.oneTimeApiKey),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

// Keep AccountDto import used for clarity in repository return types.
typedef AuthAccount = AccountDto;
