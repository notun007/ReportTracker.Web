import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { SubmissionRecipient } from './dashboard.models';
import { DashboardService, apiError } from './dashboard.service';

@Component({
  selector: 'app-submission-recipient-admin',
  imports: [FormsModule],
  styles: [`
    :host { display:block; margin-top:24px; }
    h3 { margin:0 0 14px; }
    .recipient-list table { min-width:400px; }
    .recipient-list td { overflow-wrap:anywhere; }
    .recipient-list td span+span { margin-top:4px; }
  `],
  template: `
    <section aria-labelledby="recipient-directory-title">
      <h3 id="recipient-directory-title">Submission recipients</h3>
      @if (error()) { <div class="error-banner" role="alert">{{ error() }} @if (loadFailed()) { <button type="button" (click)="load()">Retry</button> }</div> }
      @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
      @if (loading()) { <p role="status">Loading submission recipients…</p> }
      <section class="setup-grid">
        <article class="setup-card">
          <h3>Add submission recipient</h3>
          <form #recipientForm="ngForm" (ngSubmit)="addRecipient(recipientForm)">
            <label>Organization name<input name="organizationName" [(ngModel)]="name" required maxlength="250"></label>
            <button class="primary" type="submit" [disabled]="loading() || loadFailed() || busy() || !name.trim()">Add submission recipient</button>
          </form>
        </article>
        <article class="setup-card">
          <h3>Add recipient department</h3>
          <form #departmentForm="ngForm" (ngSubmit)="addDepartment(departmentForm)">
            <label>Submission recipient<select name="recipientId" [(ngModel)]="recipientId" required>
              <option value="">Choose submission recipient</option>
              @for (recipient of recipients(); track recipient.id) { <option [value]="recipient.id">{{ recipient.name }}</option> }
            </select></label>
            <label>Department name<input name="departmentName" [(ngModel)]="departmentName" required maxlength="150"></label>
            <button class="primary" type="submit" [disabled]="loading() || loadFailed() || busy() || departmentForm.invalid || !departmentName.trim()">Add department</button>
          </form>
        </article>
      </section>
      <section class="tracker-panel recipient-list" aria-label="Recipient directory">
        <div class="panel-heading"><h3>Recipient directory</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Submission recipient</th><th>Departments</th></tr></thead>
          <tbody>@for (recipient of recipients(); track recipient.id) {
            <tr><td><strong>{{ recipient.name }}</strong></td><td>
              @for (department of recipient.departments; track department.id) { <span>{{ department.name }}</span> }
              @empty { <span>No departments added</span> }
            </td></tr>
          } @empty { <tr><td colspan="2" class="empty">{{ loading() ? 'Loading…' : 'No recipients to display.' }}</td></tr> }</tbody>
        </table></div>
      </section>
    </section>
  `
})
export class SubmissionRecipientAdminComponent implements OnInit {
  private readonly api = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly recipients = signal<SubmissionRecipient[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected name = '';
  protected recipientId = '';
  protected departmentName = '';

  ngOnInit() { this.load(); }

  protected load() {
    this.loading.set(true); this.error.set(''); this.loadFailed.set(false);
    this.api.submissionRecipients().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { this.recipients.set(rows); this.loading.set(false); },
      error: error => { this.fail(error); this.loadFailed.set(true); this.loading.set(false); }
    });
  }

  protected addRecipient(form: NgForm) {
    if (form.invalid || !this.name.trim() || this.busy()) return;
    this.beginSave();
    this.api.createSubmissionRecipient(this.name.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: row => {
        this.recipients.update(rows => [...rows, {...row, departments: []}].sort((a, b) => a.name.localeCompare(b.name)));
        this.recipientId = row.id; this.name = ''; form.resetForm({organizationName: ''});
        this.message.set('Submission recipient added.'); this.busy.set(false);
      },
      error: error => this.fail(error)
    });
  }

  protected addDepartment(form: NgForm) {
    const id = this.recipientId;
    if (form.invalid || !id || !this.departmentName.trim() || this.busy()) return;
    this.beginSave();
    this.api.createSubmissionDepartment(id, this.departmentName.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: row => {
        this.recipients.update(rows => rows.map(recipient => recipient.id === id
          ? {...recipient, departments: [...recipient.departments, row].sort((a, b) => a.name.localeCompare(b.name))}
          : recipient));
        this.departmentName = ''; form.resetForm({recipientId: id, departmentName: ''});
        this.message.set('Department added.'); this.busy.set(false);
      },
      error: error => this.fail(error)
    });
  }

  private beginSave() { this.busy.set(true); this.error.set(''); this.message.set(''); }
  private fail(error: unknown) { this.error.set(apiError(error)); this.busy.set(false); }
}
