import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Obligation, ReadinessComponent, SubmissionReadiness } from './dashboard.models';
import { DashboardService, apiError } from './dashboard.service';

@Component({
  selector: 'app-submission-readiness-details',
  imports: [DatePipe],
  template: `
    <header class="modal-header">
      <div>
        <h2 id="submission-readiness-title">Submission readiness</h2>
        <p>{{ row().report }} · {{ row().period }}</p>
      </div>
      <button type="button" class="icon-button" aria-label="Close readiness" (click)="closed.emit()">×</button>
    </header>
    <div class="readiness-details">
      @if (loading()) {
        <p role="status">Loading component readiness…</p>
      } @else if (error()) {
        <div class="error-banner" role="alert">
          {{ error() }} <button type="button" class="link-button" (click)="load()">Retry</button>
        </div>
      } @else if (readiness(); as data) {
        <section class="readiness-summary" aria-label="Readiness summary">
          <div>
            <strong>{{ data.completedComponents }} of {{ data.requiredComponents }} required components complete</strong>
            <p>{{ data.blockingComponents ? data.blockingComponents + ' blocking' : 'No blocking components' }}</p>
          </div>
          <div>
            <strong>Final submission deadline (Asia/Dhaka)</strong>
            <p>{{ data.mainDueAtUtc | date:'dd MMM y, HH:mm':'+0600' }}</p>
          </div>
          <span class="readiness-pill" [class.ready]="data.isReady" [class.blocking]="!data.isReady">{{ data.isReady ? 'Ready for submission' : 'Not ready' }}</span>
        </section>
        <section aria-labelledby="readiness-components-title">
          <h3 id="readiness-components-title">Components</h3>
          @if (components().length) {
            <div class="readiness-table" tabindex="0" role="region" aria-label="Component readiness details">
              <table>
                <thead>
                  <tr><th scope="col">Component</th><th scope="col">Responsible officer</th><th scope="col">Deadline</th><th scope="col">Sending</th><th scope="col">Receipt</th><th scope="col">Evidence</th><th scope="col">Readiness</th></tr>
                </thead>
                <tbody>
                  @for (component of components(); track component.id) {
                    <tr>
                      <td>{{ component.name }}</td>
                      <td>{{ component.owner }}<span class="readiness-division">{{ component.division }}</span></td>
                      <td>{{ component.dueAtUtc | date:'dd MMM y, HH:mm':'+0600' }}</td>
                      <td>{{ component.sendingStatus }}</td>
                      <td>{{ component.receiptStatus }}</td>
                      <td>{{ component.evidenceStatus }}</td>
                      <td><span class="readiness-pill" [class.ready]="!component.isBlocking && component.isRequired" [class.blocking]="component.isBlocking">{{ outcome(component) }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p>No components are linked to this report cycle.</p>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .readiness-details { display:grid; gap:16px; padding:18px 22px; }
    .readiness-details h3 { margin:0 0 10px; }
    .readiness-summary { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:start; gap:12px 20px; padding:14px; border:1px solid var(--line); border-radius:8px; background:var(--surface); }
    .readiness-summary p { margin:4px 0 0; color:var(--muted); }
    .readiness-pill { display:inline-block; border-radius:5px; padding:4px 8px; background:#eef2f7; color:#475569; font-size:12px; font-weight:600; white-space:nowrap; }
    .readiness-pill.blocking { background:#fff7e6; color:#704912; }
    .readiness-pill.ready { background:#e9f7ee; color:#176247; }
    .readiness-table { max-width:100%; overflow:auto; }
    .readiness-table table { min-width:700px; }
    .readiness-division { display:block; margin-top:4px; color:var(--muted); }
  `]
})
export class SubmissionReadinessDetailsComponent implements OnInit {
  readonly row = input.required<Obligation>();
  readonly closed = output<void>();
  private readonly api = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly readiness = signal<SubmissionReadiness | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly components = computed(() =>
    [...(this.readiness()?.components ?? [])].sort((a, b) => Number(b.isBlocking) - Number(a.isBlocking)));

  ngOnInit() { this.load(); }

  protected load() {
    this.loading.set(true);
    this.error.set('');
    this.api.readiness(this.row().cycleId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { this.readiness.set(data); this.loading.set(false); },
      error: error => { this.error.set(apiError(error)); this.loading.set(false); }
    });
  }

  protected outcome(component: ReadinessComponent) {
    if (component.isBlocking) return 'Blocking';
    if (component.isRequired === false) return 'Optional';
    return component.isRequired ? 'Complete' : 'Not blocking';
  }
}
