import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { DashboardService, apiError } from './dashboard.service';
import { EvidenceItem, Obligation, ObligationActions, ReceiptItem } from './dashboard.models';

@Component({
  selector: 'app-obligation-operations', imports: [CommonModule, FormsModule],
  styles: [`.role-note { margin:0; padding:12px 22px; background:var(--surface); color:var(--muted); line-height:1.6; } .receipt-history article { padding:12px 0; border-top:1px solid var(--line); } .receipt-history span { display:block; margin-top:5px; color:var(--muted); } details { margin:12px 0; padding:12px; border:1px solid var(--line); border-radius:6px; } summary { cursor:pointer; font-weight:600; }`],
  template: `
    <div class="modal-header"><div><h2>Submission controls</h2><p>{{ row().report }} · {{ row().period }} · {{ row().obligation }}</p></div><button class="icon-button" type="button" (click)="closed.emit()" aria-label="Close">×</button></div>
    @if (error()) { <div class="error-banner" role="alert">{{ error() }} <button type="button" (click)="load()">Reload controls</button></div> }
    @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
    @if (loading()) { <p class="role-note" role="status">Loading your responsibilities and task history…</p> }
    @if (!loading()) { @if (actions(); as permissions) {
      <p class="role-note"><strong>Your actions:</strong> {{ availableActions() }}. History is visible for this task.</p>
      <div class="operations-tabs" role="tablist">
        <button [class.active]="tab() === 'Evidence'" (click)="tab.set('Evidence')">Evidence</button>
        <button [class.active]="tab() === 'Receipt'" (click)="tab.set('Receipt')">{{ permissions.canConfirmReceipt ? 'Confirm receipt' : 'Receipt history' }}</button>
        @if (permissions.canAmendStatus) { <button [class.active]="tab() === 'Amendment'" (click)="tab.set('Amendment')">Amendment</button> }
      </div>
      <div class="operations-content">
        @if (tab() === 'Evidence') {
          @if (permissions.canUploadEvidence) {
            <section><h3>Upload sending evidence</h3><p>Sender action: attach confirmation proof, such as an acknowledgment or dispatch slip. Do not upload regulatory report contents. A different authorized coordinator reviews the proof.</p>
              <label class="file-drop">Evidence file<input type="file" accept=".pdf,.png,.jpg,.jpeg" (change)="chooseFile($event)"><span>PDF, PNG or JPEG · maximum 10 MB</span></label>
              <button class="primary" type="button" (click)="upload()" [disabled]="busy() || !file">Upload evidence</button>
            </section>
          } @else {
            <section><h3>{{ permissions.canReviewEvidence ? 'Review sending evidence' : 'Sending evidence history' }}</h3><p>{{ permissions.canReviewEvidence ? 'Coordinator action: review proof uploaded by another officer, then verify or reject it.' : 'The sending officer uploads proof. An authorized coordinator verifies it.' }}</p></section>
          }
          <div class="evidence-list">@for (item of evidence(); track item.id) {
            <article><div><strong>{{ item.originalFileName }}</strong><span>Uploaded by {{ item.uploadedBy }} · {{ item.uploadedAtUtc | date:'dd MMM y, HH:mm':'+0600' }}</span><a [href]="'/api/evidence/' + item.id + '/download'" target="_blank" rel="noopener">View evidence</a>
              @if (permissions.canReviewEvidence && item.status === 'Provided' && !item.canReview) { <span>Another authorized coordinator must review your upload.</span> }
            </div><span class="status" [class]="item.status.toLowerCase()">{{ item.status }}</span>
            @if (item.canReview) { <button class="link-button" (click)="decide(item, 'Verified')" [disabled]="busy()">Verify</button><button class="link-button danger-text" (click)="decide(item, 'Rejected')" [disabled]="busy()">Reject</button> }
            </article>
          } @empty { <p>No evidence uploaded.</p> }</div>
        }
        @if (tab() === 'Receipt') {
          <section><h3>{{ permissions.isExternalReceipt ? 'Submission recipient acknowledgment' : 'Internal receipt confirmation' }}</h3>
            @if (permissions.canConfirmReceipt) {
              <p>{{ permissions.isExternalReceipt ? 'Coordinator action: record when the submission recipient acknowledged receipt. Use the actual acknowledgment received.' : 'Receiving officer action: confirm when your division received the input. The sending officer cannot confirm their own handover.' }}</p>
              <form #receiptForm="ngForm" (ngSubmit)="saveReceipt(receiptForm)"><label>Received time (Asia/Dhaka)<input type="datetime-local" name="received" [(ngModel)]="receipt.receivedLocal" required></label><label class="checkbox"><input type="checkbox" name="disputed" [(ngModel)]="receipt.isDisputed">Receipt is disputed</label>
                @if (receipt.isDisputed) { <label>Dispute reason<textarea name="reason" [(ngModel)]="receipt.reason" required maxlength="1000"></textarea></label> }
                <button class="primary" type="submit" [disabled]="busy() || receiptForm.invalid">{{ permissions.isExternalReceipt ? 'Record recipient acknowledgment' : 'Confirm receipt' }}</button>
              </form>
            } @else {
              <p>{{ !permissions.hasSending ? 'Receipt can be recorded after a submission has been recorded.' : permissions.isExternalReceipt ? 'A separate authorized coordinator records the recipient acknowledgment. Senders can view the history here.' : permissions.receivingDivisionName ? 'An officer in ' + permissions.receivingDivisionName + ' confirms receipt. Sending officers can view the history here.' : 'A coordinator must assign the receiving division before an internal officer can confirm receipt.' }}</p>
            }
            @if (permissions.canAssignReceiver) {
              <details><summary>Receiving responsibility</summary><p>Choose the division whose officers can confirm this handover. The sender remains excluded.</p>
                <form #receiverForm="ngForm" (ngSubmit)="assignReceiver(receiverForm)"><label>Receiving division<select name="receivingDivision" [(ngModel)]="receivingDivisionId" required><option value="">Choose receiving division</option>@for (division of permissions.receivingDivisions; track division.id) { <option [value]="division.id">{{ division.name }}</option> }</select></label><button class="primary" type="submit" [disabled]="busy() || receiverForm.invalid || receivingDivisionId === permissions.receivingDivisionId">Save receiving division</button></form>
              </details>
            }
          </section>
          <section class="receipt-history"><h3>Receipt history</h3>@for (item of receipts(); track item.id) { <article><strong>{{ item.isDisputed ? 'Disputed' : 'Received' }} · {{ item.receivedAtUtc | date:'dd MMM y, HH:mm':'+0600' }}</strong><span>Recorded by {{ item.actor }} · {{ item.recordedAtUtc | date:'dd MMM y, HH:mm':'+0600' }}</span>@if (item.reason) { <p>{{ item.reason }}</p> }</article> } @empty { <p>No receipt confirmation recorded.</p> }</section>
        }
        @if (tab() === 'Amendment' && permissions.canAmendStatus) {
          <section><h3>Audited status amendment</h3><p>Correct a previously recorded status. The previous value remains in the audit history.</p><form #amendmentForm="ngForm" (ngSubmit)="amend(amendmentForm)"><label>Replacement status<select name="status" [(ngModel)]="amendment.replacementStatus"><option>Not Sent</option><option>Partially Sent</option><option>Sent</option></select></label><label>Reason<textarea name="reason" [(ngModel)]="amendment.reason" required maxlength="1000"></textarea></label><button class="primary" type="submit" [disabled]="busy() || amendmentForm.invalid">Record amendment</button></form></section>
        }
      </div>
    } }
  `
})
export class ObligationOperationsComponent implements OnInit {
  readonly row = input.required<Obligation>(); readonly closed = output<void>(); readonly changed = output<void>();
  private readonly api = inject(DashboardService);
  protected readonly tab = signal('Evidence'); protected readonly evidence = signal<EvidenceItem[]>([]);
  protected readonly receipts = signal<ReceiptItem[]>([]); protected readonly actions = signal<ObligationActions | null>(null);
  protected readonly loading = signal(true); protected readonly busy = signal(false); protected readonly error = signal(''); protected readonly message = signal('');
  protected file: File | null = null; protected receivingDivisionId = '';
  protected receipt = { receivedLocal: '', isDisputed: false, reason: '' }; protected amendment = { replacementStatus: 'Not Sent', reason: '' };
  ngOnInit() { this.load(); }
  protected availableActions() { const a = this.actions(); return [a?.canUploadEvidence ? 'Upload sending proof' : '', a?.canReviewEvidence ? 'Review other officers’ evidence' : '', a?.canConfirmReceipt ? 'Confirm receipt' : ''].filter(Boolean).join(' · ') || 'View history'; }
  protected load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ actions: this.api.obligationActions(this.row().id), evidence: this.api.evidence(this.row().id), receipts: this.api.receipts(this.row().id) }).subscribe({
      next: data => { this.actions.set(data.actions); this.evidence.set(data.evidence); this.receipts.set(data.receipts); this.receivingDivisionId = data.actions.receivingDivisionId ?? ''; this.loading.set(false); },
      error: error => { this.loading.set(false); this.actions.set(null); this.error.set(apiError(error)); }
    });
  }
  protected chooseFile(event: Event) { this.file = (event.target as HTMLInputElement).files?.[0] ?? null; }
  protected upload() { if (!this.file || !this.actions()?.canUploadEvidence || this.busy()) return; this.run(this.api.uploadEvidence(this.row().id, this.file), 'Evidence uploaded. Awaiting review by another coordinator.', () => { this.file = null; }); }
  protected decide(item: EvidenceItem, decision: string) { if (!item.canReview || this.busy()) return; this.run(this.api.decideEvidence(item.id, decision, decision === 'Rejected' ? 'Rejected during review' : null), `Evidence ${decision.toLowerCase()}.`); }
  protected saveReceipt(form: NgForm) { if (form.invalid || !this.actions()?.canConfirmReceipt || this.busy()) return; this.run(this.api.confirmReceipt(this.row().id, { receivedAtUtc: new Date(this.receipt.receivedLocal + '+06:00').toISOString(), isDisputed: this.receipt.isDisputed, reason: this.receipt.reason || null }), 'Receipt status saved.', () => { this.receipt = { receivedLocal: '', isDisputed: false, reason: '' }; }); }
  protected assignReceiver(form: NgForm) { if (form.invalid || !this.actions()?.canAssignReceiver || this.busy()) return; this.run(this.api.assignReceivingDivision(this.row().id, this.receivingDivisionId), 'Receiving division assigned.'); }
  protected amend(form: NgForm) { if (form.invalid || !this.actions()?.canAmendStatus || this.busy()) return; this.run(this.api.amendStatus(this.row().id, this.amendment), 'Status amendment recorded.'); }
  private run(request: Observable<unknown>, message: string, done?: () => void) { this.busy.set(true); this.error.set(''); this.message.set(''); request.subscribe({ next: () => { this.busy.set(false); this.message.set(message); done?.(); this.changed.emit(); this.load(); }, error: error => { this.busy.set(false); this.error.set(apiError(error)); } }); }
}
