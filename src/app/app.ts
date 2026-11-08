import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { DashboardService, SessionService, apiError } from './dashboard.service';
import { DashboardSummary, Obligation, SendingHistory } from './dashboard.models';
import { SignInComponent } from './sign-in.component';
import { WorkspaceSetupComponent } from './workspace-setup.component';
import { ComponentResponsibilitiesComponent } from './component-responsibilities.component';
import { ObligationOperationsComponent } from './obligation-operations.component';
import { OperationsPagesComponent } from './operations-pages.component';

@Component({
  imports: [CommonModule, FormsModule, SignInComponent, WorkspaceSetupComponent, ComponentResponsibilitiesComponent, ObligationOperationsComponent, OperationsPagesComponent],
  selector: 'app-root', styleUrl: './app.scss', templateUrl: './app.html'
})
export class App {
  protected readonly session = inject(SessionService);
  private readonly api = inject(DashboardService);
  protected readonly ready = signal(false);
  protected readonly dashboard = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly view = signal('Reporting Overview');
  protected readonly activeFilter = signal('All');
  protected readonly divisionFilter = signal('All divisions');
  protected readonly reportFilter = signal('All reports');
  protected readonly ownerFilter = signal('All owners');
  protected readonly deadlineFilter = signal('All dates');
  protected readonly navCollapsed = signal(window.innerWidth <= 760);
  protected readonly selected = signal<Obligation | null>(null);
  protected readonly historyRow = signal<Obligation | null>(null);
  protected readonly operationsRow = signal<Obligation | null>(null);
  protected readonly history = signal<SendingHistory[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly toast = signal('');
  protected readonly saving = signal(false);
  protected readonly recordError = signal('');
  protected readonly search = signal('');
  private readonly recordDialog = viewChild<ElementRef<HTMLDialogElement>>('recordDialog');
  private readonly historyDialog = viewChild<ElementRef<HTMLDialogElement>>('historyDialog');
  private readonly operationsDialog = viewChild<ElementRef<HTMLDialogElement>>('operationsDialog');
  protected form = this.emptyForm();
  protected readonly today = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'Asia/Dhaka' }).format(new Date());
  protected readonly canSetup = computed(() => this.session.user()?.permissions.includes('reports.manage') ?? false);
  protected readonly canAdmin = computed(() => this.session.user()?.permissions.includes('administration.manage') ?? false);
  protected readonly navigation = computed(() => [
    'Reporting Overview', 'Report Register', ...(this.canSetup() ? ['Report Setup', 'Components and Responsibilities'] : []),
    'Component Submission', 'Submission Readiness', 'Main Report Submission', 'Deadline Extensions', 'Reminder Settings', 'Reporting Calendar'
  ]);
  protected readonly divisions = computed(() => [...new Map((this.dashboard()?.upcoming ?? []).filter(row => row.divisionId && row.division).map(row => [row.divisionId, { id: row.divisionId, name: row.division }])).values()].sort((a, b) => a.name.localeCompare(b.name)));
  protected readonly reports = computed(() => this.unique((this.dashboard()?.upcoming ?? []).map(row => row.report)));
  protected readonly owners = computed(() => this.unique((this.dashboard()?.upcoming ?? []).map(row => row.owner.split('·')[0].trim())));
  protected readonly filtered = computed(() => {
    const filter = this.activeFilter(); const term = this.search().trim().toLowerCase(); const view = this.view();
    return (this.dashboard()?.upcoming ?? []).filter(row =>
      (view !== 'Component Submission' || row.type === 'Internal') &&
      (!['Submission Readiness', 'Main Report Submission'].includes(view) || row.type === 'BB') &&
      (filter === 'All' || (filter === 'My Pending' && row.isAssignedToMe && row.sendingStatus !== 'Sent') || row.timeliness === filter || row.type === filter || row.sendingStatus === filter ||
        (filter === 'Evidence Pending' && ['Missing', 'Provided', 'Rejected'].includes(row.evidenceStatus))) &&
      (this.divisionFilter() === 'All divisions' || row.divisionId === this.divisionFilter()) &&
      (this.reportFilter() === 'All reports' || row.report === this.reportFilter()) &&
      (this.ownerFilter() === 'All owners' || row.owner.startsWith(this.ownerFilter())) &&
      (this.deadlineFilter() === 'All dates' || row.timeliness === this.deadlineFilter()) &&
      (!term || `${row.report} ${row.obligation} ${row.owner} ${row.period}`.toLowerCase().includes(term)));
  });
  protected readonly maxPerformance = computed(() => Math.max(1, ...(this.dashboard()?.performance.map(x => x.count) ?? [])));
  constructor() {
    effect(() => { const element = this.recordDialog()?.nativeElement; if (this.selected() && element && !element.open) element.showModal(); });
    effect(() => { const element = this.historyDialog()?.nativeElement; if (this.historyRow() && element && !element.open) element.showModal(); });
    effect(() => { const element = this.operationsDialog()?.nativeElement; if (this.operationsRow() && element && !element.open) element.showModal(); });
    this.loadSession();
  }
  protected loadSession() {
    this.ready.set(false); this.error.set('');
    this.session.load().subscribe({ next: () => { this.ready.set(true); if (this.session.user()) this.reload(); }, error: error => { this.ready.set(true); this.error.set(apiError(error)); } });
  }
  protected signedIn() { this.view.set('Reporting Overview'); this.reload(); }
  protected reload() {
    this.loading.set(true); this.error.set('');
    this.api.getDashboard().subscribe({ next: data => { this.dashboard.set(data); this.loading.set(false); }, error: error => { this.loading.set(false); this.error.set(apiError(error)); if (error instanceof HttpErrorResponse && error.status === 401) this.session.user.set(null); } });
  }
  protected navigate(view: string) { this.view.set(view); this.activeFilter.set('All'); this.search.set(''); if (window.innerWidth <= 760) this.navCollapsed.set(true); }
  protected setFilter(filter: string) { this.activeFilter.set(filter); }
  protected clearFilters() { this.search.set(''); this.activeFilter.set('All'); this.divisionFilter.set('All divisions'); this.reportFilter.set('All reports'); this.ownerFilter.set('All owners'); this.deadlineFilter.set('All dates'); }
  protected openRecord(row: Obligation) { if (!row.canRecordSending) return; this.form = { ...this.emptyForm(), recipient: row.recipient }; this.recordError.set(''); this.selected.set(row); }
  protected closeRecord(event?: Event) { if (this.saving()) { event?.preventDefault(); return; } this.selected.set(null); }
  protected saveRecord(form: NgForm) {
    const row = this.selected(); if (!row || form.invalid || this.saving()) return;
    this.saving.set(true); this.recordError.set('');
    this.api.recordSending(row.id, { recipient: this.form.recipient.trim(), channel: this.form.channel,
      actualSentAtUtc: new Date(this.form.actualSentLocal + '+06:00').toISOString(), reference: this.form.reference.trim() || null,
      isPartial: this.form.isPartial, scopeNames: this.form.isPartial ? this.form.scopeNames.split(',').map(x => x.trim()).filter(Boolean) : null,
      trackingRemarks: this.form.trackingRemarks.trim() || null, rowVersion: row.rowVersion
    }).subscribe({ next: () => { this.saving.set(false); this.closeRecord(); this.notify('Sending record saved.'); this.reload(); }, error: error => { this.saving.set(false); this.recordError.set(apiError(error)); } });
  }
  protected openHistory(row: Obligation) {
    this.history.set([]); this.historyError.set(''); this.historyLoading.set(true); this.historyRow.set(row);
    this.api.history(row.id).subscribe({ next: data => { if (this.historyRow()?.id === row.id) { this.history.set(data); this.historyLoading.set(false); } }, error: error => { this.historyLoading.set(false); this.historyError.set(apiError(error)); } });
  }
  protected openOperations(row: Obligation) { this.operationsRow.set(row); }
  protected closeOperations() { this.operationsRow.set(null); }
  protected logout() { this.session.logout().subscribe({ next: () => { this.dashboard.set(null); this.selected.set(null); this.historyRow.set(null); }, error: error => this.error.set(apiError(error)) }); }
  protected statusClass(value: string) { return value.toLowerCase().replaceAll(' ', '-'); }
  protected navIcon(item: string) { return ({
    'Reporting Overview':'⌂', 'Report Register':'▤', 'Report Setup':'⚙', 'Components and Responsibilities':'◫',
    'Component Submission':'✓', 'Submission Readiness':'◷', 'Main Report Submission':'↗', 'Deadline Extensions':'◴',
    'Reminder Settings':'♢', 'Reporting Calendar':'□'
  } as Record<string,string>)[item] ?? '•'; }
  protected readinessPercent(row: Obligation) { return row.requiredComponentCount ? Math.round(row.completedComponentCount / row.requiredComponentCount * 100) : 0; }
  private notify(message: string) { this.toast.set(message); window.setTimeout(() => this.toast.set(''), 4000); }
  private unique(values: string[]) { return [...new Set(values)].sort((a, b) => a.localeCompare(b)); }
  private emptyForm() { return { recipient: '', channel: 'Portal', actualSentLocal: '', reference: '', isPartial: false, scopeNames: '', trackingRemarks: '' }; }
}


