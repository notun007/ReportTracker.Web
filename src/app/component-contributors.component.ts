import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentContributor, ComponentDefinition, ContributorRole, Lookup } from './dashboard.models';

import { ContributorRolePickerComponent, formatContributorRoles } from './contributor-role-picker.component';

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
  return formatContributorRoles(row.roles);
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
  imports: [FormsModule, ContributorRolePickerComponent],
  styles: [`
    :host { display:block; grid-column:1/-1; min-width:0; }
    fieldset { display:grid; gap:12px; min-width:0; margin:0; padding:14px; border:1px solid var(--line); border-radius:8px; }
    legend { font-size:14px; font-weight:700; padding:0 5px; }
    .contributor-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto; gap:8px 12px; align-items:start; padding-bottom:12px; border-bottom:1px solid var(--line); }
    label { display:grid; gap:5px; min-width:0; font-size:12px; font-weight:600; }
    select { width:100%; min-width:0; min-height:40px; padding:8px; border:1px solid var(--control-line); border-radius:8px; background:var(--control-fill); color:var(--ink); }
    .remove { justify-self:end; min-height:40px; }
    .handover { grid-column:1/-1; }
    .add { justify-self:start; }
    .automatic .contributor-row { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 16px; }
    .automatic .contributor-row:last-child { border-bottom:0; padding-bottom:0; }
    .automatic .handover { grid-column:1; grid-row:2; display:flex; align-items:center; gap:8px; }
    .automatic .handover input { width:16px; height:16px; min-height:16px; margin:0; padding:0; accent-color:var(--blue); }
    .automatic .remove { grid-column:2; grid-row:2; min-height:30px; }
    @media(max-width:480px) {
      .automatic .contributor-row { grid-template-columns:minmax(0,1fr); }
      .automatic .handover,.automatic .remove { grid-column:1; grid-row:auto; }
    }
    @media(max-width:560px) { .contributor-row { grid-template-columns:minmax(0,1fr) minmax(0,1fr); } .remove { grid-column:1/-1; grid-row:auto; min-height:30px; } }
  `],
  template: `
    <fieldset [disabled]="disabled()" [class.automatic]="automaticRows()">
      <legend>Component contributors</legend>
      @for (row of displayedRows(); track $index; let i = $index) {
        <div class="contributor-row">
          <label>Team member
            <select [ngModel]="row.userId" [ngModelOptions]="{standalone:true}" (ngModelChange)="selectMember(i,$event)">
              <option value="">{{ automaticRows() && !members().length ? 'No team members available' : 'Choose team member' }}</option>
              @if (row.userId && !hasMember(row.userId)) { <option [value]="row.userId" disabled>Unavailable team member</option> }
              @for (member of members(); track member.id) { <option [value]="member.id" [disabled]="usedByAnother(member.id,i)">{{ member.name }}</option> }
            </select>
          </label>
          <app-contributor-role-picker [roles]="row.roles" [disabled]="automaticRows() && !row.userId" (rolesChange)="update(i,{roles:$event})" />
          @if (!automaticRows() || row.userId) { <button class="link-button remove" type="button" (click)="remove(i)" [attr.aria-label]="'Remove contributor '+(i+1)">Remove</button> }
          <label class="checkbox handover"><input type="checkbox" [checked]="row.recordsHandover" [disabled]="automaticRows() && !row.userId" (change)="update(i,{recordsHandover:$any($event.target).checked})">Records handover</label>
        </div>
      }
      @if (!automaticRows()) { <button class="secondary add" type="button" (click)="add()" [disabled]="rows().length >= 50 || rows().length >= members().length">Add contributor</button> }
    </fieldset>
  `
})
export class ComponentContributorsComponent {
  readonly rows = input.required<ContributorSelection[]>();
  readonly members = input.required<Lookup[]>();
  readonly disabled = input(false);
  readonly automaticRows = input(false);
  protected readonly displayedRows = computed(() => {
    const rows = this.rows();
    return this.automaticRows() && (!rows.length || (rows.length < 50 && rows.length < this.members().length))
      ? [...rows, this.blankRow()]
      : rows;
  });
  readonly rowsChange = output<ContributorSelection[]>();
  protected hasMember(id:string) { return this.members().some(member=>member.id===id); }
  protected usedByAnother(id:string,index:number) { return this.rows().some((row,i)=>i!==index && row.userId===id); }
  protected selectMember(index: number, userId: string) {
    if (!this.automaticRows()) {
      this.update(index, { userId });
    } else if (!userId) {
      this.remove(index);
    } else if (index === this.rows().length) {
      this.rowsChange.emit([...this.rows(), { ...this.blankRow(), userId }]);
    } else {
      this.update(index, { userId });
    }
  }
  private blankRow(): ContributorSelection {
    const first = !this.rows().length;
    return { userId: '', roles: [first ? 'LeadPreparer' : 'Preparer'], recordsHandover: first };
  }
  protected add() {
    this.rowsChange.emit([...this.rows(), this.blankRow()]);
  }
  protected remove(index:number) { this.rowsChange.emit(this.rows().filter((_,i)=>i!==index)); }
  protected update(index:number,change:Partial<ContributorSelection>) {
    this.rowsChange.emit(this.rows().map((row,i)=>i===index ? {...row,...change} : row));
  }
}
