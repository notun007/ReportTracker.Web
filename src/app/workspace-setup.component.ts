import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { DashboardService, SessionService, apiError } from './dashboard.service';
import { Lookups, ReportDefinition, UserItem } from './dashboard.models';

@Component({
  selector: 'app-workspace-setup', imports: [FormsModule],
  template: `
    @if (error()) { <div class="error-banner" role="alert">{{ error() }} <button type="button" (click)="load()">Retry</button></div> }
    @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
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
    } @else {
      <section class="setup-grid">
        <article class="setup-card"><h3>Create report definition</h3><form #reportForm="ngForm" (ngSubmit)="addReport(reportForm)">
          <label>Code<input name="code" [(ngModel)]="report.code" required maxlength="40"></label>
          <label>Report name<input name="name" [(ngModel)]="report.name" required maxlength="150"></label>
          <label>Owner division<select name="ownerDivisionId" [(ngModel)]="report.ownerDivisionId" required><option value="">Choose division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
          <label>BB recipient<input name="bbRecipient" [(ngModel)]="report.bbRecipient" required maxlength="250"></label>
          <label>Frequency<select name="frequency" [(ngModel)]="report.frequency">@for (f of frequencies; track f) { <option [value]="f">{{ f }}</option> }</select></label>
          <div class="form-grid"><label>Main deadline time<input name="dueTime" type="time" [(ngModel)]="report.dueTime" required></label><label>Default component lead days<input name="componentDeadlineOffsetDays" type="number" min="0" max="365" [(ngModel)]="report.componentDeadlineOffsetDays" required></label></div>
          <label>Instruction reference<input name="instructionReference" [(ngModel)]="report.instructionReference" maxlength="250"></label>
          <label>Description<textarea name="description" [(ngModel)]="report.description" maxlength="1000" rows="2"></textarea></label>
          <button class="primary" type="submit" [disabled]="busy() || reportForm.invalid">Create report</button>
        </form></article>
        <article class="setup-card cycle-card"><h3>Create reporting cycle</h3><p>Enter the approved deadlines in Bangladesh time. Each cycle keeps its own responsibility and deadline records.</p>
          @if (reports().length === 0) { <p>Create a report definition first.</p> }
          @else { <form #cycleForm="ngForm" (ngSubmit)="addCycle(cycleForm)">
            <label>Report<select name="reportId" [(ngModel)]="cycle.reportId" (ngModelChange)="selectReport()" required><option value="">Choose report</option>@for (r of reports(); track r.id) { <option [value]="r.id">{{ r.code }} — {{ r.name }}</option> }</select></label>
            <div class="form-grid"><label>Period key<input name="periodKey" [(ngModel)]="cycle.periodKey" required maxlength="80" placeholder="e.g. 2026-10"></label><label>Period label<input name="periodLabel" [(ngModel)]="cycle.periodLabel" required maxlength="150" placeholder="e.g. October 2026"></label><label>Period start<input name="periodStart" type="date" [(ngModel)]="cycle.periodStart" required></label><label>Period end<input name="periodEnd" type="date" [(ngModel)]="cycle.periodEnd" required></label></div>
            @for (task of tasks; track task; let i = $index) {
              <fieldset><legend>Obligation {{ i + 1 }}</legend><div class="form-grid">
                <label>Type<select [name]="'type'+i" [(ngModel)]="task.type"><option>BB</option><option>Internal</option></select></label>
                <label>Task name<input [name]="'taskName'+i" [(ngModel)]="task.name" required maxlength="250"></label>
                <label>Accountable division<select [name]="'taskDivision'+i" [(ngModel)]="task.divisionId" (ngModelChange)="task.primaryOfficerId = ''; task.deputyOfficerId = ''" required><option value="">Choose division</option>@for (d of lookups().divisions; track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></label>
                <label>Primary officer<select [name]="'officer'+i" [(ngModel)]="task.primaryOfficerId" required><option value="">Choose officer</option>@for (u of officers(task.divisionId); track u.id) { <option [value]="u.id">{{ u.name }}</option> }</select></label>
                <label>Deputy officer<select [name]="'deputy'+i" [(ngModel)]="task.deputyOfficerId"><option value="">None</option>@for (u of officers(task.divisionId); track u.id) { <option [value]="u.id">{{ u.name }}</option> }</select></label>
                <label>Recipient<input [name]="'recipient'+i" [(ngModel)]="task.recipient" required maxlength="250"></label>
                <label>Deadline (Asia/Dhaka)<input type="datetime-local" [name]="'due'+i" [(ngModel)]="task.dueLocal" required></label>
                <div><label class="checkbox"><input type="checkbox" [name]="'receipt'+i" [(ngModel)]="task.receiptRequired">Receipt confirmation required</label><label class="checkbox"><input type="checkbox" [name]="'evidence'+i" [(ngModel)]="task.evidenceRequired">Confirmation evidence required</label></div>
              </div><button class="link-button" type="button" (click)="removeTask(i)" [disabled]="tasks.length === 1">Remove obligation</button></fieldset>
            }
            <div class="form-actions"><button class="secondary" type="button" (click)="addTask()">Add obligation</button><button class="primary" type="submit" [disabled]="busy() || cycleForm.invalid">Create cycle</button></div>
          </form> }
        </article>
      </section>
      <section class="tracker-panel"><div class="panel-heading"><h3>Report register</h3></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Report</th><th>Frequency</th><th>BB recipient</th><th>Cycles</th></tr></thead><tbody>@for (r of reports(); track r.id) { <tr><td>{{ r.code }}</td><td>{{ r.name }}</td><td>{{ r.frequency }}</td><td>{{ r.bbRecipient }}</td><td>{{ r.cycleCount }}</td></tr> } @empty { <tr><td colspan="5" class="empty">No reports configured yet.</td></tr> }</tbody></table></div></section>
    }
  `
})
export class WorkspaceSetupComponent implements OnInit {
  readonly mode = input.required<string>();
  readonly changed = output<void>();
  private readonly api = inject(DashboardService);
  private readonly session = inject(SessionService);
  protected readonly lookups = signal<Lookups>({ divisions: [], officers: [] });
  protected readonly reports = signal<ReportDefinition[]>([]);
  protected readonly users = signal<UserItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly frequencies = ['Daily', 'Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'HalfYearly', 'Yearly', 'AdHoc'];
  protected division = { code: '', name: '' };
  protected user = { employeeId: '', displayName: '', email: '', mobileNumber: '', divisionId: '', password: '', isCoordinator: false };
  protected report = { code: '', name: '', ownerDivisionId: this.session.user()?.divisionId ?? '', bbRecipient: '', frequency: 'Monthly', dueTime: '17:00', componentDeadlineOffsetDays: 1, instructionReference: '', description: '' };
  protected cycle = { reportId: '', periodKey: '', periodLabel: '', periodStart: '', periodEnd: '' };
  protected tasks = [this.newTask()];
  ngOnInit() { this.load(); }
  protected officers(divisionId: string) { return this.lookups().officers.filter(u => u.divisionId === divisionId); }
  protected load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ lookups: this.api.lookups(), reports: this.api.reports() }).subscribe({ next: data => {
      this.lookups.set(data.lookups); this.reports.set(data.reports); this.loading.set(false);
      if (this.mode() === 'Administration') this.api.users().subscribe({ next: users => this.users.set(users), error: error => this.error.set(apiError(error)) });
    }, error: error => { this.loading.set(false); this.error.set(apiError(error)); } });
  }
  protected selectReport() { const r = this.reports().find(r => r.id === this.cycle.reportId); if (r && this.tasks[0]) this.tasks[0].recipient = r.bbRecipient; }
  protected addTask() { this.tasks = [...this.tasks, { ...this.newTask(), type: 'Internal', name: '', recipient: '' }]; }
  protected removeTask(index: number) { if (this.tasks.length > 1) this.tasks = this.tasks.filter((_, i) => i !== index); }
  protected addDivision(form: NgForm) { if (form.invalid || this.busy()) return; this.save(this.api.createDivision(this.division), 'Division created.', () => { this.division = { code: '', name: '' }; }); }
  protected addUser(form: NgForm) { if (form.invalid || this.busy()) return; this.save(this.api.createUser(this.user), 'User created.', () => { this.user = { employeeId: '', displayName: '', email: '', mobileNumber: '', divisionId: '', password: '', isCoordinator: false }; }); }
  protected toggleUser(user:UserItem){this.save(this.api.changeUserStatus(user.id,!user.isActive),`User ${user.isActive?'deactivated':'activated'}.`,()=>{});}
  protected resetUserPassword(user:UserItem){const password=window.prompt(`Enter a temporary password for ${user.displayName} (minimum 12 characters):`);if(!password)return;if(password.length<12){this.error.set('Temporary password must contain at least 12 characters.');return;}this.save(this.api.resetPassword(user.id,password),'Password reset completed.',()=>{});}
  protected addReport(form: NgForm) { if (form.invalid || this.busy()) return; this.save(this.api.createReport(this.report), 'Report definition created.', () => { this.report = { ...this.report, code: '', name: '', description: '', instructionReference: '' }; }); }
  protected addCycle(form: NgForm) {
    if (form.invalid || this.busy()) return;
    const obligations = this.tasks.map(task => ({ ...task, deputyOfficerId: task.deputyOfficerId || null, dueAtUtc: new Date(task.dueLocal + '+06:00').toISOString() }));
    this.save(this.api.createCycle(this.cycle.reportId, { ...this.cycle, obligations }), 'Reporting cycle created. Obligations are now available in the trackers.', () => { this.cycle = { reportId: '', periodKey: '', periodLabel: '', periodStart: '', periodEnd: '' }; this.tasks = [this.newTask()]; });
  }
  private newTask() { return { name: 'BB submission', type: 'BB', divisionId: this.session.user()?.divisionId ?? '', primaryOfficerId: this.session.user()?.id ?? '', deputyOfficerId: '', recipient: '', dueLocal: '', receiptRequired: false, evidenceRequired: false }; }
  private save(request: Observable<unknown>, message: string, reset: () => void) {
    this.busy.set(true); this.error.set(''); this.message.set('');
    request.subscribe({ next: () => { this.busy.set(false); reset(); this.message.set(message); this.changed.emit(); this.load(); }, error: error => { this.busy.set(false); this.error.set(apiError(error)); } });
  }
}
