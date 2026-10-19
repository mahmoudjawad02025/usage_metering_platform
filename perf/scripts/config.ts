function readPositiveNumber(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be a positive number, got "${raw}"`);
    }
    return value;
  }
  
  function readAdminKey(): string {
    const key = process.env.ADMIN_KEY;
    if (!key) throw new Error('ADMIN_KEY is not set. Run the scripts through npm so that ../.env is loaded.');
    return key;
  }
  
  export const settings = {
    serviceUrl: (process.env.SERVICE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
    adminKey: readAdminKey(),
    databaseUrl:
      process.env.DATABASE_URL ||
      'postgres://usage_metering:usage_metering_password@localhost:5432/usage_metering_service',
    connections: readPositiveNumber('CONNECTIONS', 50),
    durationSeconds: readPositiveNumber('DURATION', 20),
    warmupSeconds: readPositiveNumber('WARMUP', 3),
    label: process.env.LABEL || 'baseline',
    notes: process.env.NOTES || '',
  };