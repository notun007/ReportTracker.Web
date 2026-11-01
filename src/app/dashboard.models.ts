export interface Obligation {
  id: string; report: string; period: string; obligation: string;
  type: 'Internal' | 'BB' | 'Correction'; owner: string; dueAtUtc: string;
  timeliness: string; sendingStatus: string; receiptStatus: string; evidenceStatus: string;
}
export interface DashboardSummary {
  myPending: number; dueToday: number; overdue: number; evidencePending: number;
  upcoming: Obligation[]; performance: { status: string; count: number }[];
}
