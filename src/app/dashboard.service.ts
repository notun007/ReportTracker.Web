import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, switchMap, tap, throwError } from 'rxjs';
import { ComponentContributor, Lookup, SubmissionDestination, SubmissionRecipient, ObligationActions, ReceiptItem, ReportingCycle, DashboardSummary, SendingRecord, SendingHistory, SessionResponse, SessionUser, Lookups, ReportDefinition, UserItem, ComponentDefinition, SubmissionReadiness, EvidenceItem, ExtensionItem, ReminderPolicy, NotificationItem, CalendarItem, ManagementAnalytics } from './dashboard.models';

export function apiError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
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
  load() { return this.http.get<SessionResponse>('/api/auth/session').pipe(
    tap(data => { this.user.set(data.user); this.setupRequired.set(data.setupRequired); this.available.set(true); }),
    catchError(error => { this.available.set(false); return throwError(() => error); })
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
  setReportResponsibilities(id:string,body:unknown) { return this.http.put<void>(`/api/setup/reports/${id}/responsibilities`,body); }
  cycles(id: string) { return this.http.get<ReportingCycle[]>(`/api/setup/reports/${id}/cycles`); }
  createCycle(id: string, body: unknown) { return this.http.post(`/api/setup/reports/${id}/cycles`, body); }
  users() { return this.http.get<UserItem[]>('/api/setup/users'); }
  createUser(body: unknown) { return this.http.post('/api/setup/users', body); }
  createDivision(body: unknown) { return this.http.post('/api/setup/divisions', body); }
  components(reportId: string) { return this.http.get<ComponentDefinition[]>(`/api/report-definitions/${reportId}/components`); }
  createComponent(reportId: string, body: unknown) { return this.http.post<ComponentDefinition>(`/api/report-definitions/${reportId}/components`, body); }
  setComponentContributors(reportId: string, componentId: string, contributors: ComponentContributor[]) {
    return this.http.put<ComponentDefinition>(`/api/report-definitions/${reportId}/components/${componentId}/contributors`, {contributors});
  }
  readiness(cycleId: string) { return this.http.get<SubmissionReadiness>(`/api/report-cycles/${cycleId}/readiness`); }
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
  changeUserStatus(id:string,isActive:boolean) { return this.http.patch<void>(`/api/setup/users/${id}/status`,{isActive}); }
  resetPassword(id:string,newPassword:string) { return this.http.post<void>(`/api/setup/users/${id}/reset-password`,{newPassword}); }
}



