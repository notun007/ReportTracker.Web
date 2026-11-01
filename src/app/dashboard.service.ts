import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { DashboardSummary } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  getDashboard(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/dashboard').pipe(catchError(() => of(DEMO_DASHBOARD)));
  }
}
const DEMO_DASHBOARD: DashboardSummary = {
  myPending: 7, dueToday: 3, overdue: 5, evidencePending: 4,
  performance: [{ status: 'Not Sent', count: 8 }, { status: 'Partially Sent', count: 5 }, { status: 'Sent', count: 14 }],
  upcoming: [
    row('RIT', 'RIT submission to BB', 'BB', 'Asadur Rahman', '2026-11-12T11:00:00Z', 'Upcoming', 'Partially Sent', 'Not Required', 'Missing'),
    row('RIT', 'Internet Banking Data', 'Internal', 'Nusrat Jahan', '2026-11-08T09:00:00Z', 'Due Today', 'Sent', 'Receipt Confirmed', 'Provided'),
    row('RIT', 'CBS Data', 'Internal', 'Tanvir Ahmed', '2026-11-09T09:00:00Z', 'Due Today', 'Sent', 'Awaiting Confirmation', 'Provided'),
    row('RIT', 'Card Data', 'Internal', 'Asadur Rahman', '2026-11-10T09:00:00Z', 'Overdue', 'Not Sent', 'Awaiting Confirmation', 'Missing'),
    row('Large Value Credit Report', 'BB submission', 'BB', 'Farhana Akter', '2026-11-07T11:00:00Z', 'Overdue', 'Not Sent', 'Not Required', 'Missing'),
    row('Off-site ATM Report', 'ATM Data handover', 'Internal', 'Mahmudul Hasan', '2026-11-16T09:00:00Z', 'Upcoming', 'Sent', 'Receipt Confirmed', 'Verified'),
    row('RIT', 'Card correction submission', 'Correction', 'Asadur Rahman', '2026-11-15T11:00:00Z', 'Upcoming', 'Not Sent', 'Not Required', 'Missing'),
  ],
};
function row(report: string, obligation: string, type: 'Internal' | 'BB' | 'Correction', owner: string, dueAtUtc: string,
  timeliness: string, sendingStatus: string, receiptStatus: string, evidenceStatus: string) {
  return { id: crypto.randomUUID(), report, period: 'October 2026', obligation, type, owner, dueAtUtc, timeliness, sendingStatus, receiptStatus, evidenceStatus };
}
