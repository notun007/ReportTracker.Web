import { Component, OnInit, OnDestroy, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { forkJoin, Observable, Subscription } from 'rxjs';
import { DashboardService, SessionService, apiError } from './dashboard.service';
import { Lookups, ReportDefinition, ReportingCycle, SubmissionDestination, SubmissionRecipient } from './dashboard.models';

import { SubmissionDestinationPickerComponent } from './submission-destination-picker.component';
import { ReportComponentEditorComponent } from './report-component-editor.component';
import { ReportProfileComponent } from './report-profile.component';
import { YearlyCycleGeneratorComponent } from './yearly-cycle-generator.component';

type SetupTab = 'reports' | 'create' | 'profile' | 'components' | 'cycles';
type CycleView = 'list' | 'generate';
type CycleEditorMode = 'list' | 'detail' | 'manual';

const reportFrequencyByCode = new Map([
  ['weekly', 'Weekly'],
  ['twice-monthly', 'Biweekly'],
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['half-yearly', 'HalfYearly'],
  ['yearly', 'Yearly']
]);

@Component({
  selector: 'app-workspace-setup', imports: [FormsModule, ReportComponentEditorComponent, ReportProfileComponent, SubmissionDestinationPickerComponent, YearlyCycleGeneratorComponent],
  styles: [`
    .cycle-details { display:grid; gap:14px; min-width:0; margin:0; padding:0; border:0; }
    .cycle-create-action { justify-self:end; }
    .cycle-notice { margin:0; color:var(--muted); }
    .cycle-list-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:14px; }
    .cycle-list-head h3 { margin:0 0 4px; }
    .cycle-list-head p { margin:0; color:var(--muted); }
    .cycle-list-actions { display:flex; align-items:end; gap:8px; flex-wrap:wrap; }
    .cycle-year { min-width:125px; }
    .setup-tab-panel.cycle-panel { max-height:none; overflow:visible; }
    .cycle-table-wrap { overflow:visible; }
    .cycle-table { min-width:0; table-layout:fixed; }
    .cycle-table th,.cycle-table td { padding-inline:10px; }
    .cycle-table th:nth-child(1) { width:30%; }
    .cycle-table th:nth-child(2),.cycle-table th:nth-child(3) { width:21%; }
    .cycle-table th:nth-child(4) { width:10%; }
    .cycle-table th:nth-child(5) { width:18%; }
    .cycle-table td:last-child,.cycle-table th:last-child { text-align:right; }
    .cycle-editor-head { display:flex; align-items:center; gap:10px; grid-column:1/-1; }
    .cycle-editor-head h3 { margin:0; }
    .cycle-editor-head button { min-width:auto; padding:7px 10px; color:var(--muted); background:transparent; border:0; }
    .cycle-year-context { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:12px 14px; border:1px solid var(--line); border-radius:8px; background:var(--surface-soft,#f7faff); }
    .cycle-year-context strong { display:block; margin-bottom:3px; }
    .cycle-year-context span { color:var(--muted); font-size:.9rem; }
    .cycle-year-context .cycle-periods { max-width:58%; text-align:right; }
    .cycle-conflict { margin:0; }
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
    @media(max-width:640px) { .setup-editor { padding:14px 12px 0; } .setup-editor>form { grid-template-columns:minmax(0,1fr); }.cycle-list-head { align-items:stretch; flex-direction:column; }.cycle-list-actions>* { flex:1; } }
  `],

  template: `
    @if (error()) { <div class="error-banner" role="alert">{{ error() }} <button type="button" (click)="load()">Retry</button></div> }
    @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
    @if (loading()) { <p class="loading">Loading workspace setup…</p> }
    @else {
      <section class="report-workspace">
        <div class="report-tabbar report-toolbar">
          <div class="report-tabs" role="tablist" aria-label="Report configuration sections">
            @for (tab of tabs; track tab.id; let i=$index) {
              <button type="button" role="tab" [id]="'setup-tab-'+tab.id" [attr.aria-controls]="'setup-panel-'+tab.id"
                [attr.aria-selected]="activeTab()===tab.id" [attr.tabindex]="activeTab()===tab.id ? 0 : -1"
                (click)="selectTab(tab.id)" (keydown)="onTabKey($event,i)">{{ tab.label }}</button>
            }
          </div>
          @if (activeTab() !== 'create') {
            <div class="report-context">
              <label>
                <span class="sr-only">Selected report</span>
                <select name="workspaceReport" [ngModel]="selectedReportId()" (ngModelChange)="chooseReport($event)" [disabled]="workspaceBusy()">
                  <option value="">Choose report</option>
                  @for (r of reports(); track r.id) { <option [value]="r.id">{{ r.code }} — {{ r.name }}</option> }
                </select>
              </label>
              @if (selectedReport(); as selected) {
                <span class="report-context-meta">{{ selected.frequency }} · {{ selected.cycleCount }} {{ selected.cycleCount === 1 ? 'cycle' : 'cycles' }}</span>
              }
            </div>
          }
        </div>
        <section class="setup-tab-panel" role="tabpanel" id="setup-panel-reports" aria-labelledby="setup-tab-reports" [hidden]="activeTab()!=='reports'">
          <section class="tracker-panel reports-grid" aria-label="Reports"><div class="panel-heading"><h3>Reports ({{ reports().length }})</h3></div>
            <div class="table-wrap"><table><thead><tr><th>Report</th><th>Type</th><th>Frequency</th><th>Coordinating division</th><th>Submission recipient</th><th>Cycles</th><th>Actions</th></tr></thead><tbody>
              @for (r of reports(); track r.id) {
                <tr [class.current-report]="r.id===selectedReportId()">
                  <td><strong>{{ r.name }}</strong><span>{{ r.code }}</span></td><td>{{ r.reportTypeName }}</td><td>{{ r.frequency }}</td><td>{{ divisionName(r.ownerDivisionId) }}</td>
                  <td><strong>{{ recipientName(r) }}</strong><span>{{ r.submissionDepartmentIds?.length ?? 0 }} {{ r.submissionDepartmentIds?.length===1 ? 'department' : 'departments' }}</span></td><td>{{ r.cycleCount }}</td>
                  <td><div class="report-row-actions">
                    <button class="link-button" type="button" (click)="openReportTab(r.id,'profile')" [attr.aria-label]="'Report profile for '+r.code" [disabled]="workspaceBusy()">Profile</button>
                    <button class="link-button" type="button" (click)="openReportTab(r.id,'components')" [attr.aria-label]="'Components for '+r.code" [disabled]="workspaceBusy()">Components</button>
                    <button class="link-button" type="button" (click)="openReportTab(r.id,'cycles')" [attr.aria-label]="'Reporting cycles for '+r.code" [disabled]="workspaceBusy()">Cycles</button>
                  </div></td>
                </tr>
              } @empty { <tr><td colspan="7" class="empty">No reports configured yet.</td></tr> }
            </tbody></table></div>
          </section>
        </section>
        <section class="setup-tab-panel department-panel" role="tabpanel" id="setup-panel-create" aria-labelledby="setup-tab-create" [hidden]="activeTab()!=='create'">
            <article class="setup-card setup-editor report-inline-layout"><h3>Create report</h3>
<form class="report-inline-fields" #reportForm="ngForm" (ngSubmit)="addReport(reportForm)">
          <label class="report-field"><span>Code</span><input name="code" [(ngModel)]="report.code" required maxlength="40"></label>
          <label class="report-field"><span>Report name</span><input name="name" [(ngModel)]="report.name" required maxlength="150"></label>
          <label class="report-field"><span>Report type</span><select name="reportTypeId" [(ngModel)]="report.reportTypeId" required><option [ngValue]="null">Choose report type</option>@for (type of lookups().reportTypes; track type.id) { <option [ngValue]="type.id">{{ type.name }}</option> }</select></label>
          <label class="report-field"><span>Coordinating division</span><select name="ownerDivisionId" [(ngModel)]="report.ownerDivisionId" required><option value="">Choose division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label class="report-field"><span>Receiving division</span><select name="reportReceivingDivision" [(ngModel)]="report.receivingDivisionId" required><option value="">Choose receiving division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label class="report-field"><span>Final submitting division</span><select name="submittingDivisionId" [(ngModel)]="report.submittingDivisionId" (ngModelChange)="report.primarySubmittingOfficerId = ''; report.deputySubmittingOfficerId = ''" required><option value="">Choose final submitting division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label class="report-field"><span>Final submitting officer</span><select name="primarySubmittingOfficerId" [ngModel]="report.primarySubmittingOfficerId" (ngModelChange)="selectFinalSubmitter($event)" required><option value="">Choose officer</option>@for (u of officers(report.submittingDivisionId); track u.id) { <option [value]="u.id">{{ u.name }}</option> }</select></label>
          <label class="report-field"><span>Frequency</span>
            <select name="frequency" [(ngModel)]="report.frequency" required [disabled]="!frequencies().length">
              <option value="">Choose a frequency</option>
              @for (frequency of frequencies(); track frequency.value) {
                <option [value]="frequency.value">{{ frequency.name }}</option>
              }
            </select>
          </label>
          <label class="report-field"><span>Report deadline after period end</span><input name="reportDeadlineOffsetDays" type="number" min="0" max="365" [(ngModel)]="report.reportDeadlineOffsetDays" required><small>Calendar days</small></label>
          <label class="report-field"><span>Report submission time</span><input name="dueTime" type="time" [(ngModel)]="report.dueTime" required><small>Asia/Dhaka</small></label>
          <label class="report-field"><span>Component deadline before report deadline</span><input name="componentDeadlineOffsetDays" type="number" min="0" max="365" [(ngModel)]="report.componentDeadlineOffsetDays" required><small>Default calendar-day lead</small></label>
          <div class="deadline-formula report-description" role="note"><strong>Deadline rule</strong><span>Report: period end + {{ report.reportDeadlineOffsetDays || 0 }} calendar day(s), at {{ report.dueTime || '17:00' }}. Components: {{ report.componentDeadlineOffsetDays || 0 }} calendar day(s) before the report deadline.</span></div>
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
          <div class="setup-actions"><button class="secondary" type="button" [disabled]="busy()" (click)="selectTab('reports')">Cancel</button><button class="primary" type="submit" [disabled]="busy() || reportForm.invalid || !hasFrequency(report.frequency) || !validDestination(report)">{{ busy() ? 'Saving…' : 'Create report' }}</button></div>
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
        <section class="setup-tab-panel cycle-panel" role="tabpanel" id="setup-panel-cycles" aria-labelledby="setup-tab-cycles" [hidden]="activeTab()!=='cycles'">
          @if (selectedReport(); as selected) {
            @if (cycleView() === 'generate' && canGenerateCycles()) {
              <app-yearly-cycle-generator [reportId]="selected.id" [reportCode]="selected.code" [reportName]="selected.name" [frequency]="selected.frequency" [componentLeadDays]="selected.componentDeadlineOffsetDays ?? 0" (cancelled)="closeCycleGenerator()" (completed)="finishCycleGeneration($event)" />
            } @else {
              <article class="setup-card setup-editor report-inline-layout">
                @if (cycleEditorMode() === 'list') {
                  <div class="cycle-list-head"><div><h3>Reporting cycles</h3><p>Review saved periods or generate the missing cycles for {{ selected.code }}.</p></div><div class="cycle-list-actions">
                    @if (cycleYears().length > 1) { <label class="report-field cycle-year"><span>Year</span><select [ngModel]="cycleYear()" (ngModelChange)="cycleYear.set($event)"><option value="">All years</option>@for (year of cycleYears(); track year) { <option [value]="year">{{ year }}</option> }</select></label> }
                    <button class="secondary" type="button" (click)="openManualCycle()" [disabled]="busy()">Create manually</button>
                    @if (canGenerateCycles()) { <button class="primary" type="button" (click)="openCycleGenerator()" [disabled]="busy()">Generate cycles</button> }
                  </div></div>
                  @if (cyclesLoading()) { <p class="cycle-state" role="status">Loading saved reporting cycles…</p> }
                  @if (cycleLoadError()) { <div class="error-banner cycle-state" role="alert">{{ cycleLoadError() }} <button type="button" (click)="selectReport(cycle.reportId)">Retry loading cycles</button></div> }
                  @if (!cyclesLoading() && !cycleLoadError()) {
                    <div class="table-wrap cycle-table-wrap"><table class="cycle-table"><thead><tr><th>Period</th><th>Period start</th><th>Period end</th><th>Tasks</th><th>Action</th></tr></thead><tbody>
                      @for (saved of filteredCycles(); track saved.id) { <tr><td><strong>{{ saved.periodLabel }}</strong><span>{{ saved.periodKey }}</span></td><td>{{ saved.periodStart }}</td><td>{{ saved.periodEnd }}</td><td>{{ saved.obligations.length }}</td><td><button class="link-button" type="button" (click)="openCycleDetail(saved.id)">View</button></td></tr> }
                      @empty { <tr><td colspan="5" class="empty">No reporting cycles found for this selection.</td></tr> }
                    </tbody></table></div>
                  }
                } @else {
                  <form class="report-inline-fields" #cycleForm="ngForm" (ngSubmit)="addCycle(cycleForm)">
                    <div class="cycle-editor-head"><button type="button" (click)="closeCycleEditor()" aria-label="Back to reporting cycles">←</button><h3>{{ cycleEditorMode() === 'manual' ? 'Create a manual cycle' : cycle.periodLabel }}</h3></div>
                    <fieldset class="cycle-details" [disabled]="cycleEditorMode()==='detail'">
                    <div class="form-grid">
                      <label class="report-field"><span>Reporting year</span><input name="reportingYear" type="number" [(ngModel)]="cycle.reportingYear" (ngModelChange)="onReportingYearChange($event)" required min="2000" max="9998"></label>
                      <label class="report-field"><span>Period key</span><input name="periodKey" [(ngModel)]="cycle.periodKey" required maxlength="80" [placeholder]="'e.g. ' + cycle.reportingYear + '-10'"></label>
                      <label class="report-field"><span>Period label</span><input name="periodLabel" [(ngModel)]="cycle.periodLabel" required maxlength="150" [placeholder]="'e.g. October ' + cycle.reportingYear"></label>
                      <label class="report-field"><span>Period start</span><input name="periodStart" type="date" [(ngModel)]="cycle.periodStart" (ngModelChange)="onPeriodStartChange($event)" [min]="cycleYearStart()" [max]="cycleYearEnd()" required></label>
                      <label class="report-field"><span>Period end</span><input name="periodEnd" type="date" [(ngModel)]="cycle.periodEnd" (ngModelChange)="onPeriodEndChange($event)" [min]="cycleYearStart()" [max]="cycleYearEnd()" required></label>
                    </div>
                    @if (cycleEditorMode()==='manual') {
                      <div class="cycle-year-context"><div><strong>{{ cycle.reportingYear }} reporting year</strong><span>Both dates must be inside this year and may not overlap an existing period.</span></div><span class="cycle-periods">{{ manualYearCyclesSummary() }}</span></div>
                      @if (manualCycleConflict(); as conflict) { <p class="error-banner cycle-conflict" role="alert">{{ conflict }}</p> }
                    }
                    @if (cycleEditorMode()==='manual' && cycleAssignmentsMissing()) { <p class="error-banner" role="alert">Complete the submitting division, assigned officers and recipients in Report Configuration and Components and Responsibilities before creating this cycle.</p> }
                    <p class="cycle-deadline-note">Deadlines are calculated from this report's calendar-day rule. You may adjust them for this cycle before saving.</p>
                    <div class="form-grid">@for (task of tasks; track $index; let i = $index) { <label class="report-field"><span>{{ task.type === 'BB' ? 'Final submission deadline (Asia/Dhaka)' : task.name + ' deadline (Asia/Dhaka)' }}</span><input type="datetime-local" [name]="'due'+i" [(ngModel)]="task.dueLocal" required></label> }</div>
                    @if (cycleEditorMode()==='detail' && !tasks.length) { <p class="cycle-notice">No tasks were saved for this cycle.</p> }
                    @if (cycleEditorMode()==='detail' && tasks.length && !hasSavedComponentTasks()) { <p class="cycle-notice">No component tasks were saved for this cycle.</p> }
                    @if (cycleEditorMode()==='manual') { <div class="setup-actions"><button class="secondary" type="button" (click)="closeCycleEditor()">Cancel</button><button class="primary" type="submit" [disabled]="busy() || cycleForm.invalid || cycleAssignmentsMissing() || !!manualCycleConflict()">Create cycle manually</button></div> }
                    </fieldset>
                  </form>
                }
              </article>
            }
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
  protected readonly canGenerateCycles = computed(() => this.session.user()?.permissions.some(permission => permission === 'administration.manage' || permission === 'reports.manage') ?? false);
  protected readonly componentsOpened = signal(false);
  private readonly componentEditor = viewChild(ReportComponentEditorComponent);
  readonly changed = output<void>();
  private readonly api = inject(DashboardService);
  private readonly session = inject(SessionService);
  protected readonly lookups = signal<Lookups>({ divisions: [], officers: [], reportTypes: [] });
  protected readonly submissionRecipients = signal<SubmissionRecipient[]>([]);
  protected readonly reports = signal<ReportDefinition[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly frequencies = signal<{ value: string; name: string }[]>([]);
  protected report = this.emptyReport();
  protected cycle = { reportId: '', reportingYear: this.currentYear(), periodKey: '', periodLabel: '', periodStart: '', periodEnd: '' };
  protected tasks = [this.newTask()];
  protected readonly savedCycles = signal<ReportingCycle[]>([]);
  protected readonly cycleView = signal<CycleView>('list');
  protected readonly cycleEditorMode = signal<CycleEditorMode>('list');
  protected readonly cycleYear = signal('');
  protected readonly cycleYears = computed(() => [...new Set(this.savedCycles().map(cycle => cycle.periodStart.slice(0, 4)))].sort((a, b) => b.localeCompare(a)));
  protected readonly filteredCycles = computed(() => this.savedCycles().filter(cycle => !this.cycleYear() || cycle.periodStart.startsWith(this.cycleYear())));
  protected readonly cyclesLoading = signal(false);
  protected readonly cycleLoadError = signal('');
  protected savedCycleId = '';
  private cycleRequest?: Subscription;
  ngOnInit() { this.load(); }
  ngOnDestroy() { this.cycleRequest?.unsubscribe(); }
  protected officers(divisionId: string) { return this.lookups().officers.filter(u => u.divisionId === divisionId); }
  protected load(showLoading = true) {
    if (showLoading) this.loading.set(true);
    this.error.set('');
    forkJoin({ lookups: this.api.lookups(), reports: this.api.reports(), recipients: this.api.submissionRecipients(), frequencies: this.api.reportingFrequencies() }).subscribe({ next: data => {
      const frequencies = data.frequencies.flatMap(({ code, name }) => {
        const value = reportFrequencyByCode.get(code);
        return value ? [{ value, name }] : [];
      });
      this.frequencies.set(frequencies);
      if (!this.hasFrequency(this.report.frequency)) this.report.frequency = this.defaultFrequency();
      this.lookups.set(data.lookups); this.reports.set(data.reports); this.submissionRecipients.set(data.recipients); this.loading.set(false);
      if (!data.reports.some(row => row.id === this.selectedReportId())) this.selectedReportId.set(data.reports[0]?.id ?? '');
      if (this.activeTab() === 'cycles' && this.cycle.reportId !== this.selectedReportId()) this.selectReport(this.selectedReportId());
    }, error: error => { this.loading.set(false); this.error.set(apiError(error)); } });
  }
  protected hasDivision(id: string) { return this.lookups().divisions.some(d => d.id === id); }
  protected hasOfficer(divisionId: string, id: string) { return this.officers(divisionId).some(u => u.id === id); }
  protected selectReport(reportId: string) {
    this.cycleRequest?.unsubscribe();
    this.cycle = { reportId, reportingYear: this.currentYear(), periodKey: '', periodLabel: '', periodStart: '', periodEnd: '' };
    this.savedCycleId = ''; this.savedCycles.set([]); this.cycleLoadError.set('');
    this.cycleView.set('list'); this.cycleEditorMode.set('list'); this.cycleYear.set('');
    this.resetCycleDraft(); this.cyclesLoading.set(!!reportId);
    if (!reportId) return;
    this.cycleRequest = this.api.cycles(reportId).subscribe({
      next: cycles => {
        this.savedCycles.set(cycles); this.cyclesLoading.set(false);
      },
      error: error => { this.cyclesLoading.set(false); this.cycleLoadError.set(apiError(error)); }
    });
  }
  protected selectCycle(id: string) {
    const saved = this.savedCycles().find(c => c.id === id);
    this.savedCycleId = saved?.id ?? '';
    if (!saved) { this.resetCycleDraft(); return; }
    this.cycle = { reportId: this.cycle.reportId, reportingYear: Number(saved.periodStart.slice(0, 4)), periodKey: saved.periodKey, periodLabel: saved.periodLabel, periodStart: saved.periodStart, periodEnd: saved.periodEnd };
    this.tasks = saved.obligations.map(task => ({ ...task, receivingDivisionId: task.receivingDivisionId ?? '', primaryOfficerId: task.primaryOfficerId ?? '', deputyOfficerId: task.deputyOfficerId ?? '',
      primaryOfficerName: task.primaryOfficerName ?? 'Unassigned', deputyOfficerName: task.deputyOfficerName ?? '',
      dueLocal: this.dhakaInputValue(task.dueAtUtc) }));
  }
  protected openCycleGenerator() { if (this.canGenerateCycles()) this.cycleView.set('generate'); }
  protected closeCycleGenerator() { this.cycleView.set('list'); }
  protected finishCycleGeneration(count: number) {
    const reportId = this.selectedReportId();
    this.cycleView.set('list'); this.cycleEditorMode.set('list');
    this.message.set(`${count} reporting ${count === 1 ? 'cycle' : 'cycles'} created successfully.`);
    this.selectReport(reportId); this.changed.emit(); this.load(false);
  }
  protected openManualCycle() {
    this.selectCycle('');
    this.cycle.reportingYear = Number(this.cycleYear()) || this.currentYear();
    this.cycleEditorMode.set('manual');
  }
  protected openCycleDetail(id: string) { this.selectCycle(id); this.cycleEditorMode.set('detail'); }
  protected closeCycleEditor() { this.savedCycleId = ''; this.resetCycleDraft(); this.cycleEditorMode.set('list'); }
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
  protected cycleYearStart() { return `${this.cycle.reportingYear}-01-01`; }
  protected cycleYearEnd() { return `${this.cycle.reportingYear}-12-31`; }
  protected onReportingYearChange(value: number | string) {
    const year = Number(value);
    this.cycle.reportingYear = Number.isInteger(year) ? year : this.currentYear();
    if (this.cycle.periodStart && !this.cycle.periodStart.startsWith(`${this.cycle.reportingYear}-`)) this.cycle.periodStart = '';
    if (this.cycle.periodEnd && !this.cycle.periodEnd.startsWith(`${this.cycle.reportingYear}-`)) this.cycle.periodEnd = '';
  }
  protected onPeriodStartChange(value: string) {
    this.cycle.periodStart = value;
    if (!value) return;
    const year = Number(value.slice(0, 4));
    if (year !== this.cycle.reportingYear) return;
    const date = new Date(value + 'T00:00:00');
    const report = this.selectedReport();
    if (report?.frequency === 'Monthly') {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      this.cycle.periodKey ||= `${year}-${month}`;
      this.cycle.periodLabel ||= new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date);
    }
  }
  protected onPeriodEndChange(value: string) {
    this.cycle.periodEnd = value;
    const finalTask = this.tasks.find(task => task.type === 'BB');
    if (!value || !finalTask) return;
    const report = this.selectedReport();
    const dueTime = report?.dueTime?.slice(0, 5) || '17:00';
    const deadlineDate = this.addCalendarDays(value, report?.reportDeadlineOffsetDays ?? 0);
    finalTask.dueLocal = `${deadlineDate}T${dueTime}`;
  }
  private addCalendarDays(value: string, days: number) {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + Math.max(0, Number(days) || 0));
    return date.toISOString().slice(0, 10);
  }
  protected manualYearCycles() {
    const prefix = `${this.cycle.reportingYear}-`;
    return this.savedCycles().filter(saved => saved.periodStart.startsWith(prefix)).sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  }
  protected manualYearCyclesSummary() {
    const cycles = this.manualYearCycles();
    return cycles.length ? `Existing periods: ${cycles.map(item => item.periodLabel).join(', ')}` : 'No cycles exist for this year.';
  }
  protected manualCycleConflict() {
    if (this.cycleEditorMode() !== 'manual') return '';
    if (!Number.isInteger(Number(this.cycle.reportingYear)) || this.cycle.reportingYear < 2000 || this.cycle.reportingYear > 9998)
      return 'Choose a valid reporting year.';
    if ((this.cycle.periodStart && !this.cycle.periodStart.startsWith(`${this.cycle.reportingYear}-`)) ||
        (this.cycle.periodEnd && !this.cycle.periodEnd.startsWith(`${this.cycle.reportingYear}-`)))
      return 'Period start and period end must both be within the selected reporting year.';
    if (!this.cycle.periodStart || !this.cycle.periodEnd) return '';
    if (this.cycle.periodEnd < this.cycle.periodStart) return 'Period end cannot be earlier than period start.';
    const cycles = this.manualYearCycles();
    if (cycles.some(item => item.periodKey.toLowerCase() === this.cycle.periodKey.trim().toLowerCase()))
      return 'This period key already exists for the selected report.';
    if (cycles.some(item => item.periodStart === this.cycle.periodStart)) return 'A cycle already starts on this date.';
    if (cycles.some(item => item.periodEnd === this.cycle.periodEnd)) return 'A cycle already ends on this date.';
    const overlap = cycles.find(item => this.cycle.periodStart <= item.periodEnd && this.cycle.periodEnd >= item.periodStart);
    return overlap ? `This period overlaps ${overlap.periodLabel} (${overlap.periodStart} to ${overlap.periodEnd}).` : '';
  }
  protected hasSavedComponentTasks() {
    return this.tasks.some(task => task.type === 'Internal');
  }

  private dhakaInputValue(utc: string): string {
    // SQL Server can return UTC timestamps without a timezone suffix.
    const timestamp = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(utc) ? utc : utc + 'Z');
    return Number.isFinite(timestamp) ? new Date(timestamp + 6 * 60 * 60 * 1000).toISOString().slice(0, 16) : '';
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
  private emptyReport() { return { code: '', name: '', reportTypeId: 2 as number | null, ownerDivisionId: this.session.user()?.divisionId ?? '', receivingDivisionId: '', submittingDivisionId: '', primarySubmittingOfficerId: '', deputySubmittingOfficerId: '', submissionRecipientId: '', submissionDepartmentIds: [] as string[], frequency: this.defaultFrequency(), dueTime: '17:00', reportDeadlineOffsetDays: 0, componentDeadlineOffsetDays: 1, instructionReference: '', description: '' }; }
  private defaultFrequency() {
    return this.hasFrequency('Monthly') ? 'Monthly' : this.frequencies()[0]?.value ?? '';
  }

  private currentYear() { return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Dhaka' }).format(new Date())); }

  protected hasFrequency(value: string) {
    return this.frequencies().some(frequency => frequency.value === value);
  }

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
    if (form.invalid || !this.hasFrequency(this.report.frequency) || !this.validDestination(this.report) || this.busy()) return;
    if (this.report.primarySubmittingOfficerId === this.report.deputySubmittingOfficerId) {
      this.error.set('Choose a different deputy submitting officer or select None.');
      return;
    }
    const dueTime = this.report.dueTime.length === 5 ? this.report.dueTime + ':00' : this.report.dueTime;
    this.save(this.api.createReport({...this.report,dueTime,deputySubmittingOfficerId:this.report.deputySubmittingOfficerId || null}), 'Report created.', saved => { this.report=this.emptyReport(); this.selectedReportId.set(saved.id); this.selectTab('reports'); });
  }
  protected addCycle(form: NgForm) {
    if (form.invalid || this.busy() || this.cycleAssignmentsMissing() || this.manualCycleConflict()) return;
    if (this.savedCycleId || this.cyclesLoading() || this.cycleLoadError() || !this.cycle.reportId) return;
    const obligations = this.tasks.map(task => ({ ...task, receivingDivisionId: task.type === 'Internal' ? task.receivingDivisionId || null : null, deputyOfficerId: task.deputyOfficerId || null, dueAtUtc: new Date(task.dueLocal + '+06:00').toISOString() }));
    this.save(this.api.createCycle(this.cycle.reportId, { ...this.cycle, obligations }), 'Reporting cycle created. Obligations are now available in the trackers.', () => { this.selectReport(this.cycle.reportId); });
  }
  private newTask() { return { name: 'Final submission', type: 'BB', divisionId: this.session.user()?.divisionId ?? '', primaryOfficerId: this.session.user()?.id ?? '', deputyOfficerId: '', receivingDivisionId: '', divisionName: '', primaryOfficerName: '', deputyOfficerName: '', recipient: '', dueLocal: '', receiptRequired: false, evidenceRequired: false }; }
  private save<T>(request: Observable<T>, message: string, reset: (value:T) => void) {
    this.busy.set(true); this.error.set(''); this.message.set('');
    request.subscribe({ next: value => { this.busy.set(false); reset(value); this.message.set(message); this.changed.emit(); this.load(false); }, error: error => { this.busy.set(false); this.error.set(apiError(error)); } });
  }
}


