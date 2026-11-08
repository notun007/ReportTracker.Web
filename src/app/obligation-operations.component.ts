import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { DashboardService, SessionService, apiError } from './dashboard.service';
import { EvidenceItem, Obligation } from './dashboard.models';

@Component({
  selector:'app-obligation-operations', imports:[CommonModule, FormsModule],
  template:`
    <div class="modal-header"><div><h2>Submission controls</h2><p>{{ row().report }} · {{ row().period }} · {{ row().obligation }}</p></div><button class="icon-button" type="button" (click)="closed.emit()" aria-label="Close">×</button></div>
    @if(error()){<div class="error-banner" role="alert">{{error()}}</div>} @if(message()){<div class="success-banner" role="status">{{message()}}</div>}
    <div class="operations-tabs" role="tablist"><button [class.active]="tab()==='Evidence'" (click)="tab.set('Evidence')">Evidence</button><button [class.active]="tab()==='Receipt'" (click)="tab.set('Receipt')">Receipt</button><button [class.active]="tab()==='Extension'" (click)="tab.set('Extension')">Extension</button><button [class.active]="tab()==='Amendment'" (click)="tab.set('Amendment')">Amendment</button></div>
    <div class="operations-content">
      @if(tab()==='Evidence'){
        <section><h3>Confirmation evidence</h3><p>Upload only confirmation documents or images. Do not upload the regulatory report contents.</p><label class="file-drop">Evidence file<input type="file" accept=".pdf,.png,.jpg,.jpeg" (change)="chooseFile($event)"><span>PDF, PNG or JPEG · maximum 10 MB</span></label><button class="primary" type="button" (click)="upload()" [disabled]="busy()||!file">Upload evidence</button></section>
        <div class="evidence-list">@for(item of evidence();track item.id){<article><div><strong>{{item.originalFileName}}</strong><span>{{item.uploadedBy}} · {{item.uploadedAtUtc|date:'dd MMM y, HH:mm':'+0600'}} · {{item.sizeBytes/1024|number:'1.0-0'}} KB</span></div><span class="status" [class]="item.status.toLowerCase()">{{item.status}}</span>@if(canManage()&&item.status==='Provided'){<button class="link-button" (click)="decide(item,'Verified')">Verify</button><button class="link-button danger-text" (click)="decide(item,'Rejected')">Reject</button>}</article>}@empty{<p>No evidence uploaded.</p>}</div>
      }
      @if(tab()==='Receipt'){
        <section><h3>Receipt confirmation</h3><form #receiptForm="ngForm" (ngSubmit)="saveReceipt(receiptForm)"><label>Received time (Asia/Dhaka)<input type="datetime-local" name="received" [(ngModel)]="receipt.receivedLocal" required></label><label class="checkbox"><input type="checkbox" name="disputed" [(ngModel)]="receipt.isDisputed">Receipt is disputed</label>@if(receipt.isDisputed){<label>Dispute reason<textarea name="reason" [(ngModel)]="receipt.reason" required maxlength="1000"></textarea></label>}<button class="primary" type="submit" [disabled]="busy()||receiptForm.invalid">Save receipt status</button></form></section>
      }
      @if(tab()==='Extension'){
        <section><h3>Request deadline extension</h3><form #extensionForm="ngForm" (ngSubmit)="requestExtension(extensionForm)"><label>Requested deadline (Asia/Dhaka)<input type="datetime-local" name="requested" [(ngModel)]="extension.requestedLocal" required></label><label>Reason<textarea name="reason" [(ngModel)]="extension.reason" required maxlength="1000"></textarea></label><label>Permission reference<input name="reference" [(ngModel)]="extension.permissionReference" maxlength="250"></label><button class="primary" type="submit" [disabled]="busy()||extensionForm.invalid">Submit request</button></form></section>
      }
      @if(tab()==='Amendment'){
        <section><h3>Audited status amendment</h3><p>Use this only to correct a previously recorded status. The previous value remains in the audit history.</p><form #amendmentForm="ngForm" (ngSubmit)="amend(amendmentForm)"><label>Replacement status<select name="status" [(ngModel)]="amendment.replacementStatus"><option>Not Sent</option><option>Partially Sent</option><option>Sent</option></select></label><label>Reason<textarea name="reason" [(ngModel)]="amendment.reason" required maxlength="1000"></textarea></label><button class="primary" type="submit" [disabled]="busy()||amendmentForm.invalid">Record amendment</button></form></section>
      }
    </div>`
})
export class ObligationOperationsComponent implements OnInit{
  readonly row=input.required<Obligation>(); readonly closed=output<void>(); readonly changed=output<void>();
  private readonly api=inject(DashboardService); private readonly session=inject(SessionService);
  protected readonly tab=signal('Evidence'); protected readonly evidence=signal<EvidenceItem[]>([]); protected readonly busy=signal(false); protected readonly error=signal(''); protected readonly message=signal('');
  protected file:File|null=null; protected receipt={receivedLocal:'',isDisputed:false,reason:''}; protected extension={requestedLocal:'',reason:'',permissionReference:''}; protected amendment={replacementStatus:'Not Sent',reason:''};
  protected canManage(){return this.session.user()?.permissions.includes('reports.manage')??false;}
  ngOnInit(){this.loadEvidence();}
  protected chooseFile(event:Event){this.file=(event.target as HTMLInputElement).files?.[0]??null;}
  protected upload(){if(!this.file||this.busy())return;this.run(this.api.uploadEvidence(this.row().id,this.file),'Evidence uploaded.',()=>{this.file=null;this.loadEvidence();});}
  protected decide(item:EvidenceItem,decision:string){this.run(this.api.decideEvidence(item.id,decision,decision==='Rejected'?'Rejected during review':null),`Evidence ${decision.toLowerCase()}.`,()=>this.loadEvidence());}
  protected saveReceipt(form:NgForm){if(form.invalid)return;this.run(this.api.confirmReceipt(this.row().id,{receivedAtUtc:new Date(this.receipt.receivedLocal+'+06:00').toISOString(),isDisputed:this.receipt.isDisputed,reason:this.receipt.reason||null}),'Receipt status saved.',()=>this.changed.emit());}
  protected requestExtension(form:NgForm){if(form.invalid)return;this.run(this.api.requestExtension(this.row().id,{requestedDueAtUtc:new Date(this.extension.requestedLocal+'+06:00').toISOString(),reason:this.extension.reason,permissionReference:this.extension.permissionReference||null}),'Extension request submitted.',()=>this.changed.emit());}
  protected amend(form:NgForm){if(form.invalid)return;this.run(this.api.amendStatus(this.row().id,this.amendment),'Status amendment recorded.',()=>this.changed.emit());}
  private loadEvidence(){this.api.evidence(this.row().id).subscribe({next:rows=>this.evidence.set(rows),error:error=>this.error.set(apiError(error))});}
  private run(request:any,message:string,done:()=>void){this.busy.set(true);this.error.set('');this.message.set('');request.subscribe({next:()=>{this.busy.set(false);this.message.set(message);done();},error:(error:unknown)=>{this.busy.set(false);this.error.set(apiError(error));}});}
}
