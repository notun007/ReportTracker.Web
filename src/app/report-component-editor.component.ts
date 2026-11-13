import { Component, OnChanges, SimpleChanges, DestroyRef, ElementRef, Injector, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DashboardService, apiError } from './dashboard.service';
import { Subscription } from 'rxjs';
import { ComponentDefinition, Lookups, ReportDefinition } from './dashboard.models';

import { ContributorAssignmentTableComponent } from './contributor-assignment-table.component';
import { ComponentContributorsComponent, ContributorSelection, contributorError, contributorRoleNames, contributorRows, flattenContributors } from './component-contributors.component';

export interface ReportComponentDraft {
  clientId:string; name:string; description:string;
  providerDivisionId:string; contributors:ContributorSelection[];
  deadlineOffsetDays:number;
}

@Component({
  selector:'app-report-component-editor', imports:[FormsModule, ComponentContributorsComponent, ContributorAssignmentTableComponent],
  styles:[`
    :host { display:block; container:report-form / inline-size; padding:12px 16px; }
    form[hidden] { display:none; }
    .component-toast { max-width:calc(100% - 48px); }
    @container report-form (max-width:880px) { form { grid-template-columns:minmax(0,1fr); } }
    header { display:flex; justify-content:space-between; gap:8px 12px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
    h2 { scroll-margin-top:76px; margin:0; font-size:22px; letter-spacing:-.025em; color:#12375f; } p { color:var(--muted); line-height:1.6; }
    .context { padding:12px; background:var(--surface); border:1px solid var(--line); border-radius:6px; font-size:12px; }
    .context span { display:block; margin-top:4px; }
    form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; align-items:start; }
    .form-error,.context,form p,form small,.form-grid,.description { grid-column:1 / -1; }
    label { min-width:0; }
    label { display:grid; gap:6px; font-size:12px; font-weight:600; color:#344258; }
    input,select,textarea { width:100%; min-width:0; min-height:40px; border:1px solid var(--control-line); border-radius:8px; padding:9px 11px; background:var(--control-fill); box-shadow:var(--control-shadow); color:var(--ink); }
    input:focus-visible,select:focus-visible,textarea:focus-visible { outline:2px solid #4285c5; outline-offset:2px; }
    .header-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-left:auto; }
    .view-components { display:inline-flex; align-items:center; min-height:36px; white-space:nowrap; }
    .component-grid { scroll-margin-top:76px; margin-top:0; min-width:0; border:1px solid var(--line); border-radius:var(--workspace-radius); overflow:hidden; box-shadow:var(--panel-shadow); }
    .contributor-dialog { width:min(1040px,calc(100% - 24px)); height:min(720px,92dvh); max-width:calc(100% - 24px); max-height:92dvh; overflow:hidden; }
    .contributor-dialog[open] { display:flex; flex-direction:column; }
    .contributor-dialog .modal-header { align-items:start; flex:none; }
    .contributor-dialog .editor-body { flex:1; min-height:0; overflow:auto; padding:16px 22px; }
    .contributor-dialog .editor-footer { flex:none; display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; padding:12px 22px; border-top:1px solid var(--line); background:#f5f9fe; }
    .contributor-dialog .editor-body .error-banner { margin:12px 0 0; }
    @media(max-width:640px) { .contributor-dialog .editor-body,.contributor-dialog .editor-footer { padding-inline:12px; } }
    form:not([hidden]) + .component-grid { margin-top:12px; }
    .component-grid table { min-width:760px; } .component-grid td { vertical-align:top; }
    @media(max-width:640px) { :host { padding:10px; } form { grid-template-columns:minmax(0,1fr); } }
  `],
  template:`
    <header>
      <h2 #componentHeading id="component-editor-title" tabindex="-1">{{ embedded() && !creating() ? 'Components' : component() ? 'Edit component' : 'Add component' }}</h2>
      <div class="header-actions">
        @if (creating() || (!embedded() && !component())) {
          <a class="link-button view-components" [attr.href]="'#' + componentListId()" (click)="viewComponents($event)">View components</a>
        }
        @if (embedded() && !creating()) {
          <button class="secondary" type="button" (click)="loadComponents()" [disabled]="!reportId || loadingComponents() || saving() || !!editingContributors()">Refresh</button>
          <button type="button" class="primary" [disabled]="saving() || !!editingContributors()" (click)="creating.set(true)">Add component</button>
        } @else if (!embedded()) {
          <button type="button" class="icon-button" aria-label="Close component panel" [disabled]="saving()" (click)="cancelled.emit()">×</button>
        }
        @if (!embedded() || creating()) {
          <button class="secondary" type="button" [disabled]="saving()" (click)="cancelCreate()">Cancel</button>
          <button class="primary" type="submit" form="report-component-form" [disabled]="saving() || loadingComponents()">{{ saving() ? 'Creating...' : component() ? 'Update component' : reportId ? 'Create component' : 'Add to report' }}</button>
        }
      </div>
    </header>
    
    @if (message()) { <div class="success-banner" role="status">{{ message() }}</div> }
    @if (creationToast()) { <div class="toast component-toast" role="status">Component created.</div> }
    <form id="report-component-form" class="report-inline-fields" [hidden]="embedded() && !creating()" #componentForm="ngForm" (ngSubmit)="save(componentForm)">
      <fieldset [disabled]="saving()" style="display:contents">
      @if (!embedded()) { <label class="report-field"><span>Report</span><select name="componentReport" [(ngModel)]="reportId" (ngModelChange)="reportChanged()" [disabled]="!!component() || saving()"><option value="">New report{{ reportName() ? ' - ' + reportName() : ' (draft)' }}</option>@for (report of reports(); track report.id) { <option [value]="report.id">{{ report.code }} - {{ report.name }}</option> }</select></label> }
      <label class="report-field"><span>Component name</span><input name="componentName" [(ngModel)]="fields.name" required maxlength="250"></label>
      <label class="report-field"><span>Preparing division</span><select name="componentPreparingDivision" [(ngModel)]="fields.providerDivisionId" (ngModelChange)="fields.contributors=[]" required><option value="">Choose preparing division</option>@for (division of lookups().divisions; track division.id) { <option [value]="division.id">{{ division.name }}</option> }</select></label>
      <label class="report-field description"><span>Description</span><textarea name="componentDescription" [(ngModel)]="fields.description" rows="2" maxlength="1000"></textarea></label>
      <app-component-contributors [automaticRows]="true" [rows]="fields.contributors" [members]="teamMembers(fields.providerDivisionId)" [disabled]="saving()" (rowsChange)="fields.contributors=$event" />
      </fieldset>@if ((!reportId && error()) || validationError()) { <div class="error-banner form-error" role="alert">{{ (!reportId && error()) || validationError() }}</div> }
    </form>
    <section class="component-grid" [id]="componentListId()" tabindex="-1" aria-label="Report components">
      @if (loadError()) { <div class="error-banner" role="alert">{{ loadError() }} <button type="button" (click)="loadComponents()">Retry</button></div> }
      <div class="table-wrap" tabindex="0" aria-label="Components grid"><table><thead><tr><th>Component</th><th>Preparing division</th><th>Component contributors</th><th>Actions</th></tr></thead><tbody>
        @for (row of gridRows(); track row.id) { <tr><td><strong>{{ row.name }}</strong><span>{{ row.description }}</span></td><td>{{ divisionName(row.providerDivisionId) }}</td><td>@for (member of membersFor(row); track member.userId) { <span>{{ teamMemberName(member.userId) }} · {{ contributorRoleNames(member) }}</span> } @empty { Unassigned }</td><td>@if (reportId) { <button type="button" class="link-button" [disabled]="saving() || (!!editingContributors() && editingContributors()?.id !== row.id)" (click)="editContributors(row)"
          aria-haspopup="dialog"
          [attr.data-contributor-action]="row.id" [attr.aria-label]="'Edit contributors for '+row.name">Edit contributors</button> }</td></tr>
        }
        @empty { <tr><td colspan="4" class="empty">{{ loadingComponents() ? 'Loading components...' : loadError() ? 'Components could not be loaded.' : emptyComponentsMessage() }}</td></tr> }
      </tbody></table></div>
    </section>
    <dialog #contributorDialog class="modal contributor-dialog" aria-label="Edit contributors" (cancel)="closeContributorEditor($event)">
      @if (editingContributors(); as row) {
        <header class="modal-header">
          <div><h2>Edit contributors</h2><p>{{ row.name }}</p></div>
          <button type="button" class="icon-button" aria-label="Close contributor editor" [disabled]="saving()" (click)="closeContributorEditor()" autofocus>×</button>
        </header>
        <div class="editor-body">
          <app-contributor-assignment-table #assignment [rows]="contributorDraft()" [members]="teamMembers(row.providerDivisionId)" [disabled]="saving()" (rowsChange)="contributorDraft.set($event); contributorSaveError.set('')" />
          @if (contributorSaveError()) { <div class="error-banner" role="alert">{{ contributorSaveError() }}</div> }
        </div>
        <footer class="editor-footer">
          <button type="button" class="secondary" [disabled]="saving()" (click)="closeContributorEditor()">Cancel</button>
          <button type="button" class="primary" [disabled]="saving() || assignment.hasPendingEntry()" (click)="saveContributors()">{{ saving() ? 'Saving…' : 'Save contributors' }}</button>
        </footer>
      }
    </dialog>
  `
})
export class ReportComponentEditorComponent implements OnChanges {
  private readonly api=inject(DashboardService); private readonly destroyRef=inject(DestroyRef);
  private readonly contributorDialog=viewChild<ElementRef<HTMLDialogElement>>('contributorDialog');
  private readonly host=inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector=inject(Injector);
  readonly embedded=input(false);
  protected readonly creating=signal(false);
  protected componentListId() { return this.embedded() ? 'report-component-list' : 'component-editor-list'; }
  private readonly componentHeading = viewChild<ElementRef<HTMLHeadingElement>>('componentHeading');

  protected viewComponents(event: MouseEvent) {
    if (!this.embedded() || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (this.saving()) return;
    this.creating.set(false);
    afterNextRender(() => {
      const heading = this.componentHeading()?.nativeElement;
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'nearest' });
    }, { injector: this.injector });
  }
  isSaving() { return this.saving(); }
  protected cancelCreate() { if(this.embedded()) this.creating.set(false); else this.cancelled.emit(); }
  readonly initialReportId=input(''); readonly reports=input<ReportDefinition[]>([]); readonly drafts=input<ReportComponentDraft[]>([]); readonly draftReceivingDivisionId=input('');
  readonly lookups=input.required<Lookups>(); readonly reportName=input('');
  readonly component=input<ReportComponentDraft|null>(null); readonly defaultLeadDays=input(1); readonly sessionKey=input(0); readonly error=input('');
  readonly saved=output<ReportComponentDraft>(); readonly cancelled=output<void>(); protected readonly validationError=signal('');
  protected fields=this.empty(); protected reportId='';
  protected readonly saving=signal(false); protected readonly message=signal('');
  private componentRequest?:Subscription;
  protected readonly rows=signal<ComponentDefinition[]>([]); protected readonly loadingComponents=signal(false); protected readonly loadError=signal('');
  protected readonly creationToast = signal(false);
  private creationToastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.creationToastTimer));
  }

  private showCreationToast() {
    clearTimeout(this.creationToastTimer);
    this.creationToast.set(true);
    this.creationToastTimer = setTimeout(() => this.creationToast.set(false), 5000);
  }

  ngOnChanges(changes:SimpleChanges) {
    if (changes['component'] || changes['sessionKey'] || changes['initialReportId']) {
      this.fields=this.component() ? {...this.component()!} : {...this.empty(),deadlineOffsetDays:this.defaultLeadDays()};
      this.validationError.set('');this.message.set('');this.editingContributors.set(null);this.creating.set(false);this.reportId=this.component() ? '' : this.reports().find(report=>report.id===this.initialReportId())?.id ?? this.reports()[0]?.id ?? '';this.loadComponents();
    } else if (changes['reports'] && !this.reportId && !this.component()) { this.reportId=this.reports()[0]?.id ?? '';this.loadComponents(); }
  }
  protected loadComponents() {
    this.componentRequest?.unsubscribe();this.rows.set([]);this.loadError.set('');this.loadingComponents.set(!!this.reportId);
    if(!this.reportId)return;
    const reportId=this.reportId;
    this.componentRequest=this.api.components(reportId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:rows=>{if(this.reportId===reportId){this.rows.set([...rows].sort((a,b)=>a.name.localeCompare(b.name)));this.loadingComponents.set(false);}},
      error:error=>{if(this.reportId===reportId){this.loadError.set(apiError(error));this.loadingComponents.set(false);}}
    });
  }
  protected gridRows(){return this.reportId ? this.rows() : this.drafts().map(row=>({...row,id:row.clientId}));}
  protected divisionName(id:string){return this.lookups().divisions.find(row=>row.id===id)?.name ?? 'Not configured';}
  protected teamMemberName(id:string){return this.lookups().officers.find(row=>row.id===id)?.name ?? 'Unavailable team member';}
  protected readonly contributorRoleNames=contributorRoleNames;
  protected readonly editingContributors=signal<ComponentDefinition|null>(null);
  protected readonly contributorDraft=signal<ContributorSelection[]>([]);
  protected readonly contributorSaveError=signal('');
  protected membersFor(row:ComponentDefinition|ReportComponentDraft){return 'id' in row && 'primaryOfficerId' in row ? contributorRows(row) : row.contributors ?? [];}
  protected editContributors(row:ComponentDefinition|ReportComponentDraft){
    if (!('id' in row) || this.saving()) return;
    this.contributorDraft.set(contributorRows(row));this.contributorSaveError.set('');this.editingContributors.set(row);
    afterNextRender(() => {
      const dialog=this.contributorDialog()?.nativeElement;
      if(dialog && !dialog.open && this.editingContributors()?.id===row.id) dialog.showModal();
    }, {injector:this.injector});
  }
  protected closeContributorEditor(event?:Event) {
    event?.preventDefault();
    if(this.saving()) return;
    this.contributorDialog()?.nativeElement.close();
    const id=this.editingContributors()?.id;
    this.editingContributors.set(null);
    this.contributorDraft.set([]);
    this.contributorSaveError.set('');
    if(id) afterNextRender(() => this.host.nativeElement.querySelector<HTMLButtonElement>('[data-contributor-action="'+CSS.escape(id)+'"]')?.focus(), {injector:this.injector});
  }
  protected saveContributors(){
    const row=this.editingContributors(),draft=this.contributorDraft();
    if(!row || !this.reportId || this.saving())return;
    const error=contributorError(draft,this.teamMembers(row.providerDivisionId));
    if(error){this.contributorSaveError.set(error);return;}
    this.saving.set(true);this.contributorSaveError.set('');this.message.set('');
    this.api.setComponentContributors(this.reportId,row.id,flattenContributors(draft)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:saved=>{this.rows.update(rows=>rows.map(item=>item.id===saved.id?saved:item));this.saving.set(false);this.closeContributorEditor();this.message.set('Component contributors saved for future cycles.');},
      error:error=>{this.contributorSaveError.set(apiError(error));this.saving.set(false);}
    });
  }
  protected emptyComponentsMessage() {
    const report = this.selectedReport();
    return report ? 'No components added to ' + report.code + ' — ' + report.name + '.' : 'No components added to this report.';
  }

  protected selectedReport(){return this.reports().find(report=>report.id===this.reportId);}
  protected receiver(){
    if(!this.reportId)return this.draftReceivingDivisionId();
    const configured=this.selectedReport()?.receivingDivisionId;if(configured)return configured;
    const receivers=new Set(this.rows().map(row=>row.receivingDivisionId));
    return receivers.size===1 ? [...receivers][0] : undefined;
  }
  protected reportChanged(){this.validationError.set('');this.message.set('');this.editingContributors.set(null);this.loadComponents();}
  protected teamMembers(divisionId:string){return this.lookups().officers.filter(member=>member.divisionId===divisionId);}
  private empty():ReportComponentDraft{return {clientId:'',name:'',description:'',providerDivisionId:'',contributors:[],deadlineOffsetDays:1};}
  protected save(form:NgForm){
    if(this.saving() || this.loadingComponents())return;
    this.validationError.set('');this.message.set('');
    if(!this.fields.name.trim()){this.validationError.set('Enter a component name.');form.control.markAllAsTouched();return;}
    if(!this.fields.providerDivisionId){this.validationError.set('Choose a preparing division.');form.control.markAllAsTouched();return;}
    const assignmentError=contributorError(this.fields.contributors,this.teamMembers(this.fields.providerDivisionId));
    if(assignmentError){this.validationError.set(assignmentError);return;}
    if(form.invalid){this.validationError.set('Check the entered values.');form.control.markAllAsTouched();return;}
    if(!this.receiver()){this.validationError.set(this.loadError() ? 'Refresh the components grid to check the receiving division before saving.' : 'This report has no receiving division configured and no common receiving division on its components. Configure the report receiving division before saving.');return;}
    const draft={...this.fields,clientId:this.fields.clientId||crypto.randomUUID(),name:this.fields.name.trim(),description:this.fields.description.trim()};
    if(!this.reportId){this.saved.emit(draft);return;}
    const {clientId,deadlineOffsetDays,...body}=draft;
    this.saving.set(true);this.validationError.set('');this.message.set('');
    this.api.createComponent(this.reportId,{...body,contributors:flattenContributors(body.contributors),receivingDivisionId:this.receiver()}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:row=>{this.rows.update(rows=>[...rows,row].sort((a,b)=>a.name.localeCompare(b.name)));this.fields=this.empty();form.resetForm({componentReport:this.reportId,
        componentName:'',componentDescription:'',componentPreparingDivision:''});this.showCreationToast();this.creating.set(false);this.saving.set(false);},
      error:error=>{this.validationError.set(apiError(error));this.saving.set(false);}
    });
  }
}
