import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/layout.dart';
import '../../../core/theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/error_banner.dart';
import '../../../core/widgets/section_title.dart';
import '../auth_cubit.dart';
import '../auth_state.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _signInKey = GlobalKey<FormState>();
  final _signUpKey = GlobalKey<FormState>();
  final _apiKeyController = TextEditingController();
  final _nameController = TextEditingController();
  String? _planName;

  @override
  void dispose() {
    _apiKeyController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ContentConstraint(
        child: BlocBuilder<AuthCubit, AuthState>(
          builder: (context, state) {
            final busy = state.status == AuthStatus.loading ||
                state.status == AuthStatus.initial;
            return ListView(
              children: [
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Usage Metering Demo',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Explore quotas, plans, and consumption through a small document-processing app.',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: AppSpacing.lg),
                if (state.errorMessage != null) ...[
                  ErrorBanner(message: state.errorMessage!),
                  const SizedBox(height: AppSpacing.md),
                ],
                if (state.oneTimeApiKey != null) ...[
                  _ApiKeyOnceNotice(
                    apiKey: state.oneTimeApiKey!,
                    onContinue: () =>
                        context.read<AuthCubit>().clearOneTimeApiKey(),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                ResponsiveTwoColumn(
                  left: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SectionTitle(
                          'Try the demo',
                          subtitle:
                              'One click creates (or reuses) a demo account with Alice and Bob.',
                        ),
                        const SizedBox(height: AppSpacing.md),
                        FilledButton.icon(
                          onPressed: busy
                              ? null
                              : () => context.read<AuthCubit>().startDemo(),
                          icon: const Icon(Icons.play_arrow),
                          label: const Text('Start demo'),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        OutlinedButton(
                          onPressed: busy
                              ? null
                              : () => context
                                  .read<AuthCubit>()
                                  .startDemo(fresh: true),
                          child: const Text('Fresh demo account'),
                        ),
                      ],
                    ),
                  ),
                  right: AppCard(
                    child: Form(
                      key: _signInKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SectionTitle(
                            'Sign in',
                            subtitle: 'Paste an API key from a previous sign-up.',
                          ),
                          const SizedBox(height: AppSpacing.md),
                          TextFormField(
                            controller: _apiKeyController,
                            decoration: const InputDecoration(
                              labelText: 'API key',
                            ),
                            obscureText: true,
                            validator: (value) =>
                                (value == null || value.trim().isEmpty)
                                    ? 'API key is required'
                                    : null,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          FilledButton(
                            onPressed: busy
                                ? null
                                : () {
                                    if (!_signInKey.currentState!.validate()) {
                                      return;
                                    }
                                    context
                                        .read<AuthCubit>()
                                        .signIn(_apiKeyController.text);
                                  },
                            child: const Text('Sign in'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                AppCard(
                  child: Form(
                    key: _signUpKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SectionTitle(
                          'Create account',
                          subtitle:
                              'The API key is shown once after sign-up. Copy it now.',
                        ),
                        const SizedBox(height: AppSpacing.md),
                        TextFormField(
                          controller: _nameController,
                          decoration: const InputDecoration(
                            labelText: 'Account name',
                          ),
                          validator: (value) =>
                              (value == null || value.trim().isEmpty)
                                  ? 'Name is required'
                                  : null,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        DropdownButtonFormField<String?>(
                          // ignore: deprecated_member_use
                          value: _planName,
                          decoration: const InputDecoration(
                            labelText: 'Account plan (optional)',
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: null,
                              child: Text('Starter (default)'),
                            ),
                            DropdownMenuItem(
                              value: 'Starter',
                              child: Text('Starter'),
                            ),
                            DropdownMenuItem(
                              value: 'Pro',
                              child: Text('Pro'),
                            ),
                          ],
                          onChanged: busy
                              ? null
                              : (value) => setState(() => _planName = value),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        FilledButton(
                          onPressed: busy
                              ? null
                              : () {
                                  if (!_signUpKey.currentState!.validate()) {
                                    return;
                                  }
                                  context.read<AuthCubit>().signUp(
                                        name: _nameController.text,
                                        planName: _planName,
                                      );
                                },
                          child: const Text('Create account'),
                        ),
                      ],
                    ),
                  ),
                ),
                if (busy) ...[
                  const SizedBox(height: AppSpacing.lg),
                  const Center(child: CircularProgressIndicator()),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ApiKeyOnceNotice extends StatelessWidget {
  const _ApiKeyOnceNotice({required this.apiKey, required this.onContinue});

  final String apiKey;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AppCard(
      color: scheme.tertiaryContainer,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber, color: scheme.onTertiaryContainer),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  'Copy your API key now — it cannot be shown again.',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: scheme.onTertiaryContainer,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          SelectableText(apiKey),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              FilledButton.tonalIcon(
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: apiKey));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('API key copied')),
                    );
                  }
                },
                icon: const Icon(Icons.copy),
                label: const Text('Copy'),
              ),
              const SizedBox(width: AppSpacing.sm),
              FilledButton(
                onPressed: onContinue,
                child: const Text('Continue to app'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
