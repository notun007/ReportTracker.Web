import { Component, effect, inject, input, output, signal } from '@angular/core';
import { DashboardService, apiError } from './dashboard.service';
import { ReceivingOfficerDirectory } from './dashboard.models';

@Component({
  selector: 'app-receiving-officers',
  styles: [
    `
      .officer-list {
        display: grid;
        gap: 10px;
        margin: 16px 0;
      }
      .officer-list label {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        gap: 8px;
      }
      .officer-list input {
        flex: none;
        width: 17px;
        height: 17px;
        min-height: 17px;
        margin: 0;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 12px;
      }
    `,
  ],
  template: `
    <h3>Receiving officers</h3>
    <p>
      Choose named officers who may view incoming components and confirm receipt for this report in
      the selected receiving division. Applies to existing and future periods. Preparing
      contributors cannot confirm their own component.
    </p>
    @if (loading()) {
      <p role="status">Loading receiving officers…</p>
    }
    @if (error()) {
      <div class="error-banner" role="alert">{{ error() }}</div>
    }
    @if (message()) {
      <div class="success-banner" role="status">{{ message() }}</div>
    }
    @if (directory(); as data) {
      <p>
        <strong>Receiving division: {{ data.division }}</strong>
      </p>
      @if (!selected().length) {
        <p role="status">
          No receiving officers selected. Division membership alone does not grant access.
        </p>
      }
      <fieldset class="officer-list" [disabled]="busy()">
        <legend>Authorized receiving officers</legend>
        @for (officer of data.officers; track officer.id) {
          <label
            ><input
              type="checkbox"
              [checked]="selected().includes(officer.id)"
              (change)="toggle(officer.id)"
            />{{ officer.name }}</label
          >
        } @empty {
          <p>No active officers are available in this division.</p>
        }
      </fieldset>
      <div class="actions">
        <button class="primary" type="button" (click)="save()" [disabled]="busy() || loading()">
          {{ busy() ? 'Saving…' : 'Save receiving officers' }}</button
        ><button class="secondary" type="button" (click)="load()" [disabled]="busy() || loading()">
          Reload officers
        </button>
      </div>
    } @else if (!loading()) {
      <button class="secondary" type="button" (click)="load()">Retry receiving officers</button>
    }
  `,
})
export class ReceivingOfficersComponent {
  readonly reportId = input.required<string>();
  readonly divisionId = input.required<string>();
  readonly changed = output<void>();
  private readonly api = inject(DashboardService);
  protected readonly directory = signal<ReceivingOfficerDirectory | null>(null);
  protected readonly selected = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  private sequence = 0;
  constructor() {
    effect((onCleanup) => {
      const report = this.reportId();
      const division = this.divisionId();
      this.directory.set(null);
      this.message.set('');
      this.error.set('');
      const sequence = ++this.sequence;
      this.loading.set(true);
      const subscription = this.api.receivingOfficers(report, division).subscribe({
        next: (data) => {
          if (sequence === this.sequence) {
            this.directory.set(data);
            this.selected.set([...data.selectedOfficerIds]);
            this.loading.set(false);
          }
        },
        error: (error) => {
          if (sequence === this.sequence) {
            this.error.set(apiError(error));
            this.loading.set(false);
          }
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }
  protected toggle(id: string) {
    this.selected.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }
  protected load() {
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    this.api.receivingOfficers(this.reportId(), this.divisionId()).subscribe({
      next: (data) => {
        if (sequence === this.sequence) {
          this.directory.set(data);
          this.selected.set([...data.selectedOfficerIds]);
          this.loading.set(false);
        }
      },
      error: (error) => {
        if (sequence === this.sequence) {
          this.error.set(apiError(error));
          this.loading.set(false);
        }
      },
    });
  }
  protected save() {
    const data = this.directory();
    if (!data || this.busy()) return;
    const sequence = this.sequence;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.api
      .setReceivingOfficers(data.reportId, data.divisionId, this.selected(), data.rowVersion)
      .subscribe({
        next: () => {
          this.busy.set(false);
          if (sequence === this.sequence) {
            this.message.set('Receiving officers saved. Access changes apply immediately.');
            this.load();
            this.changed.emit();
          }
        },
        error: (error) => {
          this.busy.set(false);
          if (sequence === this.sequence) this.error.set(apiError(error));
        },
      });
  }
}
