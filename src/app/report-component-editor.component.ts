import { Component, OnChanges, SimpleChanges, DestroyRef, inject, input, output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DashboardService, apiError } from './dashboard.service';
import { Subscription } from 'rxjs';
import { ComponentDefinition, Lookups, ReportDefinition } from './dashboard.models';

export interface ReportComponentDraft {
  clientId:string; name:string; description:string; isRequired:boolean; sequence:number;
  providerDivisionId:string; primaryOfficerId:string; deputyOfficerId:string;
  receiptRequired:boolean; evidenceRequired:boolean; deadlineOffsetDays:number;
}

@Component({
  selector:'app-report-component-editor', imports:[FormsModule],
  styles:[`
    :host { display:block; padding:24px; }
    header { display:flex; justify-content:space-between; gap:16px; align-items:start; margin-bottom:18px; }
    h2 { margin:0; font-size:22px; letter-spacing:-.025em; color:#12375f; } p { color:var(--muted); line-height:1.6; }
    .context { padding:12px; background:var(--surface); border:1px solid var(--line); border-radius:6px; font-size:12px; }
    .context span { display:block; margin-top:4px; }
    form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; align-items:start; }
    .form-error,.context,form p,form small,.form-grid,.description,.actions { grid-column:1 / -1; }
    label { min-width:0; }
    label { display:grid; gap:6px; font-size:12px; font-weight:600; color:#344258; }
    input,select,textarea { width:100%; min-width:0; min-height:40px; border:1px solid var(--control-line); border-radius:8px; padding:9px 11px; background:var(--control-fill); box-shadow:var(--control-shadow); color:var(--ink); }
    input:focus-visible,select:focus-visible,textarea:focus-visible { outline:2px solid #4285c5; outline-offset:2px; }
    input[type=checkbox] { width:16px; min-height:16px; margin:0; }
    .check { display:flex; gap:8px; align-items:center; }
    .actions { display:flex; gap:10px; justify-content:flex-end; position:sticky; bottom:-24px; background:white; padding:12px 0; border-top:1px solid var(--line); }
    .component-grid { margin-top:20px; min-width:0; border:1px solid var(--line); border-radius:var(--workspace-radius); overflow:hidden; box-shadow:var(--panel-shadow); }
    .grid-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:14px; background:linear-gradient(180deg,#fff,#f5f9fe); }
    .grid-heading h3 { margin:0; font-size:16px; } .grid-heading p { margin:4px 0 0; font-size:12px; }
    .component-grid table { min-width:760px; } .component-grid td { vertical-align:top; }
    @media(max-width:640px) { :host { padding:18px; } form { grid-template-columns:minmax(0,1fr); } .actions { bottom:-18px; } }
  `],
  template:`
    <header><div><h2 id="component-editor-title">{{ component() ? 'Edit component' : 'Add component' }}</h2></div><button type="button" class="icon-button" aria-label="Close component panel" [disabled]="saving()" (click)="cancelled.emit()">×</button></header>
    
    @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
    <form #componentForm="ngForm" (ngSubmit)="save(componentForm)">
      <fieldset [disabled]="saving()" style="display:contents">
      <label>Report<select name="componentReport" [(ngModel)]="reportId" (ngModelChange)="reportChanged()" [disabled]="!!component() || saving()"><option value="">New report{{ reportName() ? ' - ' + reportName() : ' (draft)' }}</option>@for (report of reports(); track report.id) { <option [value]="report.id">{{ report.code }} - {{ report.name }}</option> }</select></label>
      <label>Component name<input name="componentName" [(ngModel)]="fields.name" required maxlength="250"></label>
      <label>Preparing division<select name="componentPreparingDivision" [(ngModel)]="fields.providerDivisionId" (ngModelChange)="fields.primaryOfficerId=''; fields.deputyOfficerId=''" required><option value="">Choose preparing division</option>@for (division of lookups().divisions; track division.id) { <option [value]="division.id">{{ division.name }}</option> }</select></label>
      <label>Description<textarea name="componentDescription" [(ngModel)]="fields.description" rows="2" maxlength="1000"></textarea></label>
      <label>Primary preparing officer<select name="componentPrimaryOfficer" [(ngModel)]="fields.primaryOfficerId" (ngModelChange)="primaryOfficerChanged()" required><option value="">Choose officer</option>@for (officer of officers(); track officer.id) { <option [value]="officer.id">{{ officer.name }}</option> }</select></label>
      <label>Deputy preparing officer (optional)<select name="componentDeputyOfficer" [(ngModel)]="fields.deputyOfficerId"><option value="">None</option>@for (officer of deputyOfficers(); track officer.id) { <option [value]="officer.id">{{ officer.name }}</option> }</select></label>
      <label>Display order (optional)<input type="number" name="componentOrder" [(ngModel)]="fields.sequence" placeholder="0" min="0" max="10000" step="1"></label>
      <label class="check"><input type="checkbox" name="componentRequired" [(ngModel)]="fields.isRequired">Mandatory component</label>
      <label class="check"><input type="checkbox" name="componentReceipt" [(ngModel)]="fields.receiptRequired">Receipt confirmation required</label>
      <label class="check"><input type="checkbox" name="componentEvidence" [(ngModel)]="fields.evidenceRequired">Confirmation evidence required</label>
      </fieldset>@if ((!reportId && error()) || validationError()) { <div class="error-banner form-error" role="alert">{{ (!reportId && error()) || validationError() }}</div> }<div class="actions"><button class="secondary" type="button" [disabled]="saving()" (click)="cancelled.emit()">Cancel</button><button class="primary" type="submit" [disabled]="saving() || loadingComponents()">{{ saving() ? 'Creating...' : component() ? 'Update component' : reportId ? 'Create component' : 'Add to report' }}</button></div>
    </form>
    <section class="component-grid" aria-label="Report components">
      <div class="grid-heading"><div><h3>Components ({{ gridRows().length }})</h3><p>{{ selectedReport() ? selectedReport()!.code + ' - ' + selectedReport()!.name : reportName() || 'New report' }}</p></div><button class="secondary" type="button" (click)="loadComponents()" [disabled]="!reportId || loadingComponents() || saving()">Refresh</button></div>
      @if (loadError()) { <div class="error-banner" role="alert">{{ loadError() }} <button type="button" (click)="loadComponents()">Retry</button></div> }
      <div class="table-wrap" tabindex="0" aria-label="Components grid"><table><thead><tr><th>Component</th><th>Preparing division</th><th>Primary officer</th><th>Deputy officer</th><th>Order</th><th>Requirements</th></tr></thead><tbody>
        @for (row of gridRows(); track row.id) { <tr><td><strong>{{ row.name }}</strong><span>{{ row.description }}</span></td><td>{{ divisionName(row.providerDivisionId) }}</td><td>{{ officerName(row.primaryOfficerId) }}</td><td>{{ officerName(row.deputyOfficerId) }}</td><td>{{ row.sequence }}</td><td>{{ row.isRequired ? 'Mandatory' : 'Optional' }}<span>{{ row.receiptRequired ? 'Receipt required' : 'No receipt confirmation' }}</span><span>{{ row.evidenceRequired ? 'Evidence required' : 'No evidence required' }}</span></td></tr> }
        @empty { <tr><td colspan="6" class="empty">{{ loadingComponents() ? 'Loading components...' : loadError() ? 'Components could not be loaded.' : 'No components added to this report.' }}</td></tr> }
      </tbody></table></div>
    </section>
  `
})
export class ReportComponentEditorComponent implements OnChanges {
  private readonly api=inject(DashboardService); private readonly destroyRef=inject(DestroyRef);
  readonly initialReportId=input(''); readonly reports=input<ReportDefinition[]>([]); readonly drafts=input<ReportComponentDraft[]>([]); readonly draftReceivingDivisionId=input('');
  readonly lookups=input.required<Lookups>(); readonly reportName=input('');
  readonly component=input<ReportComponentDraft|null>(null); readonly defaultLeadDays=input(1); readonly sessionKey=input(0); readonly error=input('');
  readonly saved=output<ReportComponentDraft>(); readonly cancelled=output<void>(); protected readonly validationError=signal('');
  protected fields=this.empty(); protected reportId='';
  protected readonly saving=signal(false); protected readonly message=signal('');
  private componentRequest?:Subscription;
  protected readonly rows=signal<ComponentDefinition[]>([]); protected readonly loadingComponents=signal(false); protected readonly loadError=signal('');
  ngOnChanges(changes:SimpleChanges) {
    if (changes['component'] || changes['sessionKey'] || changes['initialReportId']) {
      this.fields=this.component() ? {...this.component()!} : {...this.empty(),deadlineOffsetDays:this.defaultLeadDays()};
      this.validationError.set('');this.message.set('');this.reportId=this.component() ? '' : this.reports().find(report=>report.id===this.initialReportId())?.id ?? this.reports()[0]?.id ?? '';this.loadComponents();
    } else if (changes['reports'] && !this.reportId && !this.component()) { this.reportId=this.reports()[0]?.id ?? '';this.loadComponents(); }
  }
  protected loadComponents() {
    this.componentRequest?.unsubscribe();this.rows.set([]);this.loadError.set('');this.loadingComponents.set(!!this.reportId);
    if(!this.reportId)return;
    const reportId=this.reportId;
    this.componentRequest=this.api.components(reportId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:rows=>{if(this.reportId===reportId){this.rows.set([...rows].sort((a,b)=>a.sequence-b.sequence));this.loadingComponents.set(false);}},
      error:error=>{if(this.reportId===reportId){this.loadError.set(apiError(error));this.loadingComponents.set(false);}}
    });
  }
  protected gridRows(){return this.reportId ? this.rows() : this.drafts().map(row=>({...row,id:row.clientId}));}
  protected divisionName(id:string){return this.lookups().divisions.find(row=>row.id===id)?.name ?? 'Not configured';}
  protected officerName(id:string|null){return this.lookups().officers.find(row=>row.id===id)?.name ?? 'None';}
  protected selectedReport(){return this.reports().find(report=>report.id===this.reportId);}
  protected receiver(){
    if(!this.reportId)return this.draftReceivingDivisionId();
    const configured=this.selectedReport()?.receivingDivisionId;if(configured)return configured;
    const receivers=new Set(this.rows().map(row=>row.receivingDivisionId));
    return receivers.size===1 ? [...receivers][0] : undefined;
  }
  protected reportChanged(){this.validationError.set('');this.message.set('');this.loadComponents();}
  protected officers(){return this.lookups().officers.filter(officer=>officer.divisionId===this.fields.providerDivisionId);}
  protected deputyOfficers(){return this.officers().filter(officer=>officer.id!==this.fields.primaryOfficerId);}
  protected primaryOfficerChanged(){if(this.fields.deputyOfficerId===this.fields.primaryOfficerId)this.fields.deputyOfficerId='';}
  private empty():ReportComponentDraft{return {clientId:'',name:'',description:'',isRequired:true,sequence:0,providerDivisionId:'',primaryOfficerId:'',deputyOfficerId:'',receiptRequired:false,evidenceRequired:false,deadlineOffsetDays:1};}
  protected save(form:NgForm){
    if(this.saving() || this.loadingComponents())return;
    this.validationError.set('');this.message.set('');
    this.fields.sequence=this.fields.sequence ?? 0;
    if(!this.fields.name.trim()){this.validationError.set('Enter a component name.');form.control.markAllAsTouched();return;}
    if(!this.fields.providerDivisionId || !this.fields.primaryOfficerId){this.validationError.set('Choose a preparing division and a primary preparing officer.');form.control.markAllAsTouched();return;}
    if(form.invalid){this.validationError.set('Check the entered values. Display order must be between 0 and 10000.');form.control.markAllAsTouched();return;}
    if(!this.receiver()){this.validationError.set(this.loadError() ? 'Refresh the components grid to check the receiving division before saving.' : 'This report has no receiving division configured and no common receiving division on its components. Configure the report receiving division before saving.');return;}
    if(this.fields.primaryOfficerId===this.fields.deputyOfficerId){this.validationError.set('Choose a different deputy preparing officer.');return;}
    if(!Number.isInteger(this.fields.sequence)){this.validationError.set('Display order must be a whole number.');return;}
    const draft={...this.fields,clientId:this.fields.clientId||crypto.randomUUID(),name:this.fields.name.trim(),description:this.fields.description.trim()};
    if(!this.reportId){this.saved.emit(draft);return;}
    const {clientId,deadlineOffsetDays,...body}=draft;
    this.saving.set(true);this.validationError.set('');this.message.set('');
    this.api.createComponent(this.reportId,{...body,receivingDivisionId:this.receiver(),deputyOfficerId:body.deputyOfficerId||null}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:row=>{this.rows.update(rows=>[...rows,row].sort((a,b)=>a.sequence-b.sequence));this.fields=this.empty();form.resetForm({componentReport:this.reportId,
        componentName:'',componentDescription:'',componentPreparingDivision:'',componentPrimaryOfficer:'',componentDeputyOfficer:'',
        componentOrder:0,componentRequired:true,componentReceipt:false,componentEvidence:false});this.message.set('Component created. You can add another component to this report. Existing reporting cycles are unchanged.');this.saving.set(false);},
      error:error=>{this.validationError.set(apiError(error));this.saving.set(false);}
    });
  }
}
