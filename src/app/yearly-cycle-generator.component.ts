import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { YearlyCyclePreview } from './dashboard.models';
import { DashboardService, apiError } from './dashboard.service';

@Component({
  selector: 'app-yearly-cycle-generator', imports: [FormsModule],
  styles: [`
    :host { display:block; margin-bottom:14px; }
    .bulk-card { padding:18px 22px; }
    .bulk-heading { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; flex-wrap:wrap; }
    .bulk-heading h3 { margin:0 0 4px; }
    .bulk-heading p { margin:0; color:var(--muted); }
    .bulk-controls { display:flex; align-items:end; gap:10px; flex-wrap:wrap; }
    .bulk-controls label { min-width:130px; }
    .bulk-table { margin-top:14px; max-height:420px; overflow:auto; border:1px solid var(--line); border-radius:9px; }
    .bulk-table table { min-width:850px; }
    .bulk-table thead { position:sticky; top:0; z-index:1; }
    .state { font-weight:700; color:#19653a; }.state.existing { color:#53677d; }.state.skipped { color:#a23b2a; }
    .reason { display:block; margin-top:3px; color:var(--muted); font-size:12px; }
    .bulk-actions { display:flex; justify-content:flex-end; margin-top:12px; }
    @media(max-width:760px) { .bulk-card { padding:14px; }.bulk-controls { width:100%; }.bulk-controls label { flex:1; } }
  `],
  template: `
    <section class="setup-card bulk-card" aria-labelledby="yearly-cycle-title">
      <div class="bulk-heading"><div><h3 id="yearly-cycle-title">Create yearly cycles for all reports</h3><p>Preview period start and end dates from the latest saved Reporting Cycle Rules. Period end is used as the default deadline.</p></div>
        <div class="bulk-controls"><label class="report-field"><span>Reporting year</span><input type="number" min="2000" max="9998" [(ngModel)]="year" [disabled]="busy()"></label><button class="secondary" type="button" (click)="previewCycles()" [disabled]="busy() || year < 2000 || year > 9998">{{ loading() ? 'Previewing…' : 'Preview cycles' }}</button></div>
      </div>
      @if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }
      @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
      @if (preview(); as plan) {
        <div class="bulk-table"><table><thead><tr><th>Report</th><th>Frequency</th><th>Period</th><th>Period start</th><th>Period end / deadline</th><th>Status</th></tr></thead><tbody>
          @for (row of plan.items; track row.reportId + row.periodKey) { <tr><td><strong>{{ row.reportName }}</strong><span>{{ row.reportCode }}</span></td><td>{{ row.frequency }}</td><td><strong>{{ row.periodLabel }}</strong><span>{{ row.periodKey }}</span></td><td>{{ row.periodStart }}</td><td>{{ row.periodEnd }}</td><td><span class="state" [class.existing]="row.status==='Existing'" [class.skipped]="row.status==='Skipped'">{{ row.status }}</span>@if (row.reason) { <small class="reason">{{ row.reason }}</small> }</td></tr> }
        </tbody></table></div>
        <div class="bulk-actions"><button class="primary" type="button" (click)="generate()" [disabled]="busy() || !plan.newCycles">{{ generating() ? 'Creating cycles…' : 'Create ' + plan.newCycles + ' cycles' }}</button></div>
      }
    </section>
  `
})
export class YearlyCycleGeneratorComponent {
  private readonly api = inject(DashboardService); private readonly destroyRef = inject(DestroyRef);
  readonly changed = output<void>();
  protected year = new Date().getFullYear();
  protected readonly preview = signal<YearlyCyclePreview | null>(null);
  protected readonly loading = signal(false); protected readonly generating = signal(false);
  protected readonly error = signal(''); protected readonly message = signal('');
  protected busy() { return this.loading() || this.generating(); }
  protected previewCycles() {
    this.loading.set(true); this.error.set(''); this.message.set('');
    this.api.previewYearlyCycles(this.year).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: data => { this.preview.set(data); this.loading.set(false); }, error: error => { this.loading.set(false); this.error.set(apiError(error)); } });
  }
  protected generate() {
    if (!this.preview()?.newCycles || this.busy()) return;
    this.generating.set(true); this.error.set(''); this.message.set('');
    this.api.generateYearlyCycles(this.year).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: result => {
      this.generating.set(false); this.message.set(`${result.cyclesCreated} cycles and ${result.componentsCreated} component obligations created.` + (result.warnings.length ? ` ${result.warnings.length} warnings require review.` : ''));
      this.changed.emit(); this.previewCycles();
    }, error: error => { this.generating.set(false); this.error.set(apiError(error)); } });
  }
}
