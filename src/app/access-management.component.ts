import { Component, OnChanges, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AccessCatalog, AccessRole, RoleAssignment, UserAccess } from './access.models';
import { SessionService, apiError } from './dashboard.service';

@Component({selector:'app-access-management',imports:[FormsModule],templateUrl:'./access-management.component.html',styleUrl:'./access-management.component.scss'})
export class AccessManagementComponent implements OnChanges {
  readonly mode=input<'roles'|'permissions'|'user'>('roles'); readonly userId=input(''); readonly saved=output<void>(); readonly closed=output<void>();
  private readonly http=inject(HttpClient); private readonly session=inject(SessionService);
  protected readonly catalog=signal<AccessCatalog|null>(null); protected readonly access=signal<UserAccess|null>(null);
  protected readonly busy=signal(false); protected readonly error=signal(''); protected readonly message=signal('');
  protected readonly selected=signal<AccessRole|null>(null); protected readonly editing=signal(false);
  protected form={code:'',name:'',description:'',isActive:true,permissions:[] as string[]};
  protected assignments:RoleAssignment[]=[];
  protected canEdit(){return this.session.user()?.permissions.includes('roles.manage')??false;}
  ngOnChanges(){this.selected.set(null);this.editing.set(false);this.load();}
  protected load(){this.busy.set(true);this.error.set('');this.http.get<AccessCatalog>('/api/access/catalog').subscribe({next:c=>{this.catalog.set(c);if(this.mode()==='user')this.loadUser();else this.busy.set(false);},error:e=>this.fail(e)});}
  private loadUser(){this.http.get<UserAccess>('/api/access/users/'+this.userId()).subscribe({next:a=>{this.access.set(a);this.assignments=a.assignments.map(x=>({roleId:x.roleId,scope:x.scope,divisionId:x.divisionId,reportDefinitionId:x.reportDefinitionId}));this.busy.set(false);},error:e=>this.fail(e)});}
  protected edit(role:AccessRole|null){this.selected.set(role);this.form=role?{code:role.code,name:role.name,description:role.description??'',isActive:role.isActive,permissions:[...role.permissions]}:{code:'',name:'',description:'',isActive:true,permissions:[]};this.editing.set(true);this.message.set('');}
  protected groups(){return [...new Set(this.catalog()?.permissions.map(p=>p.group)??[])];}
  protected permissions(group:string){return this.catalog()?.permissions.filter(p=>p.group===group)??[];}
  protected granting(code:string){return this.catalog()?.roles.filter(r=>r.isActive&&r.permissions.includes(code)).map(r=>r.name).join(', ')||'No active roles';}
  protected toggle(code:string,checked:boolean){this.form.permissions=checked?[...this.form.permissions,code]:this.form.permissions.filter(p=>p!==code);}
  protected saveRole(){if(this.busy())return;this.busy.set(true);this.error.set('');const role=this.selected();const request=role?this.http.put('/api/access/roles/'+role.id,{...this.form,rowVersion:role.rowVersion}):this.http.post('/api/access/roles',this.form);request.subscribe({next:()=>{this.editing.set(false);this.success('Role saved.');this.load();this.session.load().subscribe({error:()=>{}});},error:e=>this.fail(e)});}
  protected add(){this.assignments.push({roleId:'',scope:'',divisionId:null,reportDefinitionId:null});}
  protected changeScope(row:RoleAssignment){row.divisionId=null;row.reportDefinitionId=null;}
  protected globalOnly(row:RoleAssignment){const r=this.catalog()?.roles.find(r=>r.id===row.roleId);return r?.permissions.some(code=>this.catalog()?.permissions.some(p=>p.code===code&&p.globalOnly))??false;}
  protected valid(){return this.assignments.every(r=>!!r.roleId&&(['Global','Division','Report','DivisionReport'].includes(r.scope))&&(!this.globalOnly(r)||r.scope==='Global')&&(!['Division','DivisionReport'].includes(r.scope)||!!r.divisionId)&&(!['Report','DivisionReport'].includes(r.scope)||!!r.reportDefinitionId));}
  protected saveAccess(){const a=this.access();if(!a||!this.valid()||this.busy())return;this.busy.set(true);this.error.set('');this.http.put('/api/access/users/'+a.userId,{assignments:this.assignments,rowVersion:a.rowVersion}).subscribe({next:()=>{this.success('Access saved.');this.saved.emit();this.loadUser();this.session.load().subscribe({error:()=>{}});},error:e=>this.fail(e)});}
  protected division(id:string|null){return this.catalog()?.divisions.find(d=>d.id===id)?.name??id??'';}
  protected report(id:string|null){return this.catalog()?.reports.find(d=>d.id===id)?.name??id??'';}
  private success(text:string){this.message.set(text);setTimeout(()=>this.message.set(''),4500);}
  private fail(e:unknown){this.busy.set(false);this.error.set(apiError(e));}
}
