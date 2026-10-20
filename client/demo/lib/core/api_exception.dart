class ApiException implements Exception {
  const ApiException(
    this.message, {
    this.code,
    this.status,
    this.details,
  });

  final String message;
  final String? code;
  final int? status;
  final Object? details;

  bool get isUnauthorized => status == 401 || code == 'UNAUTHORIZED';

  @override
  String toString() => message;
}
