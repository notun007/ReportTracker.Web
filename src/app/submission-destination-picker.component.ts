import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SubmissionDestination, SubmissionRecipient } from './dashboard.models';

@Component({
  selector: 'app-submission-destination-picker',
  imports: [FormsModule],
  styles: [`
    :host { display:contents; }
    .departments,.destination-notice,.selected-departments { grid-column:1/-1; min-width:0; }
    .department-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 16px; max-height:190px; overflow:auto; padding:3px; }
    .selected-departments { margin:0; padding:10px 12px; border-radius:8px; background:#edf5ff; color:var(--ink); overflow-wrap:anywhere; }
    .destination-notice { margin:0; color:var(--muted); }
    @media(max-width:640px) { .department-options { grid-template-columns:1fr; } }
  `],
  template: `
    <label>Submission recipient
      <select [ngModel]="destination().submissionRecipientId" [ngModelOptions]="{standalone:true}" (ngModelChange)="selectRecipient($event)" [disabled]="disabled()" required>
        <option value="">Choose submission recipient</option>
        @for (recipient of recipients(); track recipient.id) { <option [value]="recipient.id">{{ recipient.name }}</option> }
      </select>
    </label>
    @if (!recipients().length) {
      <p class="destination-notice" role="status">Add a submission recipient and its departments in Administration first.</p>
    } @else if (selected(); as recipient) {
      @if (selectedDepartmentNames(); as names) {
        <p class="selected-departments"><strong>Selected:</strong> {{ names }}</p>
      }
      @if (recipient.departments.length) {
      <fieldset class="departments" aria-label="Recipient departments" [disabled]="disabled()">
        <div class="department-options">
          @for (department of recipient.departments; track department.id) {
            <label class="checkbox">
              <input type="checkbox" [checked]="destination().submissionDepartmentIds.includes(department.id)"
                [disabled]="destination().submissionDepartmentIds.length >= 20 && !destination().submissionDepartmentIds.includes(department.id)"
                (change)="toggleDepartment(department.id, $any($event.target).checked)">
              {{ department.name }}
            </label>
          }
        </div>
      </fieldset>
      }
    }
  `
})
export class SubmissionDestinationPickerComponent {
  readonly recipients = input.required<SubmissionRecipient[]>();
  readonly destination = input.required<SubmissionDestination>();
  readonly disabled = input(false);
  readonly destinationChange = output<SubmissionDestination>();
  protected readonly selected = computed(() => this.recipients().find(r => r.id === this.destination().submissionRecipientId));

  protected readonly selectedDepartmentNames = computed(() => {
    const ids = this.destination().submissionDepartmentIds;
    return this.selected()?.departments.filter(department => ids.includes(department.id)).map(department => department.name).join('; ') ?? '';
  });

  protected selectRecipient(id: string) {
    if (id !== this.destination().submissionRecipientId)
      this.destinationChange.emit({submissionRecipientId: id, submissionDepartmentIds: []});
  }

  protected toggleDepartment(id: string, checked: boolean) {
    const current = this.destination();
    const ids = checked ? [...new Set([...current.submissionDepartmentIds, id])] : current.submissionDepartmentIds.filter(x => x !== id);
    if (ids.length <= 20) this.destinationChange.emit({...current, submissionDepartmentIds: ids});
  }
}
