import { Component, ElementRef, computed, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SubmissionDestination, SubmissionRecipient } from './dashboard.models';

@Component({
  selector: 'app-submission-destination-picker',
  imports: [FormsModule],
  styles: [`
    :host { display:contents; }
    .departments,.destination-notice { grid-column:1/-1; min-width:0; }
    .department-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 16px; max-height:clamp(11rem,42dvh,30rem); overflow:auto; padding:3px; }
    .recipient-controls { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:end; min-width:0; }
    .recipient-controls label { min-width:0; }
    .recipient-controls select { min-width:0; }
    .recipient-controls button { min-height:40px; }
    .department-search { margin-bottom:12px; }
    .department-viewer { width:min(820px,calc(100% - 24px)); min-height:min(380px,82dvh); max-height:92dvh; }
    .viewer-content { display:grid; gap:14px; padding:16px 22px 22px; }
    .viewer-content h3,.viewer-content p { margin:0; }
    .viewer-close { width:36px; height:36px; padding:0; border-radius:8px; flex:none; } .viewer-close:hover { background:#e9f3ff; }
    .department-list { max-height:clamp(11rem,50dvh,34rem); overflow:auto; margin:0; padding:0 4px 0 28px; }
    .department-list li { padding:8px 4px; border-bottom:1px solid var(--line); overflow-wrap:anywhere; }
    .department-list li:last-child { border-bottom:0; }
    .destination-notice { margin:0; color:var(--muted); }
    @media(max-width:640px) { .department-options { grid-template-columns:1fr; } }
  `],
  template: `
    <div class="recipient-controls">
      <label>Submission recipient
        <select [ngModel]="destination().submissionRecipientId" [ngModelOptions]="{standalone:true}" (ngModelChange)="selectRecipient($event)" [disabled]="disabled()" required>
          <option value="">Choose submission recipient</option>
          @for (recipient of recipients(); track recipient.id) { <option [value]="recipient.id">{{ recipient.name }}</option> }
        </select>
      </label>
      <button type="button" class="secondary" [disabled]="disabled() || !selected()" (click)="openDepartmentViewer()">Review departments</button>
    </div>
    @if (!recipients().length) {
      <p class="destination-notice" role="status">Add a submission recipient and its departments in Administration first.</p>
    } @else if (selected(); as recipient) {
      @if (recipient.departments.length) {
      <fieldset class="departments" aria-label="Recipient departments" [disabled]="disabled()">
        <label class="department-search">Search departments
          <input type="search" [value]="query()" (input)="query.set($any($event.target).value)">
        </label>
        <div class="department-options">
          @for (department of filteredDepartments(); track department.id) {
            <label class="checkbox">
              <input type="checkbox" [checked]="destination().submissionDepartmentIds.includes(department.id)"
                [disabled]="destination().submissionDepartmentIds.length >= 20 && !destination().submissionDepartmentIds.includes(department.id)"
                (change)="toggleDepartment(department.id, $any($event.target).checked)">
              {{ department.name }}
            </label>
          } @empty { <p class="destination-notice" role="status">No departments match your search.</p> }
        </div>
      </fieldset>
      }
    }
    <dialog #departmentViewer class="modal department-viewer" aria-label="Review departments" (cancel)="$event.stopPropagation()">
      <header class="modal-header"><h2>Review departments</h2><button type="button" class="icon-button viewer-close" aria-label="Close" (click)="departmentViewer.close()">×</button></header>
      <section class="viewer-content setup-card">
        <label>Submission recipient
          <select [ngModel]="viewRecipientId()" [ngModelOptions]="{standalone:true}" (ngModelChange)="viewRecipientId.set($event)" autofocus>
            @for (recipient of recipients(); track recipient.id) { <option [value]="recipient.id">{{ recipient.name }}</option> }
          </select>
        </label>
        <h3>{{ viewingReportRecipient() ? 'Selected departments' : 'All departments' }}</h3>
        @if (viewDepartments().length) {
          <ul class="department-list" tabindex="0" [attr.aria-label]="viewingReportRecipient() ? 'Selected departments' : 'All departments'">
            @for (department of viewDepartments(); track department.id) { <li>{{ department.name }}</li> }
          </ul>
        } @else {
          <p class="destination-notice">{{ viewingReportRecipient() ? 'No departments selected.' : 'No departments listed for this recipient.' }}</p>
        }
      </section>
    </dialog>
  `
})
export class SubmissionDestinationPickerComponent {
  readonly recipients = input.required<SubmissionRecipient[]>();
  readonly destination = input.required<SubmissionDestination>();
  readonly disabled = input(false);
  readonly destinationChange = output<SubmissionDestination>();
  protected readonly selected = computed(() => this.recipients().find(r => r.id === this.destination().submissionRecipientId));

  private readonly recipientId = computed(() => this.destination().submissionRecipientId);
  private readonly departmentViewer = viewChild.required<ElementRef<HTMLDialogElement>>('departmentViewer');
  protected readonly viewRecipientId = signal('');
  protected readonly viewingReportRecipient = computed(() => this.viewRecipientId() === this.recipientId());
  protected readonly viewDepartments = computed(() => {
    const departments = this.recipients().find(recipient => recipient.id === this.viewRecipientId())?.departments ?? [];
    return this.viewingReportRecipient()
      ? departments.filter(department => this.destination().submissionDepartmentIds.includes(department.id))
      : departments;
  });

  protected openDepartmentViewer() {
    if (!this.selected() || this.disabled()) return;
    this.viewRecipientId.set(this.recipientId());
    this.departmentViewer().nativeElement.showModal();
  }
  protected readonly query = linkedSignal({source:this.recipientId, computation:() => ''});
  protected readonly filteredDepartments = computed(() => {
    const words = this.query().trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return (this.selected()?.departments ?? []).filter(department => {
      const name = department.name.toLocaleLowerCase();
      return words.every(word => name.includes(word));
    });
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
