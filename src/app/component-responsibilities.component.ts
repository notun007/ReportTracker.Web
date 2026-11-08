import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ComponentDefinition, Lookups, ReportDefinition } from './dashboard.models';
import { DashboardService, apiError } from './dashboard.service';

@Component({
  selector: 'app-component-responsibilities',
  imports: [FormsModule],
  template: `
    <section class="page-intro">
      <div><h2>Components and responsibilities</h2><p>Define the mandatory inputs that must be ready before a main report can be submitted.</p></div>
    </section>
    @if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }
    @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
    <section class="workflow-layout">
      <aside class="setup-card component-editor">
        <h3>Add report component</h3>
        <form #componentForm="ngForm" (ngSubmit)="save(componentForm)">
          <label>Report<select name="reportId" [disabled]="saving()" [(ngModel)]="reportId" (ngModelChange)="loadComponents()" required><option value="">Choose report</option>@for (report of reports(); track report.id) { <option [value]="report.id">{{ report.code }} — {{ report.name }}</option> }</select></label>
          <label>Component name<input name="name" [(ngModel)]="form.name" required maxlength="250"></label>
          <label>Description<textarea name="description" [(ngModel)]="form.description" maxlength="1000" rows="3"></textarea></label>
          <div class="form-grid">
            <label>Preparing division<select name="providerDivisionId" [(ngModel)]="form.providerDivisionId" (ngModelChange)="form.primaryOfficerId=''; form.deputyOfficerId=''" required><option value="">Choose division</option>@for (division of lookups().divisions; track division.id) { <option [value]="division.id">{{ division.name }}</option> }</select></label>
            <label>Receiving division<select name="receivingDivisionId" [(ngModel)]="form.receivingDivisionId" required><option value="">Choose division</option>@for (division of lookups().divisions; track division.id) { <option [value]="division.id">{{ division.name }}</option> }</select></label>
            <label>Primary officer<select name="primaryOfficerId" [(ngModel)]="form.primaryOfficerId" required><option value="">Choose officer</option>@for (officer of officers(form.providerDivisionId); track officer.id) { <option [value]="officer.id">{{ officer.name }}</option> }</select></label>
            <label>Deputy officer<select name="deputyOfficerId" [(ngModel)]="form.deputyOfficerId"><option value="">None</option>@for (officer of officers(form.providerDivisionId); track officer.id) { <option [value]="officer.id">{{ officer.name }}</option> }</select></label>
            <label>Deadline lead days<input name="deadlineOffsetDays" type="number" min="0" max="365" [(ngModel)]="form.deadlineOffsetDays" required></label>
            <label>Display order<input name="sequence" type="number" min="0" max="999" [(ngModel)]="form.sequence" required></label>
          </div>
          @if (form.providerDivisionId && officers(form.providerDivisionId).length === 0) {
            <div class="error-banner" role="status">No active officers are assigned to {{ divisionName(form.providerDivisionId) }}. Ask a System Administrator to create users for this division under Administration → Add user. <button type="button" (click)="refreshOfficers()" [disabled]="refreshingOfficers()">{{ refreshingOfficers() ? 'Refreshing…' : 'Refresh officers' }}</button></div>
          }
          <div class="check-grid">
            <label class="checkbox"><input type="checkbox" name="required" [(ngModel)]="form.isRequired">Mandatory for readiness</label>
            <label class="checkbox"><input type="checkbox" name="evidence" [(ngModel)]="form.evidenceRequired">Evidence required</label>
            <label class="checkbox"><input type="checkbox" name="receipt" [(ngModel)]="form.receiptRequired">Receipt confirmation required</label>
          </div>
          <button class="primary" type="submit" [disabled]="saving() || componentForm.invalid || !reportId">{{ saving() ? 'Saving…' : 'Add component' }}</button>
        </form>
      </aside>
      <section class="tracker-panel component-list">
        <div class="panel-heading"><div><h3>Configured components</h3><span>{{ components().length }} components in the selected report definition</span></div><button class="secondary" type="button" (click)="loadComponents()" [disabled]="!reportId || loadingComponents() || saving()">Refresh components</button></div>
        <div class="table-wrap"><table><thead><tr><th>Component</th><th>Preparing division</th><th>Primary officer</th><th>Deadline</th><th>Controls</th></tr></thead><tbody>
          @for (component of components(); track component.id) { <tr><td><strong>{{ component.name }}</strong><span>{{ component.description || (component.isRequired ? 'Mandatory component' : 'Optional component') }}</span></td><td>{{ divisionName(component.providerDivisionId) }}</td><td>{{ officerName(component.primaryOfficerId) }}</td><td>{{ component.deadlineOffsetDays }} day(s) before main deadline</td><td><span>{{ component.evidenceRequired ? 'Evidence' : 'No evidence' }}</span><span>{{ component.receiptRequired ? 'Receipt confirmation' : 'No receipt confirmation' }}</span></td></tr> }
          @empty { <tr><td colspan="5" class="empty">{{ loadingComponents() ? 'Loading components…' : reportId ? 'No components have been added to this report.' : 'Choose a report to view its components.' }}</td></tr> }
        </tbody></table></div>
      </section>
    </section>
  `
})
export class ComponentResponsibilitiesComponent implements OnInit {
  private readonly api = inject(DashboardService);
  protected readonly reports = signal<ReportDefinition[]>([]);
  protected readonly lookups = signal<Lookups>({ divisions: [], officers: [] });
  protected readonly components = signal<ComponentDefinition[]>([]);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly loadingComponents = signal(false);
  protected readonly saving = signal(false);
  protected readonly refreshingOfficers = signal(false);
  protected reportId = '';
  protected form = this.emptyForm();

  ngOnInit() {
    forkJoin({ reports: this.api.reports(), lookups: this.api.lookups() }).subscribe({
      next: data => { this.reports.set(data.reports); this.lookups.set(data.lookups); this.reportId = data.reports[0]?.id ?? ''; this.loadComponents(); },
      error: error => this.error.set(apiError(error))
    });
  }
  protected refreshOfficers() {
    if (this.refreshingOfficers()) return;
    this.refreshingOfficers.set(true); this.error.set('');
    this.api.lookups().subscribe({
      next: data => { this.lookups.set(data); this.refreshingOfficers.set(false); },
      error: error => { this.error.set(apiError(error)); this.refreshingOfficers.set(false); }
    });
  }
  protected officers(divisionId: string) { return this.lookups().officers.filter(x => x.divisionId === divisionId); }
  protected divisionName(id: string) { return this.lookups().divisions.find(x => x.id === id)?.name ?? 'Unknown division'; }
  protected officerName(id: string | null) { return this.lookups().officers.find(x => x.id === id)?.name ?? 'Unassigned'; }
  protected loadComponents() {
    this.components.set([]); this.error.set(''); this.message.set('');
    const reportId = this.reportId;
    this.loadingComponents.set(!!reportId);
    if (!reportId) return;
    this.api.components(reportId).subscribe({
      next: rows => { if (this.reportId === reportId) { this.components.set(rows); this.loadingComponents.set(false); } },
      error: error => { if (this.reportId === reportId) { this.error.set(apiError(error)); this.loadingComponents.set(false); } }
    });
  }
  protected save(form: NgForm) {
    if (!this.reportId || form.invalid || this.saving()) return;
    this.saving.set(true); this.error.set(''); this.message.set('');
    this.api.createComponent(this.reportId, { ...this.form, deputyOfficerId: this.form.deputyOfficerId || null }).subscribe({
      next: row => { this.components.update(rows => [...rows, row].sort((a, b) => a.sequence - b.sequence)); this.form = this.emptyForm(); form.resetForm({ ...this.form, reportId: this.reportId }); this.message.set('Component saved. This defines an input for reporting cycles; existing cycles are unchanged.'); this.saving.set(false); },
      error: error => { this.error.set(apiError(error)); this.saving.set(false); }
    });
  }
  private emptyForm() { return { name: '', description: '', isRequired: true, sequence: 0, providerDivisionId: '', primaryOfficerId: '', deputyOfficerId: '', receivingDivisionId: '', receiptRequired: false, evidenceRequired: false, deadlineOffsetDays: 1 }; }
}
