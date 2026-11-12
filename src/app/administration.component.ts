import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { Observable } from 'rxjs';
import { DivisionItem, SubmissionRecipient, UserItem } from './dashboard.models';
import { DashboardService, apiError } from './dashboard.service';

type Screen = 'divisions' | 'users' | 'recipients' | 'departments';
type Directory<T> = { rows: T[]; loading: boolean; error: string };
type DuplicateField = 'code' | 'employeeId' | 'email' | 'organizationName' | 'departmentName';

const directory = <T>(): Directory<T> => ({ rows: [], loading: true, error: '' });
const normalize = (value: string) => value.trim().toLowerCase();
const emptyUser = () => ({
  employeeId: '', displayName: '', email: '', mobileNumber: '', divisionId: '', password: '', isCoordinator: false
});

@Component({
  selector: 'app-administration',
  imports: [FormsModule],
  templateUrl: './administration.component.html',
  styleUrl: './administration.component.scss'
})
export class AdministrationComponent implements OnInit {
  private readonly api = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private toastTimer?: ReturnType<typeof setTimeout>;

  protected readonly screens = [
    { id: 'divisions', title: 'Add division', list: 'Divisions', columns: ['Code', 'Division name', 'Status'] },
    { id: 'users', title: 'Add user', list: 'Users', columns: ['Employee ID', 'Name', 'Contact', 'Division', 'Roles', 'Status', 'Actions'] },
    { id: 'recipients', title: 'Submission recipients', list: 'Saved recipients', columns: ['Organization name', 'Departments'] },
    { id: 'departments', title: 'Add recipient department', list: 'Recipient departments', columns: ['Department name'] }
  ] as const;

  protected readonly active = signal<Screen>('divisions');
  protected readonly screen = computed(() => this.screens.find(item => item.id === this.active())!);
  protected readonly divisions = signal(directory<DivisionItem>());
  protected readonly users = signal(directory<UserItem>());
  protected readonly recipients = signal(directory<SubmissionRecipient>());
  protected readonly recipientId = signal('');
  protected readonly selectedRecipient = computed(() => this.recipients().rows.find(row => row.id === this.recipientId()));
  protected readonly query = signal('');
  protected readonly busy = signal(false);
  protected readonly toast = signal<{ text: string; error: boolean } | null>(null);
  protected readonly duplicate = signal<{ field: DuplicateField; text: string } | null>(null);
  protected division = { code: '', name: '' };
  protected user = emptyUser();
  protected organizationName = '';
  protected departmentName = '';

  protected readonly activeDivisions = computed(() => this.divisions().rows.filter(row => row.isActive));
  protected readonly filteredDivisions = computed(() => this.divisions().rows.filter(row => this.matches(row.code, row.name)));
  protected readonly filteredUsers = computed(() => this.users().rows.filter(row =>
    this.matches(row.displayName, row.employeeId, row.email, row.mobileNumber ?? '', this.divisionName(row.divisionId), ...row.roles)));
  protected readonly filteredRecipients = computed(() => this.recipients().rows.filter(row => this.matches(row.name)));
  protected readonly filteredDepartments = computed(() =>
    (this.selectedRecipient()?.departments ?? []).filter(row => this.matches(row.name)));
  protected readonly count = computed(() => {
    switch (this.active()) {
      case 'divisions': return this.filteredDivisions().length;
      case 'users': return this.filteredUsers().length;
      case 'recipients': return this.filteredRecipients().length;
      case 'departments': return this.filteredDepartments().length;
    }
  });
  protected readonly currentDirectory = computed(() => {
    switch (this.active()) {
      case 'divisions': return this.divisions();
      case 'users': return this.users();
      default: return this.recipients();
    }
  });
  protected readonly loadError = computed(() => this.currentDirectory().error ||
    (this.active() === 'users' ? this.divisions().error : ''));
  protected readonly entryBlocked = computed(() => this.busy() || this.currentDirectory().loading || !!this.loadError() ||
    (this.active() === 'users' && this.divisions().loading));

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.toastTimer));
  }

  ngOnInit() {
    this.loadDivisions();
    this.loadUsers();
    this.loadRecipients();
  }

  protected navigate(screen: Screen) {
    if (screen === this.active() || this.busy()) return;
    this.active.set(screen);
    this.query.set('');
    this.duplicate.set(null);
    this.user.password = '';
  }

  protected retry() {
    if (this.active() === 'divisions' || (this.active() === 'users' && this.divisions().error)) this.loadDivisions();
    if (this.active() === 'users' && this.users().error) this.loadUsers();
    if (this.active() === 'recipients' || this.active() === 'departments') this.loadRecipients();
  }

  protected chooseRecipient(id: string) {
    this.recipientId.set(id);
    this.query.set('');
    this.clearDuplicate('departmentName');
  }

  protected divisionName(id: string) {
    return this.divisions().rows.find(division => division.id === id)?.name ?? 'Unavailable';
  }

  protected clearDuplicate(field: DuplicateField) {
    if (this.duplicate()?.field === field) this.duplicate.set(null);
  }

  protected addDivision(form: NgForm) {
    const code = this.division.code.trim().toUpperCase();
    const name = this.division.name.trim();
    if (form.invalid || this.entryBlocked() || !code || !name) return;
    if (this.divisions().rows.some(row => normalize(row.code) === normalize(code))) {
      this.showDuplicate('code', 'A division with this code already exists.');
      return;
    }
    this.save(this.api.createDivision({ code, name }), 'Division added.', () => {
      this.query.set('');
      this.division = { code: '', name: '' };
      form.resetForm(this.division);
      this.loadDivisions();
    }, 'code');
  }

  protected addUser(form: NgForm) {
    const employeeId = this.user.employeeId.trim();
    const email = normalize(this.user.email);
    const displayName = this.user.displayName.trim();
    if (form.invalid || this.entryBlocked() || !employeeId || !email || !displayName) return;
    if (this.users().rows.some(row => normalize(row.employeeId) === normalize(employeeId))) {
      this.showDuplicate('employeeId', 'An account with this employee ID already exists.');
      return;
    }
    if (this.users().rows.some(row => normalize(row.email) === email)) {
      this.showDuplicate('email', 'An account with this email address already exists.');
      return;
    }
    this.save(this.api.createUser({ ...this.user, employeeId, email, displayName, mobileNumber: this.user.mobileNumber.trim() || null }),
      'User added.', () => {
        this.query.set('');
        this.user = emptyUser();
        form.resetForm(this.user);
        this.loadUsers();
      });
  }

  protected addRecipient(form: NgForm) {
    const name = this.organizationName.trim();
    if (form.invalid || this.entryBlocked() || !name) return;
    if (this.recipients().rows.some(row => normalize(row.name) === normalize(name))) {
      this.showDuplicate('organizationName', 'A submission recipient with this name already exists.');
      return;
    }
    this.save(this.api.createSubmissionRecipient(name), 'Submission recipient added.', row => {
      this.recipients.update(state => ({
        ...state, rows: [...state.rows, { ...row, departments: [] }].sort((a, b) => a.name.localeCompare(b.name))
      }));
      this.query.set('');
      this.organizationName = '';
      form.resetForm({ organizationName: '' });
    }, 'organizationName');
  }

  protected addDepartment(form: NgForm) {
    const recipient = this.selectedRecipient();
    const name = this.departmentName.trim();
    if (form.invalid || this.entryBlocked() || !recipient || !name) return;
    if (recipient.departments.some(row => normalize(row.name) === normalize(name))) {
      this.showDuplicate('departmentName', 'A department with this name already exists for this recipient.');
      return;
    }
    this.save(this.api.createSubmissionDepartment(recipient.id, name), 'Recipient department added.', row => {
      this.recipients.update(state => ({
        ...state, rows: state.rows.map(item => item.id === recipient.id
          ? { ...item, departments: [...item.departments, row].sort((a, b) => a.name.localeCompare(b.name)) }
          : item)
      }));
      this.query.set('');
      this.departmentName = '';
      form.resetForm({ recipientId: recipient.id, departmentName: '' });
    }, 'departmentName');
  }

  protected toggleUser(user: UserItem) {
    if (this.busy()) return;
    const isActive = !user.isActive;
    this.save(this.api.changeUserStatus(user.id, isActive), isActive ? 'User activated.' : 'User deactivated.', () => {
      this.users.update(state => ({
        ...state, rows: state.rows.map(row => row.id === user.id ? { ...row, isActive } : row)
      }));
    });
  }

  protected resetPassword(user: UserItem) {
    if (this.busy()) return;
    const password = window.prompt(`Enter a temporary password for ${user.displayName} (minimum 12 characters):`);
    if (!password) return;
    if (password.length < 12 || password.length > 128) {
      this.notify('A temporary password must be between 12 and 128 characters.', true);
      return;
    }
    this.save(this.api.resetPassword(user.id, password), 'Password reset completed.', () => {});
  }

  protected dismissToast() {
    clearTimeout(this.toastTimer);
    this.toast.set(null);
  }

  private matches(...values: string[]) {
    const query = normalize(this.query());
    return !query || values.some(value => normalize(value).includes(query));
  }

  private loadDivisions() { this.loadDirectory(this.divisions, this.api.divisions()); }
  private loadUsers() { this.loadDirectory(this.users, this.api.users()); }
  private loadRecipients() { this.loadDirectory(this.recipients, this.api.submissionRecipients()); }

  private loadDirectory<T>(state: WritableSignal<Directory<T>>, request: Observable<T[]>) {
    state.update(value => ({ ...value, loading: true, error: '' }));
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => state.set({ rows, loading: false, error: '' }),
      error: error => state.update(value => ({ ...value, loading: false, error: apiError(error) }))
    });
  }

  private save<T>(request: Observable<T>, message: string, apply: (value: T) => void, duplicateField?: DuplicateField) {
    this.busy.set(true);
    this.duplicate.set(null);
    this.dismissToast();
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: value => {
        apply(value);
        this.busy.set(false);
        this.notify(message, false);
      },
      error: error => {
        this.busy.set(false);
        const field = error instanceof HttpErrorResponse && error.status === 409
          ? error.error?.field ?? duplicateField
          : undefined;
        if (field) this.showDuplicate(field, apiError(error));
        else this.notify(apiError(error), true);
      }
    });
  }

  private showDuplicate(field: DuplicateField, text: string) {
    this.duplicate.set({ field, text });
    this.notify(text, true);
  }

  private notify(text: string, error: boolean) {
    this.dismissToast();
    this.toast.set({ text, error });
    this.toastTimer = setTimeout(() => this.toast.set(null), error ? 8000 : 5000);
  }
}
