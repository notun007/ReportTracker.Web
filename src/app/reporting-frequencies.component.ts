import { Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { ReportingFrequencyItem } from './dashboard.models';
import { DashboardService, apiError } from './dashboard.service';

const frequencyCatalog = [
  { code: 'weekly', name: 'Weekly' },
  { code: 'twice-monthly', name: 'Twice monthly' },
  { code: 'monthly', name: 'Monthly' },
  { code: 'quarterly', name: 'Quarterly' },
  { code: 'half-yearly', name: 'Half-yearly' },
  { code: 'yearly', name: 'Yearly' }
] as const;

@Component({
  selector: 'app-reporting-frequencies',
  imports: [FormsModule],
  styles: [`
    :host { display:grid; gap:16px; min-width:0; }
    .frequency-form { margin-top:16px; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px 16px; align-items:end; }
    .helper { margin:6px 0 0; color:var(--muted); font-size:13px; }
    .frequency-actions { grid-column:1/-1; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--line); padding-top:12px; }
    .frequency-grid { margin:0; min-width:0; }
    .frequency-grid td { vertical-align:middle; }
    .code { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:12px; }
    @media(max-width:760px) { .frequency-form { grid-template-columns:1fr; } }
  `],
  template: `
    <section class="setup-card" aria-labelledby="frequency-entry-title">
      <h2 id="frequency-entry-title">{{ editingId() === null ? 'Add reporting frequency' : 'Edit reporting frequency' }}</h2>
      <p class="helper">Maintain the frequency names and display order used by report configuration and reporting cycle rules.</p>
      @if (error()) { <div class="error-banner" role="alert">{{ error() }} <button type="button" (click)="load()">Retry</button></div> }
      <form class="frequency-form" #formRef="ngForm" (ngSubmit)="save(formRef)">
        <label class="report-field"><span>Frequency code</span>
          @if (editingId() === null) {
            <select name="code" [(ngModel)]="form.code" (ngModelChange)="chooseCode($event)" required [disabled]="busy() || !available().length">
              <option value="">Choose frequency</option>
              @for (item of available(); track item.code) { <option [value]="item.code">{{ item.code }}</option> }
            </select>
          } @else { <input name="code" [(ngModel)]="form.code" readonly> }
        </label>
        <label class="report-field"><span>Display name</span><input name="name" [(ngModel)]="form.name" required maxlength="100" [disabled]="busy()"></label>
        <label class="report-field"><span>Display order</span><input name="displayOrder" type="number" min="0" max="9999" [(ngModel)]="form.displayOrder" required [disabled]="busy()"></label>
        <div class="frequency-actions">
          @if (editingId() !== null) { <button class="secondary" type="button" (click)="cancelEdit()" [disabled]="busy()">Cancel</button> }
          <button class="primary" type="submit" [disabled]="formRef.invalid || busy() || (editingId() === null && !available().length)">{{ busy() ? 'Saving…' : editingId() === null ? 'Add frequency' : 'Save changes' }}</button>
        </div>
      </form>
    </section>

    <section class="tracker-panel frequency-grid" aria-labelledby="frequency-grid-title">
      <div class="panel-heading"><div><h2 id="frequency-grid-title">Reporting frequencies ({{ rows().length }})</h2><span>Codes are fixed after creation to preserve existing schedule rules.</span></div></div>
      <div class="table-wrap"><table aria-labelledby="frequency-grid-title"><thead><tr><th>Order</th><th>Code</th><th>Display name</th><th>Action</th></tr></thead><tbody>
        @for (row of rows(); track row.id) {
          <tr><td>{{ row.displayOrder }}</td><td><span class="code">{{ row.code }}</span></td><td><strong>{{ row.name }}</strong></td><td><button class="link-button" type="button" (click)="edit(row)" [disabled]="busy()">Edit</button></td></tr>
        } @empty {
          <tr><td colspan="4" class="empty">{{ loading() ? 'Loading reporting frequencies…' : 'No reporting frequencies saved yet.' }}</td></tr>
        }
      </tbody></table></div>
    </section>
  `
})
export class ReportingFrequenciesComponent implements OnInit {
  private readonly api = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  readonly notification = output<{text:string; error:boolean}>();
  protected readonly rows = signal<ReportingFrequencyItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly editingId = signal<number | null>(null);
  protected readonly available = computed(() => frequencyCatalog.filter(item => !this.rows().some(row => row.code === item.code)));
  protected form = { code: '', name: '', displayOrder: 1 };

  ngOnInit() { this.load(); }

  protected load() {
    this.loading.set(true); this.error.set('');
    this.api.reportingFrequencies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { this.rows.set(this.sort(rows)); this.loading.set(false); this.resetCreateForm(); },
      error: error => { this.loading.set(false); this.error.set(apiError(error)); }
    });
  }

  protected chooseCode(code: string) {
    const selected = frequencyCatalog.find(item => item.code === code);
    if (selected) this.form = { code, name: selected.name, displayOrder: this.nextOrder() };
  }

  protected edit(row: ReportingFrequencyItem) {
    this.editingId.set(row.id);
    this.form = { code: row.code, name: row.name, displayOrder: row.displayOrder };
    this.error.set('');
  }

  protected cancelEdit() { this.editingId.set(null); this.resetCreateForm(); this.error.set(''); }

  protected save(formRef: NgForm) {
    if (formRef.invalid || this.busy()) return;
    const id = this.editingId();
    this.busy.set(true); this.error.set('');
    const request = id === null
      ? this.api.createReportingFrequency({ code: this.form.code, name: this.form.name.trim(), displayOrder: this.form.displayOrder })
      : this.api.updateReportingFrequency(id, { name: this.form.name.trim(), displayOrder: this.form.displayOrder });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.rows.update(rows => this.sort(id === null ? [...rows, saved] : rows.map(row => row.id === id ? saved : row)));
        this.busy.set(false); this.editingId.set(null); this.resetCreateForm();
        this.notification.emit({ text: id === null ? 'Reporting frequency added.' : 'Reporting frequency updated.', error: false });
      },
      error: error => { this.busy.set(false); this.error.set(apiError(error)); this.notification.emit({ text: apiError(error), error: true }); }
    });
  }

  private resetCreateForm() {
    if (this.editingId() !== null) return;
    const next = this.available()[0];
    this.form = { code: next?.code ?? '', name: next?.name ?? '', displayOrder: this.nextOrder() };
  }
  private nextOrder() { return Math.max(0, ...this.rows().map(row => row.displayOrder)) + 1; }
  private sort(rows: ReportingFrequencyItem[]) { return [...rows].sort((a,b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code)); }
}
