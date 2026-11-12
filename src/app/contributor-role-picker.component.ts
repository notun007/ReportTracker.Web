import { Component, computed, input, output, signal } from '@angular/core';
import { ContributorRole } from './dashboard.models';

export const contributorRoles: Record<ContributorRole, string> = {
  LeadPreparer: 'Lead preparer', Preparer: 'Preparer', BackupPreparer: 'Backup preparer', Reviewer: 'Reviewer'
};

export function formatContributorRoles(roles: ContributorRole[]): string {
  return roles.map(role => contributorRoles[role]).join(', ');
}

@Component({
  selector: 'app-contributor-role-picker',
  styles: [`
    :host { display:block; min-width:0; }
    .roles { display:grid; grid-template-columns:var(--contributor-role-columns,minmax(0,1fr)); align-items:center; gap:5px var(--report-field-gap,12px); min-width:0; }
    .role-control { position:relative; min-width:0; }
    .roles-title { font-size:12px; font-weight:600; }
    .role-trigger { display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; min-height:40px; padding:8px 10px; border:1px solid var(--control-line); border-radius:8px; background:var(--control-fill); color:var(--ink); text-align:left; font-size:13px; }
    .role-menu { position:absolute; inset:100% 0 auto; z-index:1; margin-top:4px; display:grid; gap:4px; border:1px solid var(--line); border-radius:8px; background:#fff; box-shadow:0 5px 16px #152b481a; padding:8px; }
    label.role-option { display:flex; flex-direction:row; align-items:center; gap:8px; padding:6px; cursor:pointer; }
    .role-option input { flex:none; width:16px; height:16px; min-height:16px; padding:0; margin:0; accent-color:var(--blue); }
    .role-done { justify-self:end; }
  `],
  template: `
    <div class="roles" (focusout)="closeIfFocusLeaves($event)" (keydown.escape)="closeOnEscape($event, roleTrigger)">
      <span class="roles-title">Contributor roles</span>
      <div class="role-control">
        <button #roleTrigger class="role-trigger" type="button" aria-label="Contributor roles"
          [disabled]="disabled()" [attr.aria-expanded]="rolesOpen()" (click)="rolesOpen.set(!rolesOpen())">
          <span>{{ summary() || 'Choose roles' }}</span>
          <span aria-hidden="true">▾</span>
        </button>
        @if (rolesOpen() && !disabled()) {
          <div class="role-menu" role="group" aria-label="Choose contributor roles">
            @for (role of options; track role) {
              <label class="role-option">
                <input #roleCheck type="checkbox" [checked]="roles().includes(role)"
                  (change)="setRole(role, roleCheck.checked)">
                {{ contributorRoles[role] }}
              </label>
            }
            <button class="link-button role-done" type="button" (click)="closeRoles(roleTrigger)">Done</button>
          </div>
        }
      </div>
    </div>
  `
})
export class ContributorRolePickerComponent {
  readonly roles = input.required<ContributorRole[]>();
  readonly disabled = input(false);
  readonly rolesChange = output<ContributorRole[]>();
  protected readonly options = Object.keys(contributorRoles) as ContributorRole[];
  protected readonly contributorRoles = contributorRoles;
  protected readonly rolesOpen = signal(false);
  protected readonly summary = computed(() => formatContributorRoles(this.roles()));

  protected setRole(role: ContributorRole, checked: boolean) {
    const roles = this.roles();
    this.rolesChange.emit(checked ? [...roles, role] : roles.filter(item => item !== role));
  }

  protected closeRoles(trigger: HTMLButtonElement) {
    trigger.focus();
    this.rolesOpen.set(false);
  }

  protected closeOnEscape(event: Event, trigger: HTMLButtonElement) {
    if (!this.rolesOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeRoles(trigger);
  }

  protected closeIfFocusLeaves(event: FocusEvent) {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      this.rolesOpen.set(false);
    }
  }
}
