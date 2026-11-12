import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentContributor, ComponentDefinition, ContributorRole, Lookup } from './dashboard.models';

export const contributorRoles: Record<ContributorRole, string> = {
  LeadPreparer: 'Lead preparer', Preparer: 'Preparer', BackupPreparer: 'Backup preparer', Reviewer: 'Reviewer'
};

export interface ContributorSelection {
  userId: string;
  roles: ContributorRole[];
  recordsHandover: boolean;
}

export function flattenContributors(rows: ContributorSelection[]): ComponentContributor[] {
  return rows.flatMap(row => row.roles.map(role => ({userId:row.userId, role, recordsHandover:row.recordsHandover})));
}

export function contributorRows(row: ComponentDefinition): ContributorSelection[] {
  const entries = row.contributors ?? [
    ...(row.primaryOfficerId ? [{userId:row.primaryOfficerId, role:'LeadPreparer' as const, recordsHandover:true}] : []),
    ...(row.deputyOfficerId && row.deputyOfficerId !== row.primaryOfficerId
      ? [{userId:row.deputyOfficerId, role:'BackupPreparer' as const, recordsHandover:true}] : [])
  ];
  const grouped = new Map<string, ContributorSelection>();
  for (const entry of entries) {
    const selection = grouped.get(entry.userId) ?? {userId:entry.userId, roles:[], recordsHandover:false};
    if (!selection.roles.includes(entry.role)) selection.roles.push(entry.role);
    selection.recordsHandover ||= entry.recordsHandover;
    grouped.set(entry.userId, selection);
  }
  return [...grouped.values()];
}

export function contributorRoleNames(row: ContributorSelection): string {
  return row.roles.map(role => contributorRoles[role]).join(', ');
}

export function contributorError(rows: ContributorSelection[], members: Lookup[]): string {
  if (!rows.length || rows.some(row => !members.some(member => member.id === row.userId)))
    return 'Choose an active team member for each contributor.';
  if (new Set(rows.map(row => row.userId)).size !== rows.length) return 'Choose a different team member for each row.';
  if (rows.some(row => !row.roles.length)) return 'Choose at least one role for each team member.';
  if (rows.filter(row => row.roles.includes('LeadPreparer')).length !== 1) return 'Choose exactly one lead preparer.';
  const handover = rows.filter(row => row.recordsHandover).length;
  return handover < 1 || handover > 2 ? 'Choose one or two team members to record the handover.' : '';
}

@Component({
  selector: 'app-component-contributors',
  imports: [FormsModule],
  styles: [`
    :host { display:block; grid-column:1/-1; min-width:0; }
    fieldset { display:grid; gap:12px; min-width:0; margin:0; padding:14px; border:1px solid var(--line); border-radius:8px; }
    legend { font-size:14px; font-weight:700; padding:0 5px; }
    .contributor-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto; gap:8px 12px; align-items:start; padding-bottom:12px; border-bottom:1px solid var(--line); }
    label { display:grid; gap:5px; min-width:0; font-size:12px; font-weight:600; }
    select { width:100%; min-width:0; min-height:40px; padding:8px; border:1px solid var(--control-line); border-radius:8px; background:var(--control-fill); color:var(--ink); }
    .remove { justify-self:end; min-height:40px; }
    .roles { display:grid; gap:5px; min-width:0; }
    .roles-title { font-size:12px; font-weight:600; }
    .role-trigger { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:40px; min-width:0; padding:7px 9px; border:1px solid var(--control-line); border-radius:8px; background:var(--control-fill); color:var(--ink); text-align:left; font-size:12px; }
    .role-values { display:flex; flex-wrap:wrap; gap:4px; min-width:0; }
    .role-chip { border-radius:5px; padding:3px 6px; background:#e6f1ff; color:#174772; }
    .role-placeholder { color:var(--muted); }
    .role-menu { display:grid; gap:3px; border:1px solid var(--line); border-radius:8px; background:#fff; padding:6px; }
    .role-menu .role-option { display:flex; flex-direction:row; align-items:center; gap:8px; padding:6px; cursor:pointer; }
    .role-option input { flex:none; width:16px; height:16px; min-height:16px; margin:0; accent-color:var(--blue); }
    .role-option:hover { background:#eef5fe; border-radius:5px; }
    .role-done { justify-self:end; }
    .handover { grid-column:1/-1; }
    .add { justify-self:start; }
    @media(max-width:560px) { .contributor-row { grid-template-columns:minmax(0,1fr) minmax(0,1fr); } .remove { grid-column:1/-1; grid-row:auto; min-height:30px; } }
  `],
  template: `
    <fieldset [disabled]="disabled()">
      <legend>Component contributors</legend>
      @for (row of rows(); track $index; let i = $index) {
        <div class="contributor-row">
          <label>Team member
            <select [ngModel]="row.userId" [ngModelOptions]="{standalone:true}" (ngModelChange)="update(i,{userId:$event})">
              <option value="">Choose team member</option>
              @if (row.userId && !hasMember(row.userId)) { <option [value]="row.userId" disabled>Unavailable team member</option> }
              @for (member of members(); track member.id) { <option [value]="member.id" [disabled]="usedByAnother(member.id,i)">{{ member.name }}</option> }
            </select>
          </label>
          <div class="roles" (focusout)="closeIfFocusLeaves(i,$event)" (keydown.escape)="closeRoleMenu(i,$event,roleTrigger)">
            <span class="roles-title">Contributor roles</span>
            <button #roleTrigger type="button" class="role-trigger" aria-label="Contributor roles" [attr.aria-expanded]="openRoleIndex()===i"
              (click)="openRoleIndex.set(openRoleIndex()===i ? null : i)">
              <span class="role-values">
                @for (role of row.roles; track role) { <span class="role-chip">{{ roleLabels[role] }}</span> }
                @empty { <span class="role-placeholder">Choose roles</span> }
              </span>
              <span aria-hidden="true">▾</span>
            </button>
            @if (openRoleIndex()===i) {
              <div class="role-menu" role="group" aria-label="Choose contributor roles">
                @for (role of roles; track role) {
                  <label class="checkbox role-option">
                    <input type="checkbox" [checked]="row.roles.includes(role)"
                      (change)="toggleRole(i,role,$any($event.target).checked)">
                    {{ roleLabels[role] }}
                  </label>
                }
                <button class="link-button role-done" type="button" (click)="openRoleIndex.set(null); roleTrigger.focus()">Done</button>
              </div>
            }
          </div>
          <button class="link-button remove" type="button" (click)="remove(i)" [attr.aria-label]="'Remove contributor '+(i+1)">Remove</button>
          <label class="checkbox handover"><input type="checkbox" [checked]="row.recordsHandover" (change)="update(i,{recordsHandover:$any($event.target).checked})">Records handover</label>
        </div>
      }
      <button class="secondary add" type="button" (click)="add()" [disabled]="rows().length >= 50 || rows().length >= members().length">Add contributor</button>
    </fieldset>
  `
})
export class ComponentContributorsComponent {
  readonly rows = input.required<ContributorSelection[]>();
  readonly members = input.required<Lookup[]>();
  readonly disabled = input(false);
  readonly rowsChange = output<ContributorSelection[]>();
  protected readonly openRoleIndex = signal<number|null>(null);
  protected readonly roleLabels = contributorRoles;
  protected readonly roles = Object.keys(contributorRoles) as ContributorRole[];
  protected hasMember(id:string) { return this.members().some(member=>member.id===id); }
  protected usedByAnother(id:string,index:number) { return this.rows().some((row,i)=>i!==index && row.userId===id); }
  protected add() {
    const first = !this.rows().length;
    this.rowsChange.emit([...this.rows(), {userId:'',roles:[first ? 'LeadPreparer' : 'Preparer'], recordsHandover:first}]);
  }
  protected remove(index:number) { this.openRoleIndex.set(null); this.rowsChange.emit(this.rows().filter((_,i)=>i!==index)); }
  protected closeIfFocusLeaves(index:number,event:FocusEvent) {
    const next = event.relatedTarget;
    if (this.openRoleIndex()===index && !(next instanceof Node && (event.currentTarget as HTMLElement).contains(next)))
      this.openRoleIndex.set(null);
  }
  protected closeRoleMenu(index:number,event:Event,trigger:HTMLButtonElement) {
    if (this.openRoleIndex()!==index) return;
    event.preventDefault(); event.stopPropagation();
    this.openRoleIndex.set(null); trigger.focus();
  }
  protected toggleRole(index:number,role:ContributorRole,checked:boolean) {
    const roles = this.rows()[index].roles;
    this.update(index,{roles:checked ? [...new Set([...roles,role])] : roles.filter(item=>item!==role)});
  }
  protected update(index:number,change:Partial<ContributorSelection>) {
    this.rowsChange.emit(this.rows().map((row,i)=>i===index ? {...row,...change} : row));
  }
}
