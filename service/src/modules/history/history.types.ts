import type { AppliedLimits, Rejection } from '../usage/usage.types';

export interface HistoryItem {
  id: string;
  requestId: string;
  userId: string;
  units: number;
  period: string;
  accepted: boolean;
  rejection: Rejection | null;
  appliedLimits: AppliedLimits;
  createdAt: Date;
}

export interface HistoryFilters {
  userId?: string;
  accepted?: boolean;
  period?: string;
}