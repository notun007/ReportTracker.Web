import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, switchMap, tap, throwError, timeout, TimeoutError } from 'rxjs';
import { ComponentTeamDirectory, ReportResponsibilityAssignments, SaveReportResponsibilityAssignments, WeeklyPresetPeriod, ReportingFrequencyItem, SchedulePresetDirectory, SchedulePresetItem, SchedulePresetPeriod, DivisionItem, ComponentContributor, Lookup, SubmissionDestination, SubmissionRecipient, ReceivingOfficerDirectory, ObligationActions, ReceiptItem, ReportingCycle, DashboardSummary, SendingRecord, SendingHistory, SessionResponse, SessionUser, Lookups, ReportDefinition, UserItem, ComponentDefinition, SubmissionReadiness, EvidenceItem, ExtensionItem, ReminderPolicy, NotificationItem, CalendarItem, ManagementAnalytics, YearlyCyclePreview, YearlyCycleGenerationResult } from './dashboard.models';

export const databaseUnavailableMessage = 'ReportTracker cannot connect to its database right now. Please retry. If the problem continues, contact your system administrator.';

export function isRequestTimeout(error: unknown): boolean {
  return error instanceof TimeoutError || error instanceof HttpErrorResponse && error.status === 408 && error.error?.code === 'request_timed_out';
}

export function apiError(error: unknown): string {
  if (isRequestTimeout(error)) return 'The request took too long to complete. Refresh the screen to check the latest status before trying again.';
  if (error instanceof HttpErrorResponse) {
    if (error.status === 503 && error.error?.code === 'database_unavailable') return databaseUnavailableMessage;
    if ([0, 502, 503, 504].includes(error.status)) return 'The API is unavailable. Start the ReportTracker API and retry the connection.';
    if (error.status === 401) return error.error?.title ?? 'Your session has expired. Please sign in again.';
    if (error.status === 403) return error.error?.detail ?? 'You do not have permission for this action.';
    if (error.error?.errors) return Object.values(error.error.errors).flat().join(' ');
    return error.error?.detail ?? error.error?.title ?? 'The request failed. Please try again.';
  }
  return 'The request failed. Please try again.';
}
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  readonly user = signal<SessionUser | null>(null);
  readonly setupRequired = signal(false);
  readonly available = signal(false);
  readonly connectionIssue = signal<'database' | 'timeout' | 'api' | 'unexpected' | null>(null);
  load() { return this.http.get<SessionResponse>('/api/auth/session').pipe(
    timeout({ first: 30_000 }),
    tap(data => { this.user.set(data.user); this.setupRequired.set(data.setupRequired); this.available.set(true); this.connectionIssue.set(null); }),
    catchError(error => {
      this.available.set(false); this.setupRequired.set(false);
      this.connectionIssue.set(isRequestTimeout(error) ? 'timeout' :
        error instanceof HttpErrorResponse && error.status === 503 && error.error?.code === 'database_unavailable' ? 'database' :
        error instanceof HttpErrorResponse && [0, 502, 503, 504].includes(error.status) ? 'api' : 'unexpected');
      return throwError(() => error);
    })
  ); }
  login(body: unknown) { return this.load().pipe(switchMap(() => this.http.post('/api/auth/login', body)), switchMap(() => this.load())); }
  setup(body: unknown) { return this.load().pipe(switchMap(() => this.http.post('/api/auth/setup', body)), switchMap(() => this.load())); }
  logout() { return this.load().pipe(switchMap(() => this.http.post('/api/auth/logout', {})), switchMap(() => this.load())); }
}
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  getDashboard() { return this.http.get<DashboardSummary>('/api/dashboard'); }
  recordSending(id: string, body: SendingRecord) { return this.http.post<void>(`/api/obligations/${id}/sending-events`, body); }
  history(id: string) { return this.http.get<SendingHistory[]>(`/api/obligations/${id}/history`); }
  lookups() { return this.http.get<Lookups>('/api/setup/lookups'); }
  reports() { return this.http.get<ReportDefinition[]>('/api/setup/reports'); }
  submissionRecipients() { return this.http.get<SubmissionRecipient[]>('/api/setup/submission-recipients'); }
  createSubmissionRecipient(name: string) { return this.http.post<Lookup>('/api/setup/submission-recipients', {name}); }
  createSubmissionDepartment(recipientId: string, name: string) { return this.http.post<Lookup>(`/api/setup/submission-recipients/${recipientId}/departments`, {name}); }
  createReport(body: unknown) { return this.http.post<{id:string}>('/api/setup/reports', body); }
  reportResponsibilityAssignments(reportId:string) { return this.http.get<ReportResponsibilityAssignments>(`/api/report-definitions/${reportId}/responsibility-assignments`); }
  saveReportResponsibilityAssignments(reportId:string,body:SaveReportResponsibilityAssignments) { return this.http.put<void>(`/api/report-definitions/${reportId}/responsibility-assignments`,body); }
  setReportResponsibilities(id:string,body:unknown) { return this.http.put<void>(`/api/setup/reports/${id}/responsibilities`,body); }
  cycles(id: string) { return this.http.get<ReportingCycle[]>(`/api/setup/reports/${id}/cycles`); }
  createCycle(id: string, body: unknown) { return this.http.post(`/api/setup/reports/${id}/cycles`, body); }
  reportingFrequencies() { return this.http.get<ReportingFrequencyItem[]>('/api/setup/reporting-frequencies'); }
  createReportingFrequency(body: {code:string; name:string; displayOrder:number}) {
    return this.http.post<ReportingFrequencyItem>('/api/setup/reporting-frequencies', body);
  }
  updateReportingFrequency(id:number, body: {name:string; displayOrder:number}) {
    return this.http.put<ReportingFrequencyItem>(`/api/setup/reporting-frequencies/${id}`, body);
  }
  schedulePresets() { return this.http.get<SchedulePresetDirectory>('/api/setup/schedule-presets'); }
  previewSchedulePreset(ruleCode: string, month: string) {
    return this.http.get<SchedulePresetPeriod[]>('/api/setup/schedule-presets/preview', { params: { ruleCode, month } });
  }
  createSchedulePreset(ruleCode: string, weeklyPeriods?: WeeklyPresetPeriod[]) {
    return this.http.post<SchedulePresetItem>('/api/setup/schedule-presets', { ruleCode, weeklyPeriods });
  }
  divisions() { return this.http.get<DivisionItem[]>('/api/setup/divisions'); }
  users() { return this.http.get<UserItem[]>('/api/setup/users'); }
  updateUser(id:string,body:unknown){return this.http.put('/api/setup/users/'+id,body);}
  createUser(body: unknown) { return this.http.post('/api/setup/users', body); }
  createDivision(body: unknown) { return this.http.post('/api/setup/divisions', body); }
  saveComponentTeamMember(reportId:string,componentId:string,userId:string,roles:ComponentContributor['role'][]) { return this.http.put<ComponentDefinition>(`/api/report-definitions/${reportId}/components/${componentId}/contributors/${userId}`,{roles}); }
  removeComponentTeamMember(reportId:string,componentId:string,userId:string) { return this.http.delete<ComponentDefinition>(`/api/report-definitions/${reportId}/components/${componentId}/contributors/${userId}`); }
  componentTeams() { return this.http.get<ComponentTeamDirectory>('/api/component-teams'); }
  components(reportId: string) { return this.http.get<ComponentDefinition[]>(`/api/report-definitions/${reportId}/components`); }
  createComponent(reportId: string, body: unknown) { return this.http.post<ComponentDefinition>(`/api/report-definitions/${reportId}/components`, body); }
  setComponentContributors(reportId: string, componentId: string, contributors: ComponentContributor[]) {
    return this.http.put<ComponentDefinition>(`/api/report-definitions/${reportId}/components/${componentId}/contributors`, {contributors});
  }
  readiness(cycleId: string) { return this.http.get<SubmissionReadiness>(`/api/report-cycles/${cycleId}/readiness`); }
  receivingOfficers(reportId:string,divisionId:string) { return this.http.get<ReceivingOfficerDirectory>(`/api/report-definitions/${reportId}/receiving-officers`,{params:{divisionId}}); }
  setReceivingOfficers(reportId:string,divisionId:string,officerIds:string[],rowVersion:string) { return this.http.put<void>(`/api/report-definitions/${reportId}/receiving-officers`,{divisionId,officerIds,rowVersion}); }
  obligationActions(id:string) { return this.http.get<ObligationActions>(`/api/obligations/${id}/actions`); }
  receipts(id:string) { return this.http.get<ReceiptItem[]>(`/api/obligations/${id}/receipts`); }
  assignReceivingDivision(id:string,receivingDivisionId:string) { return this.http.patch<void>(`/api/obligations/${id}/receiving-division`,{receivingDivisionId}); }
  evidence(obligationId:string) { return this.http.get<EvidenceItem[]>(`/api/obligations/${obligationId}/evidence`); }
  uploadEvidence(obligationId:string, file:File) { const body=new FormData(); body.append('file',file); return this.http.post<EvidenceItem>(`/api/obligations/${obligationId}/evidence`,body); }
  decideEvidence(id:string, decision:string, reason:string|null) { return this.http.post<void>(`/api/evidence/${id}/decision`,{decision,reason}); }
  confirmReceipt(obligationId:string, body:unknown) { return this.http.post(`/api/obligations/${obligationId}/receipts`,body); }
  amendStatus(obligationId:string, body:unknown) { return this.http.post<void>(`/api/obligations/${obligationId}/amendments`,body); }
  extensions() { return this.http.get<ExtensionItem[]>('/api/extensions'); }
  requestExtension(obligationId:string, body:unknown) { return this.http.post(`/api/obligations/${obligationId}/extensions`,body); }
  decideExtension(id:string, body:unknown) { return this.http.post<void>(`/api/extensions/${id}/decision`,body); }
  reminderPolicies() { return this.http.get<ReminderPolicy[]>('/api/reminders/policies'); }
  createReminderPolicy(body:unknown) { return this.http.post('/api/reminders/policies',body); }
  notificationDeliveries() { return this.http.get<NotificationItem[]>('/api/reminders/deliveries'); }
  planReminders() { return this.http.post('/api/reminders/plan',{}); }
  dispatchReminders() { return this.http.post('/api/reminders/dispatch',{}); }
  retryNotification(id:string) { return this.http.post<void>(`/api/reminders/jobs/${id}/retry`,{}); }
  calendar(fromUtc:string,toUtc:string) { return this.http.get<CalendarItem[]>('/api/operations/calendar',{params:{fromUtc,toUtc}}); }
  analytics() { return this.http.get<ManagementAnalytics>('/api/operations/analytics'); }
  generateCycles(through:string) { return this.http.post('/api/automation/generate-cycles',{}, {params:{through}}); }
  previewYearlyCycles(year:number, reportId?:string) { return this.http.get<YearlyCyclePreview>('/api/automation/yearly-cycles/preview',{params:{year,...(reportId ? {reportId} : {})}}); }
  generateYearlyCycles(year:number, reportId:string|null, periodKeys?:string[]) { return this.http.post<YearlyCycleGenerationResult>('/api/automation/yearly-cycles',{reportId,periodKeys}, {params:{year}}); }
  changeUserStatus(id:string,isActive:boolean) { return this.http.patch<void>(`/api/setup/users/${id}/status`,{isActive}); }
  resetPassword(id:string,newPassword:string) { return this.http.post<void>(`/api/setup/users/${id}/reset-password`,{newPassword}); }
}



