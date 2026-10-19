import 'package:flutter/material.dart';
import 'demo_page.dart';
void main() => runApp(const UsageDemoApp());
class UsageDemoApp extends StatelessWidget {
  const UsageDemoApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Usage metering demo',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: const DemoPage(),
    );
  }
}