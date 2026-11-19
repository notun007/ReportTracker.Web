import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { YearlyCyclePreview } from './dashboard.models';
import { DashboardService, apiError } from './dashboard.service';

@Component({
  selector: 'app-yearly-cycle-generator', imports: [FormsModule],
  styles: [`
    :host { display:block; }
    .planner { padding:10px 22px 0; }
    .planner-head { display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; }
    .planner-title { display:flex; align-items:center; gap:8px; }
    .back { min-width:auto; padding:4px 8px; color:var(--muted); background:transparent; border:0; }
    .planner h3 { margin:0 0 2px; }
    .planner p { margin:0; color:var(--muted); }
    .planner-controls { display:flex; align-items:center; }
    .planner .year-control { display:inline-flex; flex-direction:row; align-items:center; gap:7px; min-width:0; margin:0; white-space:nowrap; }
    .planner .year-control select { width:92px; min-height:30px; height:30px; padding:3px 26px 3px 8px; font-size:12px; }
    .planner-toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin:12px 0 8px; min-height:34px; padding:5px 9px; border:1px solid var(--line); border-radius:6px; background:#f8fafc; }
    .planner-summary { display:flex; align-items:center; gap:5px; color:var(--muted); font-size:12px; white-space:nowrap; }
    .planner-summary strong { color:var(--ink); font-size:13px; }
    .summary-separator { color:#a4b2c1; }
    .toolbar-actions { display:flex; flex:0 0 auto; align-items:center; }
    .planner .existing-toggle { display:inline-flex; flex-direction:row; align-items:center; gap:5px; margin:0; color:#445b76; font-size:12px; font-weight:600; line-height:1; white-space:nowrap; }
    .planner .existing-toggle input { flex:0 0 14px; width:14px; min-height:14px; height:14px; margin:0; padding:0; }
    .period-table-wrap { width:100%; overflow:visible; border:1px solid var(--line); border-radius:8px; }
    .period-table { width:100%; min-width:0; table-layout:fixed; border-collapse:separate; border-spacing:0; }
    .period-table th { height:27px; padding:3px 8px; color:#52657d; background:#f3f6fa; border-bottom:1px solid var(--line); font-size:9px; font-weight:700; letter-spacing:.025em; line-height:1.1; text-align:left; text-transform:uppercase; }
    .period-table td { height:29px; padding:3px 8px; border-bottom:1px solid var(--line); color:var(--ink); font-size:11px; line-height:1.1; vertical-align:middle; }
    .period-table tbody tr:last-child td { border-bottom:0; }
    .period-table tbody tr { transition:background .15s ease; }
    .period-table tbody tr.new { cursor:pointer; }
    .period-table tbody tr.new:hover { background:#f5faff; }
    .period-table tbody tr.selected { background:#edf7ff; box-shadow:inset 3px 0 #0870c9; }
    .period-table tbody tr.existing { background:#fbfcfe; }
    .period-table tbody tr.skipped { background:#fff9f7; }
    .select-col { width:40px; text-align:center !important; }
    .period-col { width:17%; }
    .key-col { width:11%; }
    .date-col { width:13%; }
    .component-deadline-col { width:19%; }
    .status-col { width:13%; }
    .period-table input[type=checkbox] { width:13px; height:13px; margin:0; accent-color:#0870c9; }
    .period-name { display:block; font-size:11px; font-weight:700; }
    .period-meta { display:none; color:var(--muted); font-size:12px; }
    .period-key,.period-date { color:#445b76; font-variant-numeric:tabular-nums; }
    .period-state { display:inline-flex; align-items:center; min-height:15px; padding:0 5px; border-radius:999px; color:#0869b5; background:#e7f3ff; font-size:9px; line-height:15px; font-weight:700; }
    .existing .period-state { color:#28734e; background:#e8f6ee; }
    .skipped .period-state { color:#9b3c2e; background:#fdebe7; }
    .reason { display:block; margin-top:4px; color:#9b3c2e; font-size:11px; line-height:1.35; }
    .planner-actions { position:sticky; bottom:0; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:14px; margin:16px -22px 0; padding:13px 22px; border-top:1px solid var(--line); background:rgba(255,255,255,.97); box-shadow:0 -5px 14px rgba(15,45,75,.05); backdrop-filter:blur(5px); }
    .selection-copy { display:grid; gap:3px; }
    .selection-copy span { color:var(--muted); font-size:12px; }
    .action-buttons { display:flex; gap:8px; }
    .empty-plan { margin-top:18px; padding:24px; text-align:center; color:var(--muted); background:#f8fafc; border-radius:10px; }
  `],
  template: `
    <section class="setup-card planner" aria-labelledby="cycle-planner-title">
      <div class="planner-head">
        <div class="planner-title"><button class="back" type="button" (click)="cancelled.emit()" aria-label="Back to reporting cycles">←</button><div><h3 id="cycle-planner-title">Generate reporting cycles</h3><p>{{ reportCode() }} — {{ reportName() }} · {{ frequency() }}</p></div></div>
        <div class="planner-controls"><label class="year-control"><span>Reporting year</span><select [ngModel]="year()" (ngModelChange)="changeYear($event)" [disabled]="busy()">@for (option of yearOptions; track option) { <option [ngValue]="option">{{ option }}</option> }</select></label></div>
      </div>
      @if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }
      @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
      @if (loading()) { <p class="empty-plan" role="status">Calculating reporting periods…</p> }
      @else if (preview(); as plan) {
        <div class="planner-toolbar">
          <div class="planner-summary" aria-live="polite"><span><strong>{{ plan.totalCycles }}</strong> expected</span><span class="summary-separator">·</span><span><strong>{{ plan.existingCycles }}</strong> existing</span><span class="summary-separator">·</span><span><strong>{{ plan.newCycles }}</strong> missing</span></div>
          <div class="toolbar-actions"><label class="existing-toggle" title="Show existing periods"><input type="checkbox" [ngModel]="showExisting()" (ngModelChange)="showExisting.set($event)" aria-label="Show existing periods"><span>Show existing</span></label></div>
        </div>
        @if (visibleItems().length) {
          <div class="period-table-wrap">
            <table class="period-table" aria-label="Reporting periods">
              <thead><tr><th class="select-col"><input type="checkbox" [checked]="allNewSelected()" [indeterminate]="someNewSelected()" [disabled]="busy() || !plan.newCycles" (change)="toggleAllMissing($any($event.target).checked)" aria-label="Select all missing periods"></th><th class="period-col">Reporting period</th><th class="key-col">Period key</th><th class="date-col">Period start</th><th class="date-col">Period end</th><th class="component-deadline-col">Component submission</th><th class="date-col">Final report submission</th><th class="status-col">Status</th></tr></thead>
              <tbody>
                @for (row of visibleItems(); track row.periodKey) {
                  <tr [class.new]="row.status==='New'" [class.existing]="row.status==='Existing'" [class.skipped]="row.status==='Skipped'" [class.selected]="selectedKeys().has(row.periodKey)" (click)="row.status==='New' && !busy() && toggle(row.periodKey)">
                    <td class="select-col" data-label="Select"><input type="checkbox" [checked]="selectedKeys().has(row.periodKey)" [disabled]="row.status!=='New' || busy()" (click)="$event.stopPropagation()" (change)="toggle(row.periodKey)" [attr.aria-label]="'Select '+row.periodLabel"></td>
                    <td class="period-cell" data-label="Reporting period"><span class="period-name">{{ row.periodLabel }}</span><span class="period-meta">{{ row.periodKey }}</span></td>
                    <td class="key-cell" data-label="Period key"><span class="period-key">{{ row.periodKey }}</span></td>
                    <td data-label="Period start"><span class="period-date">{{ formatDate(row.periodStart) }}</span></td>
                    <td data-label="Period end"><span class="period-date">{{ formatDate(row.periodEnd) }}</span></td>
                    <td class="component-deadline-cell" data-label="Component submission">
                      @if (!row.componentDeadlines?.length) { <span>{{ formatDate(defaultComponentDate(row)) }}</span> }
                      @else if (row.componentDeadlines.length === 1) { <span>{{ formatDate(row.componentDeadlines[0].deadline) }}</span> }
                      @else {
                        <details class="component-deadlines" (click)="$event.stopPropagation()">
                          <summary>{{ componentDeadlineSummary(row) }}</summary>
                          <div class="component-deadline-menu">@for (component of row.componentDeadlines; track component.componentId) { <span><strong [title]="component.componentName">{{ component.componentName }}</strong><time>{{ formatDate(component.deadline) }}</time></span> }</div>
                        </details>
                      }
                    </td>
                    <td data-label="Final report submission"><span class="period-date">{{ row.finalDeadline ? formatDate(row.finalDeadline) : '—' }}</span></td>
                    <td class="status-cell" data-label="Status"><span class="period-state">{{ row.status === 'New' ? 'Ready to create' : row.status }}</span>@if (row.reason) { <span class="reason">{{ row.reason }}</span> }</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else { <p class="empty-plan">All expected periods already exist. Enable “Show existing periods” to review them.</p> }
        <div class="planner-actions"><div class="selection-copy"><strong>{{ selectedCount() ? selectedCount() + ' missing periods selected' : (plan.newCycles ? 'No missing periods selected' : 'All reporting cycles for ' + year() + ' already exist') }}</strong><span>{{ plan.newCycles ? 'Configured calendar-day report and component deadlines will be applied.' : 'Choose another year or return to reporting cycles.' }}</span></div><div class="action-buttons"><button class="secondary" type="button" (click)="cancelled.emit()">Back to cycles</button>@if (plan.newCycles) { <button class="primary" type="button" (click)="generate()" [disabled]="busy() || !selectedCount()">{{ generating() ? 'Creating cycles…' : 'Create ' + selectedCount() + ' cycles' }}</button> }</div></div>
      }
    </section>
  `
})
export class YearlyCycleGeneratorComponent implements OnInit {
  private readonly api = inject(DashboardService); private readonly destroyRef = inject(DestroyRef);
  readonly reportId = input.required<string>(); readonly reportCode = input.required<string>();
  readonly reportName = input.required<string>(); readonly frequency = input.required<string>(); readonly componentLeadDays = input(0);
  readonly cancelled = output<void>(); readonly completed = output<number>();
  private readonly currentYear = new Date().getFullYear();
  protected readonly yearOptions = Array.from({length: 7}, (_, index) => this.currentYear - 2 + index);
  protected readonly year = signal(this.currentYear); protected readonly showExisting = signal(true);
  protected readonly preview = signal<YearlyCyclePreview | null>(null); protected readonly selectedKeys = signal(new Set<string>());
  protected readonly loading = signal(false); protected readonly generating = signal(false);
  protected readonly error = signal(''); protected readonly message = signal('');
  protected readonly visibleItems = computed(() => (this.preview()?.items ?? []).filter(row => this.showExisting() || row.status !== 'Existing'));
  protected readonly newItems = computed(() => (this.preview()?.items ?? []).filter(row => row.status === 'New'));
  protected readonly selectedCount = computed(() => this.selectedKeys().size);
  protected readonly allNewSelected = computed(() => !!this.newItems().length && this.newItems().every(row => this.selectedKeys().has(row.periodKey)));
  protected readonly someNewSelected = computed(() => !this.allNewSelected() && this.newItems().some(row => this.selectedKeys().has(row.periodKey)));
  ngOnInit() { this.previewCycles(); }
  protected busy() { return this.loading() || this.generating(); }
  protected changeYear(value:number) { this.year.set(Number(value)); this.previewCycles(); }
  protected toggle(key:string) { const next = new Set(this.selectedKeys()); next.has(key) ? next.delete(key) : next.add(key); this.selectedKeys.set(next); }
  protected selectAllNew() { this.selectedKeys.set(new Set((this.preview()?.items ?? []).filter(row => row.status === 'New').map(row => row.periodKey))); }
  protected toggleAllMissing(checked:boolean) { this.selectedKeys.set(checked ? new Set(this.newItems().map(row => row.periodKey)) : new Set()); }
  protected formatDate(value:string) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short', year:'numeric', timeZone:'UTC' }).format(date);
  }
  protected componentDeadlineSummary(row:YearlyCyclePreview['items'][number]) {
    const deadlines = [...new Set((row.componentDeadlines ?? []).map(item => item.deadline))].sort();
    if (!deadlines.length) return 'No components';
    const dates = deadlines.length === 1 ? this.formatDate(deadlines[0]) : `${this.formatDate(deadlines[0])} – ${this.formatDate(deadlines.at(-1)!)}`;
    return `${dates} · ${row.componentDeadlines.length}`;
  }
  protected defaultComponentDate(row:YearlyCyclePreview['items'][number]) {
    if (row.defaultComponentDeadline) return row.defaultComponentDeadline;
    if (!row.finalDeadline) return '';
    const deadline = new Date(`${row.finalDeadline}T00:00:00Z`);
    deadline.setUTCDate(deadline.getUTCDate() - Math.max(0, Number(this.componentLeadDays()) || 0));
    return deadline.toISOString().slice(0, 10);
  }
  private previewCycles() {
    this.loading.set(true); this.error.set(''); this.message.set('');
    this.api.previewYearlyCycles(this.year(), this.reportId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { this.preview.set(data); this.selectedKeys.set(new Set(data.items.filter(row => row.status === 'New').map(row => row.periodKey))); this.loading.set(false); },
      error: error => { this.loading.set(false); this.error.set(apiError(error)); }
    });
  }
  protected generate() {
    const periodKeys = [...this.selectedKeys()]; if (!periodKeys.length || this.busy()) return;
    this.generating.set(true); this.error.set(''); this.message.set('');
    this.api.generateYearlyCycles(this.year(), this.reportId(), periodKeys).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.generating.set(false); this.completed.emit(result.cyclesCreated); },
      error: error => { this.generating.set(false); this.error.set(apiError(error)); }
    });
  }
}
