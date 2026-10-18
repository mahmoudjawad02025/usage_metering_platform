import path from 'node:path';
import { z } from 'zod';
const configSchema = z.object({
  SERVICE_URL: z.string().min(1).default('http://localhost:3000'),
  ADMIN_KEY: z.string().min(16, 'ADMIN_KEY must be at least 16 characters'),
  CLIENT_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  PUBLIC_DIR: z.string().min(1).default(path.resolve(process.cwd(), 'web_app/build/web')),
  STATE_FILE: z.string().min(1).default(path.resolve(process.cwd(), '.demo_state.json')),
  CORS_ORIGIN: z.string().optional(),
});
export type ClientConfig = z.infer<typeof configSchema>;
function loadConfig(): ClientConfig {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment variables:\n${problems}`);
    process.exit(1);
  }
  return result.data;
}
export const config = loadConfig();