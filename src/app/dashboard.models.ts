export interface Obligation {
  id: string; cycleId: string; report: string; period: string; obligation: string;
  type: 'Internal' | 'BB' | 'Correction'; owner: string; dueAtUtc: string;
  timeliness: string; sendingStatus: string; receiptStatus: string; evidenceStatus: string;
  recipient: string; rowVersion: string; canRecordSending: boolean; isAssignedToMe: boolean;
  requiredComponentCount: number; completedComponentCount: number; isReadyForSubmission: boolean;
}
export interface DashboardSummary {
  myPending: number; dueToday: number; overdue: number; readyForSubmission: number; evidencePending: number;
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
export interface UserItem { id: string; displayName: string; email: string; mobileNumber: string | null; employeeId: string; divisionId: string; isActive: boolean; roles: string[]; }
export interface ComponentDefinition {
  id: string; definitionVersionId: string; name: string; description: string | null; isRequired: boolean; sequence: number;
  providerDivisionId: string; primaryOfficerId: string | null; deputyOfficerId: string | null; receivingDivisionId: string;
  receiptRequired: boolean; evidenceRequired: boolean; deadlineOffsetDays: number;
}
export interface ReadinessComponent {
  id: string; name: string; division: string; owner: string; dueAtUtc: string; timeliness: string;
  sendingStatus: string; evidenceStatus: string; receiptStatus: string; isBlocking: boolean;
}
export interface SubmissionReadiness {
  cycleId: string; mainObligationId: string; report: string; period: string; mainDueAtUtc: string;
  requiredComponents: number; completedComponents: number; blockingComponents: number; isReady: boolean;
  components: ReadinessComponent[];
}
export interface EvidenceItem { id:string; trackingObligationId:string; originalFileName:string; contentType:string; sizeBytes:number; sha256:string; status:string; purpose:string; uploadedAtUtc:string; uploadedBy:string; }
export interface ExtensionItem { id:string; trackingObligationId:string; report:string; obligation:string; period:string; originalDueAtUtc:string; requestedDueAtUtc:string; reason:string; permissionReference:string|null; requestedBy:string; status:string; createdAtUtc:string; decidedAtUtc:string|null; decisionReason:string|null; }
export interface ReminderPolicy { id:string; name:string; reportDefinitionId:string|null; report:string; obligationCategory:string; leadDaysCsv:string; dispatchTime:string; channelsCsv:string; recipientsCsv:string; dailyOverdueReminders:boolean; workingDaysCsv:string; quietHoursStart:string|null; quietHoursEnd:string|null; escalationAfterDays:number; isActive:boolean; }
export interface NotificationItem { jobId:string; obligationId:string; report:string; obligation:string; recipient:string; channel:string; dueAtUtc:string; status:string; attemptCount:number; attemptedAtUtc:string|null; succeeded:boolean|null; providerReference:string|null; failureReason:string|null; }
export interface CalendarItem { obligationId:string; cycleId:string; report:string; obligation:string; period:string; type:string; owner:string; dueAtUtc:string; timeliness:string; sendingStatus:string; hasApprovedExtension:boolean; }
export interface DivisionPerformance { division:string; total:number; sentOnTime:number; sentLate:number; overdue:number; }
export interface ManagementAnalytics { total:number; submitted:number; overdue:number; reportsAtRisk:number; pendingExtensions:number; failedNotifications:number; onTimeRate:number; divisions:DivisionPerformance[]; }

