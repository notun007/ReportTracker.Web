import { Component, OnInit, OnDestroy, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { forkJoin, Observable, of, Subscription, switchMap } from 'rxjs';
import { DashboardService, SessionService, apiError } from './dashboard.service';
import { Lookups, ReportDefinition, ReportingCycle, SubmissionDestination, SubmissionRecipient, UserItem } from './dashboard.models';

import { SubmissionDestinationPickerComponent } from './submission-destination-picker.component';
import { SubmissionRecipientAdminComponent } from './submission-recipient-admin.component';
import { ReportComponentDraft, ReportComponentEditorComponent } from './report-component-editor.component';

@Component({
  selector: 'app-workspace-setup', imports: [FormsModule, ReportComponentEditorComponent, SubmissionDestinationPickerComponent, SubmissionRecipientAdminComponent],
  styles: [`.cycle-assignment { display:grid; align-content:start; gap:6px; padding:10px; border:1px solid var(--line); border-radius:5px; background:var(--surface); } .cycle-assignment strong { font-size:12px; } .cycle-details { display:grid; gap:14px; min-width:0; margin:0; padding:0; border:0; } .cycle-notice { margin:0; color:var(--muted); line-height:1.5; } .component-drawer { position:fixed; inset:0 0 0 auto; margin:0; width:min(920px,100vw); max-width:100vw; height:100dvh; max-height:100dvh; padding:0; border:0; border-left:1px solid var(--line); background:white; } .component-drawer::backdrop { background:#0b24475c; } .report-setup-content { grid-template-columns:minmax(0,1fr); } .report-drawer { position:fixed; inset:0 0 0 auto; margin:0; width:min(920px,100vw); max-width:100vw; height:100dvh; max-height:100dvh; padding:0; border:0; border-left:1px solid var(--line); background:white; color:var(--ink); } .report-drawer::backdrop { background:#0b24475c; } .report-drawer .report-editor { padding:28px; border:0; border-radius:0; margin:0; box-shadow:none; } .report-drawer-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; } .report-editor .report-drawer-heading { margin-bottom:16px; } .report-drawer-heading h2 { margin:0; font-size:22px; } .report-editor>form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; } .report-editor label { min-width:0; } .report-description,.report-drawer-actions { grid-column:1 / -1; } .report-drawer-actions { display:flex; gap:12px; justify-content:flex-end; position:sticky; bottom:-28px; background:white; padding:16px 0; border-top:1px solid var(--line); } @media(max-width:640px) { .report-drawer .report-editor { padding:18px; } .report-editor>form { grid-template-columns:minmax(0,1fr); } .report-drawer-actions { bottom:-18px; } .page-intro { flex-wrap:wrap; gap:12px; } } .cycle-drawer .cycle-card { padding:28px; border:0; border-radius:0; margin:0; box-shadow:none; } .cycle-drawer .cycle-card>p { color:var(--muted); line-height:1.6; } .cycle-close { margin-top:18px; } .cycle-actions { position:sticky; bottom:-28px; background:white; padding:14px 0; border-top:1px solid var(--line); } .page-intro>.form-actions { flex-wrap:wrap; } .reports-grid td { vertical-align:top; } .reports-grid .link-button { white-space:nowrap; display:block; margin:4px 0; } @media(max-width:640px) { .cycle-drawer .cycle-card { padding:18px; } .cycle-actions { bottom:-18px; flex-wrap:wrap; } } .cycle-card>form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; align-items:start; } .cycle-card>form>p,.cycle-card>form>.error-banner,.cycle-card>form>.cycle-details { grid-column:1 / -1; } .cycle-card label,.cycle-card .cycle-assignment { min-width:0; } .cycle-card .form-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } @media(max-width:760px) { .cycle-card>form,.cycle-card .form-grid { grid-template-columns:minmax(0,1fr); } }
    .report-drawer .report-editor { padding:0; background:#f5f8fc; min-height:100%; }
    .report-editor .report-drawer-heading {
      position:sticky; top:0; z-index:2; margin:0; padding:20px 28px;
      border-bottom:1px solid #d6e4f2; background:linear-gradient(115deg,#fff 10%,#ebf4ff 100%);
      box-shadow:0 3px 10px #173d6210;
    }
    .report-editor .report-drawer-heading h2 { font-size:24px; letter-spacing:-.025em; color:#12375f; }
    .report-editor>form { padding:22px 28px 0; gap:14px 18px; align-items:start; }
    .report-editor .error-banner { margin:12px 28px 0; }
    .report-editor .report-drawer-actions {
      z-index:1; bottom:0; margin:2px -28px 0; padding:14px 28px;
      background:linear-gradient(180deg,#fff,#f0f6fd); border-color:#d6e4f2;
      box-shadow:0 -5px 16px #173d620b;
    }
    @media(max-width:640px) {
      .report-editor .report-drawer-heading { padding:14px 18px; }
      .report-editor .report-drawer-heading h2 { font-size:22px; }
      .report-editor>form { padding:16px 18px 0; gap:12px; }
      .report-editor .report-drawer-actions { margin-inline:-18px; padding:12px 18px; }
      .report-editor .error-banner { margin-inline:18px; }
    }
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
      <section class="page-intro"><div><h2>Report setup</h2><p>Manage report definitions, components and reporting cycles.</p></div><div class="form-actions"><button class="secondary" type="button" (click)="openCyclePanel()" [disabled]="busy()">Create reporting cycle</button><button class="secondary" type="button" (click)="openComponentPanel()" [disabled]="busy()">Create component</button><button class="primary" type="button" (click)="openReportPanel()" [disabled]="busy()">Create report</button></div></section>
      <section class="tracker-panel reports-grid" aria-label="Reports"><div class="panel-heading"><h3>Reports ({{ reports().length }})</h3></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Report</th><th>Frequency</th><th>Coordinating division</th><th>Receiving division</th><th>Final submitting division</th><th>Submission recipient</th><th>Cycles</th><th>Actions</th></tr></thead><tbody>@for (r of reports(); track r.id) { <tr><td>{{ r.code }}</td><td>{{ r.name }}</td><td>{{ r.frequency }}</td><td>{{ divisionName(r.ownerDivisionId) }}</td><td>{{ divisionName(r.receivingDivisionId) }}</td><td>{{ divisionName(r.submittingDivisionId) }}@if (!r.primarySubmittingOfficerId) { <span>Submitting officer required</span> }</td><td>{{ r.submissionDestination ?? r.bbRecipient }}</td><td>{{ r.cycleCount }}</td><td><button class="link-button" type="button" (click)="openCyclePanel(r.id)" [attr.aria-label]="'Reporting cycles for ' + r.code">Reporting cycles</button><button class="link-button" type="button" (click)="openComponentPanel(null,r.id)" [disabled]="busy()" [attr.aria-label]="'Create component for ' + r.code">Create component</button><button class="link-button" type="button" (click)="openDestinationPanel(r)" [disabled]="busy()" [attr.aria-label]="'Submission destination for ' + r.code">Submission destination</button></td></tr> } @empty { <tr><td colspan="9" class="empty">No reports configured yet.</td></tr> }</tbody></table></div></section>
    }
    <dialog #cycleDrawer class="report-drawer cycle-drawer" aria-labelledby="cycle-editor-title" (cancel)="closeCyclePanel($event)">
        <article class="setup-card cycle-card"><header class="report-drawer-heading"><h2 id="cycle-editor-title">Create reporting cycle</h2><button class="icon-button" type="button" aria-label="Close cycle panel" [disabled]="busy()" (click)="closeCyclePanel()">×</button></header>@if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }
          @if (reports().length === 0) { <p>Create a report definition first.</p> }
          @else { <form #cycleForm="ngForm" (ngSubmit)="addCycle(cycleForm)">
            <label>Report<select name="reportId" [ngModel]="cycle.reportId" (ngModelChange)="selectReport($event)" required><option value="">Choose report</option>@for (r of reports(); track r.id) { <option [value]="r.id">{{ r.code }} — {{ r.name }}</option> }</select></label>
            @if (cyclesLoading()) { <p role="status">Loading saved reporting cycles…</p> }
            @if (cycleLoadError()) { <div class="error-banner" role="alert">{{ cycleLoadError() }} <button type="button" (click)="selectReport(cycle.reportId)">Retry loading cycles</button></div> }
            @if (cycle.reportId && !cyclesLoading() && !cycleLoadError()) {
              <label>Saved cycle<select name="savedCycleId" [ngModel]="savedCycleId" (ngModelChange)="selectCycle($event)"><option value="">Create a new manual cycle</option>@for (saved of savedCycles(); track saved.id) { <option [value]="saved.id">{{ saved.periodLabel }} ({{ saved.periodKey }})</option> }</select></label>
              @if (!savedCycleId) { <p class="cycle-notice" role="status">{{ savedCycles().length ? 'Enter a new reporting period below. Existing cycles are available in Saved cycle.' : 'No saved cycles exist for this report. Enter a period to create one manually.' }}</p> }
              <fieldset class="cycle-details" [disabled]="!!savedCycleId">
              <div class="form-grid"><label>Period key<input name="periodKey" [(ngModel)]="cycle.periodKey" required maxlength="80" placeholder="e.g. 2026-10"></label><label>Period label<input name="periodLabel" [(ngModel)]="cycle.periodLabel" required maxlength="150" placeholder="e.g. October 2026"></label><label>Period start<input name="periodStart" type="date" [(ngModel)]="cycle.periodStart" required></label><label>Period end<input name="periodEnd" type="date" [(ngModel)]="cycle.periodEnd" required></label></div>
              @if (!savedCycleId && cycleAssignmentsMissing()) { <p class="error-banner" role="alert">Complete the submitting division, assigned officers and recipients in Report Setup and Components and Responsibilities before creating this cycle.</p> }
              <div class="form-grid">
              @for (task of tasks; track $index; let i = $index) {
                <label>{{ task.type === 'BB' ? 'Final submission deadline (Asia/Dhaka)' : task.name + ' deadline (Asia/Dhaka)' }}<input type="datetime-local" [name]="'due'+i" [(ngModel)]="task.dueLocal" required></label>
              }
              </div>
              @if (!savedCycleId) { <div class="form-actions cycle-actions"><button class="primary" type="submit" [disabled]="busy() || cycleForm.invalid || cycleAssignmentsMissing()">Create cycle manually</button></div> }</fieldset>
            }
          </form> }
          <button class="secondary cycle-close" type="button" [disabled]="busy()" (click)="closeCyclePanel()">Close</button>
        </article>
    </dialog>
    <dialog #reportDrawer class="report-drawer" aria-labelledby="report-editor-title" (cancel)="closeReportPanel($event)">
        <article class="setup-card report-editor"><header class="report-drawer-heading"><h2 id="report-editor-title">Create report</h2><button class="icon-button" type="button" aria-label="Close report panel" [disabled]="busy()" (click)="closeReportPanel()">×</button></header>@if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }<form #reportForm="ngForm" (ngSubmit)="addReport(reportForm)">
          <label>Code<input name="code" [(ngModel)]="report.code" required maxlength="40"></label>
          <label>Report name<input name="name" [(ngModel)]="report.name" required maxlength="150"></label>
          <label>Coordinating division<select name="ownerDivisionId" [(ngModel)]="report.ownerDivisionId" required><option value="">Choose division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label>Receiving division<select name="reportReceivingDivision" [(ngModel)]="report.receivingDivisionId" required><option value="">Choose receiving division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label>Final submitting division<select name="submittingDivisionId" [(ngModel)]="report.submittingDivisionId" (ngModelChange)="report.primarySubmittingOfficerId = ''; report.deputySubmittingOfficerId = ''" required><option value="">Choose final submitting division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label>Final submitting officer<select name="primarySubmittingOfficerId" [(ngModel)]="report.primarySubmittingOfficerId" required><option value="">Choose officer</option>@for (u of officers(report.submittingDivisionId); track u.id) { <option [value]="u.id">{{ u.name }}</option> }</select></label>
          <label>Deputy submitting officer (optional)<select name="deputySubmittingOfficerId" [(ngModel)]="report.deputySubmittingOfficerId"><option value="">None</option>@for (u of officers(report.submittingDivisionId); track u.id) { <option [value]="u.id">{{ u.name }}</option> }</select></label>
          <app-submission-destination-picker [recipients]="submissionRecipients()" [destination]="report" [disabled]="busy()" (destinationChange)="updateReportDestination($event)" />
          @if (canAddDepartments() && report.submissionRecipientId) {
            <div class="report-description">
              @if (!showDepartmentEntry) {
                <button class="secondary" type="button" [disabled]="busy()" (click)="showDepartmentEntry = true">Add departments</button>
              } @else {
                <label>New departments (one name per line)
                  <textarea rows="3" maxlength="3020" [(ngModel)]="departmentNames" [ngModelOptions]="{standalone:true}" [disabled]="busy()"></textarea>
                </label>
                @if (departmentError()) { <div class="error-banner" role="alert">{{ departmentError() }}</div> }
                <div class="form-actions">
                  <button class="secondary" type="button" [disabled]="busy()" (click)="resetDepartmentEntry()">Cancel</button>
                  <button class="primary" type="button" [disabled]="busy() || !departmentNames.trim()" (click)="addReportDepartments()">Save departments</button>
                </div>
              }
            </div>
          }
          <label>Frequency<select name="frequency" [(ngModel)]="report.frequency">@for (f of frequencies; track f) { <option [value]="f">{{ f }}</option> }</select></label>
          <label>Main deadline time<input name="dueTime" type="time" [(ngModel)]="report.dueTime" required></label>
          <label>Deadline lead days<input name="componentDeadlineOffsetDays" type="number" min="0" max="365" [(ngModel)]="report.componentDeadlineOffsetDays" required></label>
          <label>Instruction reference<input name="instructionReference" [(ngModel)]="report.instructionReference" maxlength="250"></label>
          <label class="report-description">Description<textarea name="description" [(ngModel)]="report.description" maxlength="1000" rows="2"></textarea></label>
          <div class="report-drawer-actions"><button class="secondary" type="button" [disabled]="busy()" (click)="closeReportPanel()">Cancel</button><button class="primary" type="submit" [disabled]="busy() || reportForm.invalid || showDepartmentEntry || !validDestination(report)">{{ busy() ? 'Saving…' : 'Create report' }}</button></div>
        </form></article>
    </dialog>
    <dialog #destinationDialog class="modal" aria-labelledby="destination-editor-title" (cancel)="closeDestinationPanel($event)">
      @if (destinationReport(); as selectedReport) {
        <header class="modal-header"><div><h2 id="destination-editor-title">Submission destination</h2><p>{{ selectedReport.code }} — {{ selectedReport.name }}</p></div><button class="icon-button" type="button" aria-label="Close submission destination" [disabled]="busy()" (click)="closeDestinationPanel()">×</button></header>
        @if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }
        @if (destinationSaved()) { <div class="success-banner" role="status">Submission destination saved.</div> }
        <form class="setup-card" (ngSubmit)="saveDestination()">
          <app-submission-destination-picker [recipients]="submissionRecipients()" [destination]="destinationDraft()" [disabled]="busy()" (destinationChange)="changeDestinationDraft($event)" />
          <div class="modal-actions"><button class="secondary" type="button" [disabled]="busy()" (click)="closeDestinationPanel()">{{ destinationSaved() ? 'Close' : 'Cancel' }}</button><button class="primary" type="submit" [disabled]="busy() || destinationSaved() || !validDestination(destinationDraft())">Save submission destination</button></div>
        </form>
      }
    </dialog>
    <dialog #componentDrawer class="component-drawer" aria-labelledby="component-editor-title" (cancel)="closeComponentPanel($event)">
      <app-report-component-editor [lookups]="lookups()" [reports]="reports()" [drafts]="reportComponents()" [draftReceivingDivisionId]="report.receivingDivisionId" [reportName]="report.name" [defaultLeadDays]="report.componentDeadlineOffsetDays" [component]="editingComponent()" [sessionKey]="componentEditorSession()" [initialReportId]="componentReportId()" [error]="componentPanelError()" (saved)="saveComponentDraft($event)" (cancelled)="closeComponentPanel()" />
    </dialog>
  `
})
export class WorkspaceSetupComponent implements OnInit, OnDestroy {
  protected readonly reportComponents = signal<ReportComponentDraft[]>([]);
  protected readonly editingComponent = signal<ReportComponentDraft|null>(null);
  protected readonly componentEditorSession = signal(0);
  protected readonly componentReportId = signal('');
  protected readonly componentPanelError = signal('');
  private readonly cycleDrawer = viewChild<ElementRef<HTMLDialogElement>>('cycleDrawer');
  private readonly reportDrawer = viewChild<ElementRef<HTMLDialogElement>>('reportDrawer');
  private readonly componentDrawer = viewChild<ElementRef<HTMLDialogElement>>('componentDrawer');
  readonly mode = input.required<string>();
  readonly changed = output<void>();
  private readonly api = inject(DashboardService);
  private readonly session = inject(SessionService);
  protected readonly lookups = signal<Lookups>({ divisions: [], officers: [] });
  protected readonly submissionRecipients = signal<SubmissionRecipient[]>([]);
  protected readonly destinationReport = signal<ReportDefinition | null>(null);
  protected readonly destinationSaved = signal(false);
  protected readonly destinationDraft = signal<SubmissionDestination>({submissionRecipientId: '', submissionDepartmentIds: []});
  private readonly destinationDialog = viewChild<ElementRef<HTMLDialogElement>>('destinationDialog');
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
  protected load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ lookups: this.api.lookups(), reports: this.api.reports(), recipients: this.mode() === 'Administration' ? of([]) : this.api.submissionRecipients() }).subscribe({ next: data => {
      this.lookups.set(data.lookups); this.reports.set(data.reports); this.submissionRecipients.set(data.recipients); this.loading.set(false);
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
  protected preparingDivisions() { const ids = new Set(this.reportComponents().map(component => component.providerDivisionId)); return this.lookups().divisions.filter(division => ids.has(division.id)); }
  protected officerName(id:string) { return this.lookups().officers.find(officer => officer.id === id)?.name ?? 'Unassigned'; }
  protected openCyclePanel(reportId?:string) { if (reportId && reportId !== this.cycle.reportId) this.selectReport(reportId); this.cycleDrawer()?.nativeElement.showModal(); }
  protected closeCyclePanel(event?:Event) { event?.preventDefault(); if (!this.busy()) this.cycleDrawer()?.nativeElement.close(); }
  protected openReportPanel() { this.reportDrawer()?.nativeElement.showModal(); }
  protected closeReportPanel(event?:Event) { event?.preventDefault(); if (!this.busy()) this.reportDrawer()?.nativeElement.close(); }
  protected openComponentPanel(component:ReportComponentDraft|null = null, reportId = '') { this.componentReportId.set(reportId); this.editingComponent.set(component); this.componentPanelError.set(''); this.componentEditorSession.update(value => value+1); this.componentDrawer()?.nativeElement.showModal(); }
  protected closeComponentPanel(event?:Event) { event?.preventDefault(); this.componentDrawer()?.nativeElement.close(); }
  protected saveComponentDraft(component:ReportComponentDraft) {
    if (!this.editingComponent() && this.reportComponents().length >= 100) { this.componentPanelError.set('A report can contain up to 100 components.'); return; }
    if (this.reportComponents().some(row => row.clientId !== component.clientId && row.name.toLowerCase() === component.name.toLowerCase())) { this.componentPanelError.set('Choose a unique component name for this report.'); return; }
    this.reportComponents.update(rows => (rows.some(row => row.clientId === component.clientId) ? rows.map(row => row.clientId === component.clientId ? component : row) : [...rows,component]).sort((a,b) => a.sequence-b.sequence));
    this.closeComponentPanel();
  }
  protected removeComponent(id:string) { this.reportComponents.update(rows => rows.filter(component => component.clientId !== id)); }
  private emptyReport() { return { code: '', name: '', ownerDivisionId: this.session.user()?.divisionId ?? '', receivingDivisionId: '', submittingDivisionId: '', primarySubmittingOfficerId: '', deputySubmittingOfficerId: '', submissionRecipientId: '', submissionDepartmentIds: [] as string[], frequency: 'Monthly', dueTime: '17:00', componentDeadlineOffsetDays: 1, instructionReference: '', description: '' }; }
  protected taskTypeChanged(task: ReturnType<WorkspaceSetupComponent['newTask']>) {
    if (this.savedCycleId) return;
    task.primaryOfficerId = ''; task.deputyOfficerId = ''; task.divisionId = ''; task.receivingDivisionId = '';
    if (task.type === 'BB') {
      const report = this.reports().find(r => r.id === this.cycle.reportId);
      task.divisionId = report?.submittingDivisionId ?? ''; task.primaryOfficerId = report?.primarySubmittingOfficerId ?? ''; task.deputyOfficerId = report?.deputySubmittingOfficerId ?? ''; task.recipient = report?.submissionDestination ?? report?.bbRecipient ?? '';
    }
  }
  protected cycleReceiverId() { return this.reports().find(report => report.id === this.cycle.reportId)?.receivingDivisionId; }
  protected addTask() { this.tasks = [...this.tasks, { ...this.newTask(), type: 'Internal', name: '', receivingDivisionId: this.cycleReceiverId() ?? '', recipient: this.cycleReceiverId() ? this.divisionName(this.cycleReceiverId()!) : '' }]; }
  protected removeTask(index: number) { if (this.tasks.length > 1) this.tasks = this.tasks.filter((_, i) => i !== index); }
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
  protected canAddDepartments() { return this.session.user()?.permissions.includes('administration.manage') ?? false; }
  protected showDepartmentEntry = false;
  protected departmentNames = '';
  protected readonly departmentError = signal('');

  protected resetDepartmentEntry() {
    this.showDepartmentEntry = false; this.departmentNames = ''; this.departmentError.set('');
  }

  protected addReportDepartments() {
    const recipientId = this.report.submissionRecipientId;
    if (!recipientId || this.busy() || !this.canAddDepartments()) return;
    const names = this.departmentNames.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
    if (!names.length || names.length + this.report.submissionDepartmentIds.length > 20 || names.some(name => name.length > 150)) {
      this.departmentError.set('Enter names up to 150 characters each. A report can select up to 20 departments.');
      return;
    }
    this.busy.set(true); this.departmentError.set('');
    this.api.createSubmissionDepartments(recipientId, names).subscribe({
      next: departments => {
        this.submissionRecipients.update(rows => rows.map(row => row.id === recipientId
          ? {...row, departments: [...row.departments, ...departments].sort((a, b) => a.name.localeCompare(b.name))}
          : row));
        this.report = {...this.report, submissionDepartmentIds: [...this.report.submissionDepartmentIds, ...departments.map(x => x.id)]};
        this.resetDepartmentEntry(); this.busy.set(false);
      },
      error: error => { this.departmentError.set(apiError(error)); this.busy.set(false); }
    });
  }

  protected updateReportDestination(destination: SubmissionDestination) {
    if (this.report.submissionRecipientId !== destination.submissionRecipientId) this.resetDepartmentEntry();
    this.report = {...this.report, ...destination};
  }
  protected openDestinationPanel(report: ReportDefinition) {
    this.error.set(''); this.destinationSaved.set(false); this.destinationReport.set(report);
    this.destinationDraft.set({submissionRecipientId: report.submissionRecipientId ?? '', submissionDepartmentIds: report.submissionDepartmentIds ?? []});
    this.destinationDialog()?.nativeElement.showModal();
  }
  protected closeDestinationPanel(event?: Event) {
    event?.preventDefault();
    if (!this.busy()) this.destinationDialog()?.nativeElement.close();
  }
  protected changeDestinationDraft(destination: SubmissionDestination) {
    this.destinationSaved.set(false); this.error.set(''); this.destinationDraft.set(destination);
  }
  protected saveDestination() {
    const report = this.destinationReport(), destination = this.destinationDraft();
    if (!report || this.busy() || this.destinationSaved() || !this.validDestination(destination)) return;
    this.busy.set(true); this.error.set('');
    this.api.setSubmissionDestination(report.id, destination).pipe(switchMap(() => this.api.reports())).subscribe({
      next: reports => {
        this.busy.set(false);
        this.reports.set(reports);
        const saved = reports.find(row => row.id === report.id);
        const ids = saved?.submissionDepartmentIds ?? [];
        if (!saved || saved.submissionRecipientId !== destination.submissionRecipientId ||
            ids.length !== destination.submissionDepartmentIds.length || !destination.submissionDepartmentIds.every(id => ids.includes(id))) {
          this.error.set('The server did not return the selected departments. Review your choices and try saving again.');
          return;
        }
        this.destinationReport.set(saved);
        this.destinationSaved.set(true);
        if (this.cycle.reportId === report.id) this.selectReport('');
        this.changed.emit();
      },
      error: error => { this.busy.set(false); this.error.set(apiError(error)); }
    });
  }
  protected addReport(form: NgForm) {
    if (form.invalid || this.showDepartmentEntry || !this.validDestination(this.report) || this.busy() || this.componentDrawer()?.nativeElement.open) return;
    const components = this.reportComponents().map(({clientId,...component}) => ({...component,deputyOfficerId:component.deputyOfficerId || null}));
    const dueTime = this.report.dueTime.length === 5 ? this.report.dueTime + ':00' : this.report.dueTime;
    this.save(this.api.createReport({...this.report,dueTime,components,deputySubmittingOfficerId:this.report.deputySubmittingOfficerId || null}), 'Report and components created.', () => { this.closeReportPanel(); this.report=this.emptyReport(); this.reportComponents.set([]); form.resetForm(this.report); });
  }
  protected addCycle(form: NgForm) {
    if (form.invalid || this.busy() || this.cycleAssignmentsMissing()) return;
    if (this.savedCycleId || this.cyclesLoading() || this.cycleLoadError() || !this.cycle.reportId) return;
    const obligations = this.tasks.map(task => ({ ...task, receivingDivisionId: task.type === 'Internal' ? task.receivingDivisionId || null : null, deputyOfficerId: task.deputyOfficerId || null, dueAtUtc: new Date(task.dueLocal + '+06:00').toISOString() }));
    this.save(this.api.createCycle(this.cycle.reportId, { ...this.cycle, obligations }), 'Reporting cycle created. Obligations are now available in the trackers.', () => { this.closeCyclePanel(); this.selectReport(this.cycle.reportId); });
  }
  private newTask() { return { name: 'Final submission', type: 'BB', divisionId: this.session.user()?.divisionId ?? '', primaryOfficerId: this.session.user()?.id ?? '', deputyOfficerId: '', receivingDivisionId: '', divisionName: '', primaryOfficerName: '', deputyOfficerName: '', recipient: '', dueLocal: '', receiptRequired: false, evidenceRequired: false }; }
  private save(request: Observable<unknown>, message: string, reset: () => void) {
    this.busy.set(true); this.error.set(''); this.message.set('');
    request.subscribe({ next: () => { this.busy.set(false); reset(); this.message.set(message); this.changed.emit(); this.load(); }, error: error => { this.busy.set(false); this.error.set(apiError(error)); } });
  }
}


