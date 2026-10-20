import type { MeteringClient } from '../../metering_client';

declare global {
  namespace Express {
    interface Request {
      metering?: MeteringClient;
      sessionId?: string;
    }
  }
}

export {};
