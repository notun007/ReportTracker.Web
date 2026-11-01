export interface Obligation {
  id: string; report: string; period: string; obligation: string;
  type: 'Internal' | 'BB' | 'Correction'; owner: string; dueAtUtc: string;
  timeliness: string; sendingStatus: string; receiptStatus: string; evidenceStatus: string;
  recipient: string; rowVersion: string; canRecordSending: boolean; isAssignedToMe: boolean;
}
export interface DashboardSummary {
  myPending: number; dueToday: number; overdue: number; evidencePending: number;
  upcoming: Obligation[]; performance: { status: string; count: number }[];
}
export interface SendingRecord {
  actualSentAtUtc: string; recipient: string; channel: string; reference: string | null;
  isPartial: boolean; scopeNames: string[] | null; trackingRemarks: string | null; rowVersion: string;
}
export interface SendingHistory {
  id: string; actualSentAtUtc: string; recordedAtUtc: string; actor: string; recipient: string;
  channel: string; reference: string | null; isPartial: boolean; scopeNames: string | null; trackingRemarks: string | null;
}
export interface SessionUser { id: string; displayName: string; email: string; divisionId: string; permissions: string[]; }
export interface SessionResponse { setupRequired: boolean; user: SessionUser | null; }
export interface Lookup { id: string; name: string; }
export interface Lookups { divisions: Lookup[]; officers: (Lookup & { divisionId: string })[]; }
export interface ReportDefinition { id: string; code: string; name: string; ownerDivisionId: string; bbRecipient: string; frequency: string; cycleCount: number; }
export interface UserItem { id: string; displayName: string; email: string; employeeId: string; divisionId: string; isActive: boolean; roles: string[]; }

