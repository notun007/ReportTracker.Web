import { Component, OnInit, OnDestroy, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { forkJoin, Observable, of, Subscription } from 'rxjs';
import { DashboardService, SessionService, apiError } from './dashboard.service';
import { Lookups, ReportDefinition, ReportingCycle, SubmissionDestination, SubmissionRecipient, UserItem } from './dashboard.models';

import { SubmissionDestinationPickerComponent } from './submission-destination-picker.component';
import { SubmissionRecipientAdminComponent } from './submission-recipient-admin.component';
import { ReportComponentEditorComponent } from './report-component-editor.component';
import { ReportProfileComponent } from './report-profile.component';

type SetupTab = 'reports' | 'create' | 'profile' | 'components' | 'cycles';

@Component({
  selector: 'app-workspace-setup', imports: [FormsModule, ReportComponentEditorComponent, ReportProfileComponent, SubmissionDestinationPickerComponent, SubmissionRecipientAdminComponent],
  styles: [`
    .cycle-details { display:grid; gap:14px; min-width:0; margin:0; padding:0; border:0; }
    .cycle-notice { margin:0; color:var(--muted); }
    .setup-editor { padding:18px 22px 0; border:0; border-radius:0; box-shadow:none; }
    .setup-editor h3 { margin:0 0 14px; }
    .setup-editor>form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 16px; align-items:start; }
    .setup-editor label { min-width:0; }
    @container report-form (max-width:880px) {
      .setup-editor > .report-inline-fields,.report-inline-fields .form-grid { grid-template-columns:minmax(0,1fr); }
    }
    .report-description,.setup-actions,.cycle-details,.cycle-notice,.cycle-state { grid-column:1/-1; }
    .setup-actions { position:sticky; bottom:0; z-index:1; display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; padding:12px 0; border-top:1px solid var(--line); background:#fff; }
    .report-optional { padding:10px 12px; border:1px solid var(--line); border-radius:8px; }
    .report-optional summary { cursor:pointer; font-size:13px; font-weight:600; }
    .report-optional .form-grid { margin-top:12px; }
    @media(max-width:640px) { .setup-editor { padding:14px 12px 0; } .setup-editor>form { grid-template-columns:minmax(0,1fr); } }
  `],

  template: `
    @if (error()) { <div class="error-banner" role="alert">{{ error() }} <button type="button" (click)="load()">Retry</button></div> }
    @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
    @if (divisionToast()) { <div class="toast division-error-toast" role="alert"><span class="toast-icon" aria-hidden="true">!</span><span class="toast-message">{{ divisionToast() }}</span><button type="button" (click)="dismissDivisionToast()" aria-label="Dismiss division error">×</button></div> }
    @if (loading()) { <p class="loading">Loading workspace setup…</p> }
    @else if (mode() === 'Administration') {
      <section class="setup-grid">
        <article class="setup-card"><h3>Add division</h3><form #divisionForm="ngForm" (ngSubmit)="addDivision(divisionForm)">
          <label>Code<input name="code" [(ngModel)]="division.code" required maxlength="40"></label>
          <label>Name<input name="name" [(ngModel)]="division.name" required maxlength="150"></label>
          <button class="primary" type="submit" [disabled]="busy() || divisionForm.invalid">Add division</button>
        </form></article>
        <article class="setup-card"><h3>Add user</h3><form #userForm="ngForm" (ngSubmit)="addUser(userForm)">
          <label>Employee ID<input name="employeeId" [(ngModel)]="user.employeeId" required maxlength="40"></label>
          <label>Display name<input name="displayName" [(ngModel)]="user.displayName" required maxlength="150"></label>
          <label>Email<input name="email" type="email" [(ngModel)]="user.email" required email maxlength="254" autocomplete="off"></label>
          <label>Mobile number<input name="mobileNumber" [(ngModel)]="user.mobileNumber" maxlength="30" placeholder="+8801…"></label>
          <label>Division<select name="divisionId" [(ngModel)]="user.divisionId" required><option value="">Choose division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label>Initial password<input name="password" type="password" [(ngModel)]="user.password" required minlength="12" maxlength="128" autocomplete="new-password"></label>
          <label class="checkbox"><input name="coordinator" type="checkbox" [(ngModel)]="user.isCoordinator">Report Coordinator for this division</label>
          <small>Officers can record their assigned obligations. Coordinators can also set up reports and monitor their division.</small>
          <button class="primary" type="submit" [disabled]="busy() || userForm.invalid">Create user</button>
        </form></article>
      </section>
      <section class="tracker-panel"><div class="panel-heading"><h3>Users</h3></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Employee ID</th><th>Contact</th><th>Roles</th><th>Status</th><th>Security actions</th></tr></thead><tbody>@for (u of users(); track u.id) { <tr><td>{{ u.displayName }}</td><td>{{ u.employeeId }}</td><td>{{ u.email }}<span>{{u.mobileNumber || 'No mobile number'}}</span></td><td>{{ u.roles.join(', ') || 'Assigned officer' }}</td><td><span class="status" [class.sent]="u.isActive">{{ u.isActive ? 'Active' : 'Inactive' }}</span></td><td><div class="row-actions"><button class="link-button" type="button" (click)="toggleUser(u)">{{u.isActive?'Deactivate':'Activate'}}</button><button class="link-button" type="button" (click)="resetUserPassword(u)">Reset password</button></div></td></tr> }</tbody></table></div></section>
      <app-submission-recipient-admin />
    } @else {
      <section class="report-workspace">
        <div class="report-tabbar" role="tablist" aria-label="Report configuration sections">
          @for (tab of tabs; track tab.id; let i=$index) {
            <button type="button" role="tab" [id]="'setup-tab-'+tab.id" [attr.aria-controls]="'setup-panel-'+tab.id"
              [attr.aria-selected]="activeTab()===tab.id" [attr.tabindex]="activeTab()===tab.id ? 0 : -1"
              (click)="selectTab(tab.id)" (keydown)="onTabKey($event,i)">{{ tab.label }}</button>
          }
        </div>
        <div class="report-context">
          @if (activeTab()==='create') {
            <span class="report-context-meta">New report</span>
          } @else {
          <label>Selected report
            <select name="workspaceReport" [ngModel]="selectedReportId()" (ngModelChange)="chooseReport($event)" [disabled]="workspaceBusy()">
              <option value="">Choose report</option>
              @for (r of reports(); track r.id) { <option [value]="r.id">{{ r.code }} — {{ r.name }}</option> }
            </select>
          </label>
          @if (selectedReport(); as selected) { <span class="report-context-meta">{{ selected.frequency }} · {{ selected.cycleCount }} {{ selected.cycleCount === 1 ? 'cycle' : 'cycles' }}</span> }
          }
        </div>
        <section class="setup-tab-panel" role="tabpanel" id="setup-panel-reports" aria-labelledby="setup-tab-reports" [hidden]="activeTab()!=='reports'">
          <section class="tracker-panel reports-grid" aria-label="Reports"><div class="panel-heading"><h3>Reports ({{ reports().length }})</h3></div>
            <div class="table-wrap"><table><thead><tr><th>Report</th><th>Frequency</th><th>Coordinating division</th><th>Submission recipient</th><th>Cycles</th><th>Actions</th></tr></thead><tbody>
              @for (r of reports(); track r.id) {
                <tr [class.current-report]="r.id===selectedReportId()">
                  <td><strong>{{ r.name }}</strong><span>{{ r.code }}</span></td><td>{{ r.frequency }}</td><td>{{ divisionName(r.ownerDivisionId) }}</td>
                  <td><strong>{{ recipientName(r) }}</strong><span>{{ r.submissionDepartmentIds?.length ?? 0 }} {{ r.submissionDepartmentIds?.length===1 ? 'department' : 'departments' }}</span></td><td>{{ r.cycleCount }}</td>
                  <td><div class="report-row-actions">
                    <button class="link-button" type="button" (click)="openReportTab(r.id,'profile')" [attr.aria-label]="'Report profile for '+r.code" [disabled]="workspaceBusy()">Profile</button>
                    <button class="link-button" type="button" (click)="openReportTab(r.id,'components')" [attr.aria-label]="'Components for '+r.code" [disabled]="workspaceBusy()">Components</button>
                    <button class="link-button" type="button" (click)="openReportTab(r.id,'cycles')" [attr.aria-label]="'Reporting cycles for '+r.code" [disabled]="workspaceBusy()">Cycles</button>
                  </div></td>
                </tr>
              } @empty { <tr><td colspan="6" class="empty">No reports configured yet.</td></tr> }
            </tbody></table></div>
          </section>
        </section>
        <section class="setup-tab-panel department-panel" role="tabpanel" id="setup-panel-create" aria-labelledby="setup-tab-create" [hidden]="activeTab()!=='create'">
            <article class="setup-card setup-editor report-inline-layout"><h3>Create report</h3>
<form class="report-inline-fields" #reportForm="ngForm" (ngSubmit)="addReport(reportForm)">
          <label class="report-field"><span>Code</span><input name="code" [(ngModel)]="report.code" required maxlength="40"></label>
          <label class="report-field"><span>Report name</span><input name="name" [(ngModel)]="report.name" required maxlength="150"></label>
          <label class="report-field"><span>Coordinating division</span><select name="ownerDivisionId" [(ngModel)]="report.ownerDivisionId" required><option value="">Choose division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label class="report-field"><span>Receiving division</span><select name="reportReceivingDivision" [(ngModel)]="report.receivingDivisionId" required><option value="">Choose receiving division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label class="report-field"><span>Final submitting division</span><select name="submittingDivisionId" [(ngModel)]="report.submittingDivisionId" (ngModelChange)="report.primarySubmittingOfficerId = ''; report.deputySubmittingOfficerId = ''" required><option value="">Choose final submitting division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label class="report-field"><span>Final submitting officer</span><select name="primarySubmittingOfficerId" [ngModel]="report.primarySubmittingOfficerId" (ngModelChange)="selectFinalSubmitter($event)" required><option value="">Choose officer</option>@for (u of officers(report.submittingDivisionId); track u.id) { <option [value]="u.id">{{ u.name }}</option> }</select></label>
          <label class="report-field"><span>Frequency</span><select name="frequency" [(ngModel)]="report.frequency">@for (f of frequencies; track f) { <option [value]="f">{{ f }}</option> }</select></label>
          <label class="report-field"><span>Main deadline time</span><input name="dueTime" type="time" [(ngModel)]="report.dueTime" required></label>
          <label class="report-field"><span>Deadline lead days</span><input name="componentDeadlineOffsetDays" type="number" min="0" max="365" [(ngModel)]="report.componentDeadlineOffsetDays" required></label>
          <app-submission-destination-picker class="report-description" [recipients]="submissionRecipients()" [destination]="report"
            [disabled]="busy()" (destinationChange)="updateReportDestination($event)" />
          <details class="report-optional report-description"><summary>Optional fields</summary>
            <div class="form-grid">
          <label class="report-field"><span>Deputy submitting officer (optional)</span><select name="deputySubmittingOfficerId" [(ngModel)]="report.deputySubmittingOfficerId"><option value="">None</option>@for (u of deputySubmitters(); track u.id) { <option [value]="u.id">{{ u.name }}</option> }</select></label>
          <label class="report-field"><span>Instruction reference</span><input name="instructionReference" [(ngModel)]="report.instructionReference" maxlength="250"></label>
          <label class="report-description report-field"><span>Description</span><textarea name="description" [(ngModel)]="report.description" maxlength="1000" rows="2"></textarea></label>
            </div>
          </details>
          @if (error()) { <div class="error-banner report-description" role="alert">{{ error() }}</div> }
          <div class="setup-actions"><button class="secondary" type="button" [disabled]="busy()" (click)="selectTab('reports')">Cancel</button><button class="primary" type="submit" [disabled]="busy() || reportForm.invalid || !validDestination(report)">{{ busy() ? 'Saving…' : 'Create report' }}</button></div>
        </form>
            </article>
        </section>
        <section class="profile-panel" role="tabpanel" id="setup-panel-profile" aria-labelledby="setup-tab-profile" [hidden]="activeTab()!=='profile'">
          @if (activeTab() === 'profile') {
            @if (selectedReport(); as selected) {
              <app-report-profile [report]="selected" [lookups]="lookups()" [recipients]="submissionRecipients()" />
            } @else { <p class="setup-empty">Choose a report to view its profile.</p> }
          }
        </section>
        <section class="setup-tab-panel" role="tabpanel" id="setup-panel-components" aria-labelledby="setup-tab-components" [hidden]="activeTab()!=='components'">
          @if (selectedReport(); as selected) {
            @if (componentsOpened()) {
              <app-report-component-editor [lookups]="lookups()" [reports]="reports()" [initialReportId]="selected.id" [embedded]="true" />
            }
          } @else { <p class="setup-empty">Choose a report to view or add components.</p> }
        </section>
        <section class="setup-tab-panel" role="tabpanel" id="setup-panel-cycles" aria-labelledby="setup-tab-cycles" [hidden]="activeTab()!=='cycles'">
          @if (selectedReport()) {
            <article class="setup-card setup-editor report-inline-layout"><h3>Reporting cycles</h3>
        <form class="report-inline-fields" #cycleForm="ngForm" (ngSubmit)="addCycle(cycleForm)">
            @if (cyclesLoading()) { <p class="cycle-state" role="status">Loading saved reporting cycles…</p> }
            @if (cycleLoadError()) { <div class="error-banner cycle-state" role="alert">{{ cycleLoadError() }} <button type="button" (click)="selectReport(cycle.reportId)">Retry loading cycles</button></div> }
            @if (cycle.reportId && !cyclesLoading() && !cycleLoadError()) {
              <label class="report-field"><span>Saved cycle</span><select name="savedCycleId" [ngModel]="savedCycleId" (ngModelChange)="selectCycle($event)"><option value="">Create a new manual cycle</option>@for (saved of savedCycles(); track saved.id) { <option [value]="saved.id">{{ saved.periodLabel }} ({{ saved.periodKey }})</option> }</select></label>
              @if (!savedCycleId) { <p class="cycle-notice" role="status">{{ savedCycles().length ? 'Enter a new reporting period below. Existing cycles are available in Saved cycle.' : 'No saved cycles exist for this report. Enter a period to create one manually.' }}</p> }
              <fieldset class="cycle-details" [disabled]="!!savedCycleId">
              <div class="form-grid"><label class="report-field"><span>Period key</span><input name="periodKey" [(ngModel)]="cycle.periodKey" required maxlength="80" placeholder="e.g. 2026-10"></label><label class="report-field"><span>Period label</span><input name="periodLabel" [(ngModel)]="cycle.periodLabel" required maxlength="150" placeholder="e.g. October 2026"></label><label class="report-field"><span>Period start</span><input name="periodStart" type="date" [(ngModel)]="cycle.periodStart" required></label><label class="report-field"><span>Period end</span><input name="periodEnd" type="date" [(ngModel)]="cycle.periodEnd" required></label></div>
              @if (!savedCycleId && cycleAssignmentsMissing()) { <p class="error-banner" role="alert">Complete the submitting division, assigned officers and recipients in Report Configuration and Components and Responsibilities before creating this cycle.</p> }
              <div class="form-grid">
              @for (task of tasks; track $index; let i = $index) {
                <label class="report-field"><span>{{ task.type === 'BB' ? 'Final submission deadline (Asia/Dhaka)' : task.name + ' deadline (Asia/Dhaka)' }}</span><input type="datetime-local" [name]="'due'+i" [(ngModel)]="task.dueLocal" required></label>
              }
              </div>
              @if (!savedCycleId) { <div class="setup-actions"><button class="primary" type="submit" [disabled]="busy() || cycleForm.invalid || cycleAssignmentsMissing()">Create cycle manually</button></div> }</fieldset>
            }
          </form>
            </article>
          } @else { <p class="setup-empty">Choose a report to view or create reporting cycles.</p> }
        </section>
      </section>
    }
  `
})
export class WorkspaceSetupComponent implements OnInit, OnDestroy {
  protected readonly tabs: {id:SetupTab; label:string}[] = [
    {id:'reports',label:'Directory'}, {id:'create',label:'Create'}, {id:'cycles',label:'Cycles'},
    {id:'components',label:'Components'}, {id:'profile',label:'Profile'}
  ];
  protected readonly activeTab = signal<SetupTab>('reports');
  protected readonly selectedReportId = signal('');
  protected readonly selectedReport = computed(() => this.reports().find(report => report.id === this.selectedReportId()));
  protected readonly componentsOpened = signal(false);
  private readonly componentEditor = viewChild(ReportComponentEditorComponent);
  readonly mode = input.required<string>();
  readonly changed = output<void>();
  private readonly api = inject(DashboardService);
  private readonly session = inject(SessionService);
  protected readonly lookups = signal<Lookups>({ divisions: [], officers: [] });
  protected readonly submissionRecipients = signal<SubmissionRecipient[]>([]);
  protected readonly reports = signal<ReportDefinition[]>([]);
  protected readonly users = signal<UserItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly divisionToast = signal('');
  private divisionToastTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly frequencies = ['Daily', 'Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'HalfYearly', 'Yearly', 'AdHoc'];
  protected division = { code: '', name: '' };
  protected user = { employeeId: '', displayName: '', email: '', mobileNumber: '', divisionId: '', password: '', isCoordinator: false };
  protected report = this.emptyReport();
  protected cycle = { reportId: '', periodKey: '', periodLabel: '', periodStart: '', periodEnd: '' };
  protected tasks = [this.newTask()];
  protected readonly savedCycles = signal<ReportingCycle[]>([]);
  protected readonly cyclesLoading = signal(false);
  protected readonly cycleLoadError = signal('');
  protected savedCycleId = '';
  private cycleRequest?: Subscription;
  ngOnInit() { this.load(); }
  ngOnDestroy() { clearTimeout(this.divisionToastTimer); this.cycleRequest?.unsubscribe(); }
  protected officers(divisionId: string) { return this.lookups().officers.filter(u => u.divisionId === divisionId); }
  protected load(showLoading = true) {
    if (showLoading) this.loading.set(true);
    this.error.set('');
    forkJoin({ lookups: this.api.lookups(), reports: this.api.reports(), recipients: this.mode() === 'Administration' ? of([]) : this.api.submissionRecipients() }).subscribe({ next: data => {
      this.lookups.set(data.lookups); this.reports.set(data.reports); this.submissionRecipients.set(data.recipients); this.loading.set(false);
      if (!data.reports.some(row => row.id === this.selectedReportId())) this.selectedReportId.set(data.reports[0]?.id ?? '');
      if (this.activeTab() === 'cycles' && this.cycle.reportId !== this.selectedReportId()) this.selectReport(this.selectedReportId());
      if (this.mode() === 'Administration') this.api.users().subscribe({ next: users => this.users.set(users), error: error => this.error.set(apiError(error)) });
    }, error: error => { this.loading.set(false); this.error.set(apiError(error)); } });
  }
  protected hasDivision(id: string) { return this.lookups().divisions.some(d => d.id === id); }
  protected hasOfficer(divisionId: string, id: string) { return this.officers(divisionId).some(u => u.id === id); }
  protected selectReport(reportId: string) {
    this.cycleRequest?.unsubscribe();
    this.cycle = { reportId, periodKey: '', periodLabel: '', periodStart: '', periodEnd: '' };
    this.savedCycleId = ''; this.savedCycles.set([]); this.cycleLoadError.set('');
    this.resetCycleDraft(); this.cyclesLoading.set(!!reportId);
    if (!reportId) return;
    this.cycleRequest = this.api.cycles(reportId).subscribe({
      next: cycles => {
        this.savedCycles.set(cycles); this.cyclesLoading.set(false);
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const current = cycles.find(c => c.periodStart <= today && c.periodEnd >= today);
        const previous = cycles.find(c => c.periodStart <= today);
        this.selectCycle((current ?? previous ?? cycles.at(-1))?.id ?? '');
      },
      error: error => { this.cyclesLoading.set(false); this.cycleLoadError.set(apiError(error)); }
    });
  }
  protected selectCycle(id: string) {
    const saved = this.savedCycles().find(c => c.id === id);
    this.savedCycleId = saved?.id ?? '';
    if (!saved) { this.resetCycleDraft(); return; }
    this.cycle = { reportId: this.cycle.reportId, periodKey: saved.periodKey, periodLabel: saved.periodLabel, periodStart: saved.periodStart, periodEnd: saved.periodEnd };
    this.tasks = saved.obligations.map(task => ({ ...task, receivingDivisionId: task.receivingDivisionId ?? '', primaryOfficerId: task.primaryOfficerId ?? '', deputyOfficerId: task.deputyOfficerId ?? '',
      primaryOfficerName: task.primaryOfficerName ?? 'Unassigned', deputyOfficerName: task.deputyOfficerName ?? '',
      dueLocal: new Date(new Date(task.dueAtUtc).getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 16) }));
  }
  private resetCycleDraft() {
    const report = this.reports().find(r => r.id === this.cycle.reportId);
    this.cycle = { ...this.cycle, periodKey: '', periodLabel: '', periodStart: '', periodEnd: '' };
    const task = this.newTask();
    if (report) {
      task.recipient = report.submissionDestination ?? report.bbRecipient; task.divisionId = report.submittingDivisionId ?? ''; task.primaryOfficerId = report.primarySubmittingOfficerId ?? ''; task.deputyOfficerId = report.deputySubmittingOfficerId ?? '';
      if (!this.hasOfficer(task.divisionId, task.primaryOfficerId)) task.primaryOfficerId = '';
    }
    this.tasks = [task];
  }
  protected cycleAssignmentsMissing() { return this.tasks.some(task=>!task.divisionId || !task.primaryOfficerId || !this.hasOfficer(task.divisionId,task.primaryOfficerId) || !task.recipient.trim() || (task.deputyOfficerId && !this.hasOfficer(task.divisionId,task.deputyOfficerId)) || (task.type==='Internal' && task.receiptRequired && !task.receivingDivisionId)); }
  protected divisionName(id: string | null) { return this.lookups().divisions.find(d => d.id === id)?.name ?? 'Not configured'; }
  protected workspaceBusy() { return this.busy() || (this.componentEditor()?.isSaving() ?? false); }
  protected recipientName(report: ReportDefinition) {
    return this.submissionRecipients().find(item => item.id === report.submissionRecipientId)?.name ?? report.bbRecipient;
  }
  protected chooseReport(id: string) {
    if (this.workspaceBusy() || id === this.selectedReportId()) return;
    this.selectedReportId.set(id);
    this.error.set('');
    if (this.activeTab() === 'cycles') this.selectReport(id);
  }
  protected openReportTab(id: string, tab: SetupTab) {
    if (this.workspaceBusy()) return;
    this.chooseReport(id);
    this.selectTab(tab);
  }
  protected selectTab(tab: SetupTab) {
    if (this.workspaceBusy()) return;
    if (tab !== this.activeTab()) this.error.set('');
    if (tab === 'components') this.componentsOpened.set(true);
    if (tab === 'cycles' && this.cycle.reportId !== this.selectedReportId()) this.selectReport(this.selectedReportId());
    this.activeTab.set(tab);
  }
  protected onTabKey(event: KeyboardEvent, index: number) {
    const last = this.tabs.length - 1;
    const next = event.key === 'ArrowRight' ? (index + 1) % this.tabs.length
      : event.key === 'ArrowLeft' ? (index + last) % this.tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (next === null || this.workspaceBusy()) return;
    event.preventDefault();
    this.selectTab(this.tabs[next].id);
    (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
  }
  private emptyReport() { return { code: '', name: '', ownerDivisionId: this.session.user()?.divisionId ?? '', receivingDivisionId: '', submittingDivisionId: '', primarySubmittingOfficerId: '', deputySubmittingOfficerId: '', submissionRecipientId: '', submissionDepartmentIds: [] as string[], frequency: 'Monthly', dueTime: '17:00', componentDeadlineOffsetDays: 1, instructionReference: '', description: '' }; }
  protected addDivision(form: NgForm) {
    if (form.invalid || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.message.set(''); this.dismissDivisionToast();
    this.api.createDivision({ code: this.division.code.trim(), name: this.division.name.trim() }).subscribe({
      next: () => {
        this.busy.set(false); this.division = { code: '', name: '' }; this.message.set('Division created.');
        this.changed.emit(); this.load();
      },
      error: error => {
        this.busy.set(false);
        this.divisionToast.set(apiError(error));
        this.divisionToastTimer = setTimeout(() => this.divisionToast.set(''), 8000);
      }
    });
  }
  protected dismissDivisionToast() { clearTimeout(this.divisionToastTimer); this.divisionToast.set(''); }
  protected addUser(form: NgForm) { if (form.invalid || this.busy()) return; this.save(this.api.createUser(this.user), 'User created.', () => { this.user = { employeeId: '', displayName: '', email: '', mobileNumber: '', divisionId: '', password: '', isCoordinator: false }; }); }
  protected toggleUser(user:UserItem){this.save(this.api.changeUserStatus(user.id,!user.isActive),`User ${user.isActive?'deactivated':'activated'}.`,()=>{});}
  protected resetUserPassword(user:UserItem){const password=window.prompt(`Enter a temporary password for ${user.displayName} (minimum 12 characters):`);if(!password)return;if(password.length<12){this.error.set('Temporary password must contain at least 12 characters.');return;}this.save(this.api.resetPassword(user.id,password),'Password reset completed.',()=>{});}
  protected validDestination(destination: SubmissionDestination) {
    const recipient = this.submissionRecipients().find(r => r.id === destination.submissionRecipientId);
    return !!recipient && destination.submissionDepartmentIds.length > 0
      && destination.submissionDepartmentIds.every(id => recipient.departments.some(department => department.id === id));
  }
  protected updateReportDestination(destination: SubmissionDestination) {
    this.report = {...this.report, ...destination};
  }
  protected selectFinalSubmitter(id: string) {
    this.report.primarySubmittingOfficerId = id;
    if (this.report.deputySubmittingOfficerId === id) this.report.deputySubmittingOfficerId = '';
  }
  protected deputySubmitters() {
    return this.officers(this.report.submittingDivisionId).filter(person => person.id !== this.report.primarySubmittingOfficerId);
  }
  protected addReport(form: NgForm) {
    if (form.invalid || !this.validDestination(this.report) || this.busy()) return;
    if (this.report.primarySubmittingOfficerId === this.report.deputySubmittingOfficerId) {
      this.error.set('Choose a different deputy submitting officer or select None.');
      return;
    }
    const dueTime = this.report.dueTime.length === 5 ? this.report.dueTime + ':00' : this.report.dueTime;
    this.save(this.api.createReport({...this.report,dueTime,deputySubmittingOfficerId:this.report.deputySubmittingOfficerId || null}), 'Report created.', saved => { this.report=this.emptyReport(); this.selectedReportId.set(saved.id); this.selectTab('reports'); });
  }
  protected addCycle(form: NgForm) {
    if (form.invalid || this.busy() || this.cycleAssignmentsMissing()) return;
    if (this.savedCycleId || this.cyclesLoading() || this.cycleLoadError() || !this.cycle.reportId) return;
    const obligations = this.tasks.map(task => ({ ...task, receivingDivisionId: task.type === 'Internal' ? task.receivingDivisionId || null : null, deputyOfficerId: task.deputyOfficerId || null, dueAtUtc: new Date(task.dueLocal + '+06:00').toISOString() }));
    this.save(this.api.createCycle(this.cycle.reportId, { ...this.cycle, obligations }), 'Reporting cycle created. Obligations are now available in the trackers.', () => { this.selectReport(this.cycle.reportId); });
  }
  private newTask() { return { name: 'Final submission', type: 'BB', divisionId: this.session.user()?.divisionId ?? '', primaryOfficerId: this.session.user()?.id ?? '', deputyOfficerId: '', receivingDivisionId: '', divisionName: '', primaryOfficerName: '', deputyOfficerName: '', recipient: '', dueLocal: '', receiptRequired: false, evidenceRequired: false }; }
  private save<T>(request: Observable<T>, message: string, reset: (value:T) => void) {
    this.busy.set(true); this.error.set(''); this.message.set('');
    request.subscribe({ next: value => { this.busy.set(false); reset(value); this.message.set(message); this.changed.emit(); this.load(this.mode() === 'Administration'); }, error: error => { this.busy.set(false); this.error.set(apiError(error)); } });
  }
}


