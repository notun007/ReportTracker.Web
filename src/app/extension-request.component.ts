import { CommonModule } from '@angular/common';
import { Component, OnChanges, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Obligation } from './dashboard.models';
import { DashboardService, apiError } from './dashboard.service';

@Component({
  selector: 'app-extension-request',
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display:block; min-width:0; }
    .extension-context { margin:0; padding:12px; border:1px solid var(--line); border-radius:6px; background:var(--surface); }
    .extension-context strong,.extension-context span { display:block; }
    .extension-context span { margin-top:4px; color:var(--muted); font-size:12px; line-height:1.5; }
    .extension-help { margin:0; color:var(--muted); font-size:12px; line-height:1.6; }
    .extension-form { display:grid; grid-template-columns:minmax(0,1fr); gap:14px; padding:0; }
    .extension-form select { min-width:0; max-width:100%; }
  `],
  template: `
    @if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }
    @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
    @if (obligations().length === 0) {
      <p class="extension-help">No tasks are available for you to request an extension. You must be assigned to a task or have permission to record it.</p>
    } @else {
      <form class="extension-form" #requestForm="ngForm" (ngSubmit)="submit(requestForm)">
        <label>Report / period / task
          <select name="extensionObligation" [ngModel]="selectedId()" (ngModelChange)="selectTask($event)" required [disabled]="busy()">
            <option value="">Choose the task that needs more time</option>
            @for (task of obligations(); track task.id) {
              <option [value]="task.id">{{ task.report }} · {{ task.period }} · {{ task.obligation }}{{ pendingIds().includes(task.id) ? ' — extension pending' : '' }}</option>
            }
          </select>
        </label>
        @if (selected(); as task) {
          <div class="extension-context">
            <strong>Current deadline: {{ task.dueAtUtc | date:'dd MMM y, HH:mm':'+0600' }} (Bangladesh time)</strong>
            <span>{{ task.division }} · {{ task.owner }}</span>
          </div>
        }
        @if (pending()) { <p class="extension-help" role="status">An extension request is already pending for this task. Review it in the Extension register before submitting another.</p> }
        <label>Requested deadline (Asia/Dhaka)
          <input type="datetime-local" name="extensionDeadline" [ngModel]="requestedLocal()" (ngModelChange)="requestedLocal.set($event)" required [disabled]="!selected() || busy() || pending()">
        </label>
        @if (deadlineError()) { <p class="error-banner" role="alert">{{ deadlineError() }}</p> }
        <label>Reason<textarea name="extensionReason" [(ngModel)]="reason" required maxlength="1000" rows="3" placeholder="Explain why additional time is needed" [disabled]="!selected() || busy() || pending()"></textarea></label>
        <label>Permission reference (optional)<input name="extensionReference" [(ngModel)]="permissionReference" maxlength="250" placeholder="Letter, email or instruction reference" [disabled]="!selected() || busy() || pending()"></label>
        <p class="extension-help">Submitting a request leaves the current deadline in place until another authorized coordinator approves it.</p>
        <button class="primary" type="submit" [disabled]="requestForm.invalid || !selected() || !requestedLocal() || !reason.trim() || !!deadlineError() || busy() || pending()">{{ busy() ? 'Submitting…' : 'Submit extension request' }}</button>
      </form>
    }
  `
})
export class ExtensionRequestComponent implements OnChanges {
  readonly obligations = input.required<Obligation[]>();
  readonly pendingIds = input<string[]>([]);
  readonly initialObligationId = input('');
  readonly submitted = output<void>();
  private readonly api = inject(DashboardService);
  protected readonly selectedId = signal('');
  protected readonly requestedLocal = signal('');
  protected readonly selected = computed(() => this.obligations().find(task => task.id === this.selectedId()));
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  private readonly submittedId = signal('');
  protected readonly pending = computed(() => !!this.selectedId() && (this.pendingIds().includes(this.selectedId()) || this.submittedId() === this.selectedId()));
  protected readonly deadlineError = computed(() => {
    if (!this.selected() || !this.requestedLocal()) return '';
    const due = new Date(this.requestedLocal() + '+06:00').getTime();
    return !Number.isFinite(due) || due <= new Date(this.selected()!.dueAtUtc).getTime()
      ? 'Choose a deadline later than the current deadline.' : '';
  });
  protected reason = '';
  protected permissionReference = '';
  ngOnChanges() {
    if (!this.selected()) this.selectTask(this.obligations().some(task => task.id === this.initialObligationId()) ? this.initialObligationId() : '');
  }
  protected selectTask(id: string) {
    this.selectedId.set(id); this.requestedLocal.set(''); this.reason = ''; this.permissionReference = '';
    this.error.set(''); this.message.set('');
  }
  protected submit(form: NgForm) {
    const task = this.selected();
    if (form.invalid || !task || this.busy() || this.pending() || !this.requestedLocal() || this.deadlineError() || !this.reason.trim()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.api.requestExtension(task.id, {
      requestedDueAtUtc: new Date(this.requestedLocal() + '+06:00').toISOString(),
      reason: this.reason.trim(), permissionReference: this.permissionReference.trim() || null
    }).subscribe({
      next: () => {
        this.busy.set(false); this.submittedId.set(task.id);
        this.message.set('Extension request submitted. Awaiting approval.'); this.submitted.emit();
      },
      error: error => { this.busy.set(false); this.error.set(apiError(error)); }
    });
  }
}
