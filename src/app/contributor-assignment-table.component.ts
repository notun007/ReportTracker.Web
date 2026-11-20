import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { Lookup } from './dashboard.models';
import { ContributorSelection, contributorRoleNames } from './component-contributors.component';

import { ContributorRolePickerComponent } from './contributor-role-picker.component';

const emptyEntry = (): ContributorSelection => ({ userId: '', roles: [] });

@Component({
  selector: 'app-contributor-assignment-table',
  imports: [ContributorRolePickerComponent],
  styles: [
    `
      :host {
        display: block;
      }
      fieldset {
        margin: 0 0 20px;
        border: 1px solid var(--line);
        border-radius: 10px;
        min-width: 0;
        padding: 14px;
      }
      fieldset.entry-only {
        margin: 0;
        padding: 10px 12px;
      }
      fieldset.entry-only + .entry-status {
        margin: 6px 0 0;
      }
      .entry-fields {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
        gap: 12px 16px;
        align-items: center;
      }
      .entry-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }
      .entry-fields > label {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        font-size: 12px;
        font-weight: 600;
      }
      .entry-fields select {
        width: 100%;
        min-width: 0;
        min-height: 40px;
        padding: 8px 10px;
        border: 1px solid var(--control-line);
        border-radius: 8px;
        background: var(--control-fill);
        color: var(--ink);
      }
      .entry-fields app-contributor-role-picker {
        --contributor-role-columns: auto minmax(0, 1fr);
      }
      @media (max-width: 1000px) {
        .entry-fields {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .entry-actions {
          grid-column: 1/-1;
        }
      }
      .table-wrap {
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      h3 {
        margin: 0 0 8px;
        font-size: 16px;
      }
      table {
        width: 100%;
        min-width: 530px;
        border-collapse: collapse;
        font-size: 13px;
      }
      th,
      td {
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f2f6fb;
      }
      td {
        border-top: 1px solid var(--line);
      }
      .row-actions {
        display: flex;
        gap: 10px;
        white-space: nowrap;
      }
      .row-actions button {
        padding: 0;
      }
      .entry-status {
        margin: 0 0 12px;
        color: var(--muted);
        font-size: 13px;
      }
      @media (max-width: 560px) {
        .entry-fields {
          grid-template-columns: minmax(0, 1fr);
        }
        .entry-actions {
          justify-content: flex-start;
        }
      }
    `,
  ],
  template: `
    <fieldset
      [disabled]="disabled()"
      [class.entry-only]="!showTable()"
      aria-label="Contributor assignment"
    >
      <div class="entry-fields">
        <label
          ><span>Team member</span>
          <select
            #memberSelect
            [value]="entry().userId"
            (change)="selectMember(memberSelect.value)"
          >
            <option value="">Choose team member</option>
            @for (member of members(); track member.id) {
              <option [value]="member.id">{{ member.name }}</option>
            }
          </select>
        </label>
        <app-contributor-role-picker [roles]="entry().roles" (rolesChange)="setRoles($event)" />
        <div class="entry-actions">
          @if (entry().userId || entry().roles.length) {
            <button type="button" class="secondary" (click)="clear(); memberSelect.focus()">
              Clear
            </button>
          }
          <button
            type="button"
            class="primary"
            [disabled]="!canApply()"
            (click)="apply(); memberSelect.focus()"
          >
            {{ existing() ? 'Update member' : persistImmediately() ? 'Save member' : 'Add member' }}
          </button>
        </div>
      </div>
    </fieldset>

    @if (hasPendingEntry() && !persistImmediately()) {
      <p class="entry-status">
        Add or update the current member, or clear the entry before saving the team.
      </p>
    }
    @if (showTable()) {
      <h3>Contributors ({{ rows().length }})</h3>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Contributor table">
        <table aria-label="Contributors">
          <thead>
            <tr>
              <th scope="col">Team member</th>
              <th scope="col">Contributor roles</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.userId) {
              <tr>
                <td>{{ memberName(row.userId) }}</td>
                <td>{{ roleNames(row) }}</td>
                <td>
                  <div class="row-actions">
                    <button
                      type="button"
                      class="link-button"
                      [disabled]="disabled() || !hasMember(row.userId)"
                      [attr.aria-label]="'Edit ' + memberName(row.userId)"
                      (click)="selectMember(row.userId); memberSelect.focus()"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="link-button"
                      [disabled]="disabled()"
                      [attr.aria-label]="'Remove ' + memberName(row.userId)"
                      (click)="remove(row.userId); memberSelect.focus()"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3">No contributors added.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class ContributorAssignmentTableComponent {
  readonly rows = input.required<ContributorSelection[]>();
  readonly members = input.required<Lookup[]>();
  readonly disabled = input(false);
  readonly rowsChange = output<ContributorSelection[]>();
  readonly showTable = input(true);
  readonly persistImmediately = input(false);
  readonly saveMember = output<ContributorSelection>();
  readonly removeMemberRequested = output<string>();
  saveEntry() {
    if (!this.disabled()) this.apply();
  }
  private readonly memberSelect = viewChild<ElementRef<HTMLSelectElement>>('memberSelect');
  editMember(userId: string) {
    if (this.disabled()) return;
    this.selectMember(userId);
    this.memberSelect()?.nativeElement.focus();
  }
  removeMember(userId: string) {
    if (this.disabled()) return;
    this.remove(userId);
  }
  clearEntry() {
    this.clear();
  }

  protected readonly entry = signal(emptyEntry());
  protected readonly roleNames = contributorRoleNames;

  protected readonly existing = computed(() =>
    this.rows().find((row) => row.userId === this.entry().userId),
  );
  readonly hasPendingEntry = computed(() => {
    const { userId, roles } = this.entry();
    const existing = this.existing();
    if (!existing) return !!userId || roles.length > 0;
    return (
      roles.length !== existing.roles.length || roles.some((role) => !existing.roles.includes(role))
    );
  });
  protected readonly canApply = computed(
    () =>
      this.hasMember(this.entry().userId) &&
      this.entry().roles.length > 0 &&
      this.hasPendingEntry() &&
      (!!this.existing() || this.rows().length < 50),
  );

  protected memberName(userId: string) {
    return this.members().find((member) => member.id === userId)?.name ?? 'Unavailable team member';
  }

  protected hasMember(userId: string) {
    return this.members().some((member) => member.id === userId);
  }

  protected selectMember(userId: string) {
    const existing = this.rows().find((row) => row.userId === userId);
    this.entry.set(
      existing ?? {
        userId,
        roles: userId ? [this.rows().length ? 'Preparer' : 'LeadPreparer'] : [],
      },
    );
  }

  protected setRoles(roles: ContributorSelection['roles']) {
    this.entry.update((entry) => ({ ...entry, roles }));
  }

  protected apply() {
    if (this.disabled() || !this.canApply()) return;
    const entry = this.entry();
    if (this.persistImmediately()) {
      this.saveMember.emit(entry);
      return;
    }
    const rows = this.rows();
    this.rowsChange.emit(
      this.existing()
        ? rows.map((row) => (row.userId === entry.userId ? entry : row))
        : [...rows, entry],
    );
    this.clear();
  }

  protected remove(userId: string) {
    if (this.persistImmediately()) {
      this.removeMemberRequested.emit(userId);
      return;
    }
    this.rowsChange.emit(this.rows().filter((row) => row.userId !== userId));
    if (this.entry().userId === userId) this.clear();
  }

  protected clear() {
    this.entry.set(emptyEntry());
  }
}
