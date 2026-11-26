export interface Obligation {
  id: string; cycleId: string; reportId: string; report: string; period: string; obligation: string;
  reportCode?: string | null; periodStart?: string | null;
  type: 'Internal' | 'BB' | 'Correction'; owner: string; divisionId: string; division: string; dueAtUtc: string;
  timeliness: string; sendingStatus: string; receiptStatus: string; evidenceStatus: string;
  recipient: string; rowVersion: string; canRecordSending: boolean; isAssignedToMe: boolean; isAssignedReceiver?: boolean;
  requiredComponentCount: number; completedComponentCount: number; isReadyForSubmission: boolean;
  pendingComponents: { id: string; name: string; sendingStatus: string; receiptStatus: string; evidenceStatus: string }[];
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
export interface DivisionItem extends Lookup { code: string; isActive: boolean; }
export interface ReportTypeItem { id: number; name: string; }
export interface Lookups { divisions: Lookup[]; officers: (Lookup & { divisionId: string })[]; reportTypes: ReportTypeItem[]; }
export interface SubmissionRecipient extends Lookup { departments: Lookup[]; }
export interface SubmissionDestination { submissionRecipientId: string; submissionDepartmentIds: string[]; }
export interface ReportConfigurationUpdate extends SubmissionDestination {
  name: string;
  reportTypeId: number;
  frequency: string;
  ownerDivisionId: string | null;
  receivingDivisionId: string | null;
  submittingDivisionId: string | null;
  dueTime: string;
  reportDeadlineOffsetDays: number;
  componentDeadlineOffsetDays: number;
  instructionReference: string;
  description: string;
  rowVersion: string;
}
export interface ReportDefinition {
  rowVersion: string;
  canEdit: boolean;
  divisionLocks?: { coordinating: boolean; receiving: boolean; finalSubmitting: boolean };
  dueTime?: string | null; reportDeadlineOffsetDays?: number; componentDeadlineOffsetDays?: number | null; timeZoneId?: string | null;
  instructionReference?: string | null; description?: string | null;
  submissionRecipientId?: string | null; submissionDepartmentIds?: string[]; submissionDestination?: string; id: string; code: string; name: string; reportTypeId: number; reportTypeName: string; ownerDivisionId: string; bbRecipient: string; frequency: string; cycleCount: number; receivingDivisionId: string | null; submittingDivisionId: string | null; primarySubmittingAssigneeId: string | null; alternateSubmittingAssigneeId: string | null; }
export interface UserItem { id: string; displayName: string; email: string; mobileNumber: string | null; employeeId: string; divisionId: string; isActive: boolean; roles: string[]; rowVersion:string; }
export type ContributorRole = 'LeadPreparer' | 'Preparer' | 'BackupPreparer' | 'Reviewer';
export interface ComponentContributor { userId: string; role: ContributorRole; }
export interface ComponentDefinition {
  contributors?: ComponentContributor[];
  id: string; definitionVersionId: string; name: string; description: string | null;
  providerDivisionId: string; primaryAssigneeId: string | null; alternateAssigneeId: string | null; receivingDivisionId: string;
  deadlineOffsetDays: number;
}
export interface ReadinessComponent {
  id: string; name: string; division: string; owner: string; dueAtUtc: string; timeliness: string;
  sendingStatus: string; evidenceStatus: string; receiptStatus: string; isBlocking: boolean; isRequired?: boolean;
}
export interface SubmissionReadiness {
  cycleId: string; mainObligationId: string; report: string; period: string; mainDueAtUtc: string;
  requiredComponents: number; completedComponents: number; blockingComponents: number; isReady: boolean;
  components: ReadinessComponent[];
}
export interface EvidenceItem { id:string; trackingObligationId:string; originalFileName:string; contentType:string; sizeBytes:number; sha256:string; status:string; purpose:string; uploadedAtUtc:string; uploadedBy:string; uploadedByUserId:string; canReview:boolean; }
export interface ExtensionItem { id:string; trackingObligationId:string; report:string; obligation:string; period:string; originalDueAtUtc:string; requestedDueAtUtc:string; reason:string; permissionReference:string|null; requestedBy:string; status:string; createdAtUtc:string; decidedAtUtc:string|null; decisionReason:string|null; }
export interface ReminderPolicy { id:string; name:string; reportDefinitionId:string|null; report:string; obligationCategory:string; leadDaysCsv:string; dispatchTime:string; channelsCsv:string; recipientsCsv:string; dailyOverdueReminders:boolean; workingDaysCsv:string; quietHoursStart:string|null; quietHoursEnd:string|null; escalationAfterDays:number; isActive:boolean; }
export interface NotificationItem { jobId:string; obligationId:string; report:string; obligation:string; recipient:string; channel:string; dueAtUtc:string; status:string; attemptCount:number; attemptedAtUtc:string|null; succeeded:boolean|null; providerReference:string|null; failureReason:string|null; }
export interface CalendarItem { obligationId:string; cycleId:string; report:string; obligation:string; period:string; type:string; owner:string; dueAtUtc:string; timeliness:string; sendingStatus:string; hasApprovedExtension:boolean; }
export interface DivisionPerformance { division:string; total:number; sentOnTime:number; sentLate:number; overdue:number; }
export interface ManagementAnalytics { total:number; submitted:number; overdue:number; reportsAtRisk:number; pendingExtensions:number; failedNotifications:number; onTimeRate:number; divisions:DivisionPerformance[]; }
export interface ComponentDeadlinePlanItem { componentId:string; componentName:string; deadline:string; }
export interface YearlyCyclePlanItem { reportId:string; reportCode:string; reportName:string; frequency:string; periodKey:string; periodLabel:string; periodStart:string; periodEnd:string; finalDeadline:string|null; defaultComponentDeadline:string|null; componentDeadlines:ComponentDeadlinePlanItem[]; status:'New'|'Existing'|'Skipped'; reason:string|null; }
export interface YearlyCyclePreview { year:number; reportsEvaluated:number; totalCycles:number; newCycles:number; existingCycles:number; skippedCycles:number; items:YearlyCyclePlanItem[]; }
export interface YearlyCycleGenerationResult { year:number; reportsEvaluated:number; cyclesCreated:number; existingCycles:number; skippedCycles:number; componentsCreated:number; warnings:string[]; }


export interface ReportingCycle {
  id: string; periodKey: string; periodLabel: string; periodStart: string; periodEnd: string;
  obligations: CycleObligation[];
}
export interface CycleObligation {
  name: string; type: string; divisionId: string; divisionName: string;
  primaryAssigneeId: string | null; primaryAssigneeName: string | null;
  alternateAssigneeId: string | null; alternateAssigneeName: string | null;
  recipient: string; dueAtUtc: string; receiptRequired: boolean; evidenceRequired: boolean; receivingDivisionId: string | null;
}
export interface ObligationActions {
  canUploadEvidence:boolean; canConfirmReceipt:boolean; canReviewEvidence:boolean; canAmendStatus:boolean;
  isExternalReceipt:boolean; hasSending:boolean; receivingDivisionId:string|null; receivingDivisionName:string|null;
  canAssignReceiver:boolean; receivingDivisions:Lookup[]; canManageReceivingOfficers?:boolean;
  receiptState?: 'NotRequired' | 'AwaitingConfirmation' | 'ReceiptConfirmed' | 'ReceiptDisputed';
  latestDispatch?: { id: string; actualSentAtUtc: string; channel: string; reference: string | null; isPartial: boolean } | null;
}
export interface ReceiptItem { id:string; sendingEventId:string; receivedAtUtc:string; isDisputed:boolean; reason:string|null; recordedAtUtc:string; actor:string; }
export interface ReportingFrequencyItem { id:number; code:string; name:string; displayOrder:number; }
export interface SchedulePresetRule { code:string; name:string; reportingPeriod:string; finalDeadline:string; }
export interface WeeklyPresetPeriod { startDay:number; endDay:number | null; startMonth?:number | null; endMonth?:number | null; }
export interface SchedulePresetItem { id:string; ruleCode:string; name:string; version:number; displayOrder:number; reportingPeriod:string; finalDeadline:string; weeklyPeriods?:WeeklyPresetPeriod[] | null; }
export interface SchedulePresetDirectory { rules:SchedulePresetRule[]; saved:SchedulePresetItem[]; }
export interface SchedulePresetPeriod { periodStart:string; periodEnd:string; finalDeadline:string; }

export interface ReceivingOfficerDirectory { reportId:string; divisionId:string; division:string; officers:Lookup[]; selectedOfficerIds:string[]; rowVersion:string; }

export interface AssigneePair { primaryAssigneeId:string; alternateAssigneeId:string|null; }
export interface ResponsibilitySection { divisionId:string|null; division:string; assignees:Lookup[]; primaryAssigneeId:string|null; alternateAssigneeId:string|null; }
export interface ReportResponsibilityAssignments { reportId:string; report:string; rowVersion:string; controller:ResponsibilitySection; receiver:ResponsibilitySection; finalSubmission:ResponsibilitySection; existingReceiverCount:number; }
export interface SaveReportResponsibilityAssignments { controller:AssigneePair; receiver:AssigneePair; finalSubmission:AssigneePair; rowVersion:string; }

export interface ComponentTeamItem { reportId:string; reportCode:string; reportName:string; preparingDivision:string; component:ComponentDefinition; }
export interface ComponentTeamDirectory { components:ComponentTeamItem[]; members:(Lookup & {divisionId:string})[]; }
