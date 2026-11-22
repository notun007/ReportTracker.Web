import { Component, DestroyRef, OnChanges, SimpleChanges, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserItem } from './dashboard.models';
import { SessionService, apiError } from './dashboard.service';
import { MenuIconComponent } from './menu-icon.component';
import { AccessRole } from './access.models';
interface UserRoleMapping { userId:string; user:string; rowVersion:string; roleIds:string[]; roles:AccessRole[] }
@Component({selector:'app-user-role-editor',imports:[FormsModule,MenuIconComponent],templateUrl:'./user-role-editor.component.html',styleUrls:['./user-role-editor.component.scss','./user-role-editor-details.component.scss','./user-role-editor-drawer.component.scss']})
export class UserRoleEditorComponent implements OnChanges {
  readonly drawer=input(false); readonly user=input.required<UserItem>(); readonly saved=output<void>(); readonly closed=output<void>();
  private readonly http=inject(HttpClient); private readonly session=inject(SessionService); private readonly destroy=inject(DestroyRef);
  protected readonly mapping=signal<UserRoleMapping|null>(null); protected readonly selectedIds=signal<string[]>([]);
  protected readonly busy=signal(false); protected readonly reloadRequired=signal(false); protected readonly error=signal('');
  protected readonly toast=signal(''); protected readonly query=signal(''); protected readonly prompt=signal<'close'|'reload'|null>(null);
  private timer?:ReturnType<typeof setTimeout>;
  protected readonly blocked=computed(()=>this.busy()||this.reloadRequired());
  protected readonly dirty=computed(()=>JSON.stringify([...this.selectedIds()].sort())!==JSON.stringify([...(this.mapping()?.roleIds??[])].sort()));
  protected readonly roles=computed(()=>{const term=this.query().trim().toLowerCase();return (this.mapping()?.roles??[]).filter(r=>[r.name,r.description??'',r.code].join(' ').toLowerCase().includes(term));});
  constructor(){this.destroy.onDestroy(()=>clearTimeout(this.timer));}
  ngOnChanges(changes:SimpleChanges){if(changes['user']?.previousValue?.id===this.user().id)return;this.mapping.set(null);this.selectedIds.set([]);this.query.set('');this.load();}
  protected load(){this.busy.set(true);this.error.set('');this.http.get<UserRoleMapping>('/api/access/users/'+this.user().id+'/roles').pipe(takeUntilDestroyed(this.destroy)).subscribe({next:data=>this.accept(data),error:e=>this.fail(e)});}
  private accept(data:UserRoleMapping){this.mapping.set(data);this.selectedIds.set([...data.roleIds]);this.busy.set(false);this.reloadRequired.set(false);this.prompt.set(null);}
  protected toggle(role:AccessRole,checked:boolean){if(this.blocked())return;this.selectedIds.update(ids=>checked?[...new Set([...ids,role.id])]:ids.filter(id=>id!==role.id));}
  protected selectable(role:AccessRole){return role.isActive||this.mapping()?.roleIds.includes(role.id);}
  protected refresh(){if(this.dirty()&&!this.reloadRequired())this.prompt.set('reload');else this.load();}
  requestClose(){if(!this.busy())this.close();}
  protected close(){if(this.dirty()&&!this.reloadRequired())this.prompt.set('close');else this.closed.emit();}
  protected confirmPrompt(){if(this.busy())return;const action=this.prompt();this.prompt.set(null);if(action==='close')this.closed.emit();else this.load();}
  protected discard(){const data=this.mapping();if(data)this.accept(data);}
  protected initials(){return this.user().displayName.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase();}
  protected description(role:AccessRole){return role.description||({SYS_ADMIN:'Maintain users, roles and system settings.',REPORT_ADMIN:'Configure reports and coordinate reporting activities.',REPORT_PREPARER:'Prepare components assigned to you.',COMPONENT_RECEIVER:'Receive components assigned to you.',FINAL_SUBMITTER:'Submit reports assigned to you.'} as Record<string,string>)[role.code]||'Use the permissions configured for this role.';}
  protected save(){const current=this.mapping();if(!current||this.blocked()||!this.dirty())return;this.prompt.set(null);this.busy.set(true);this.error.set('');
    this.http.put('/api/access/users/'+current.userId+'/roles',{roleIds:this.selectedIds(),rowVersion:current.rowVersion}).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:()=>{
      this.reloadRequired.set(true);this.http.get<UserRoleMapping>('/api/access/users/'+current.userId+'/roles').pipe(takeUntilDestroyed(this.destroy)).subscribe({next:data=>{this.accept(data);this.saved.emit();this.toast.set('Roles updated for '+data.user+'.');clearTimeout(this.timer);this.timer=setTimeout(()=>this.toast.set(''),6500);},error:e=>{this.busy.set(false);this.error.set('Roles were saved, but the latest assignments could not be loaded. Reload to confirm. '+apiError(e));}});
      this.session.load().pipe(takeUntilDestroyed(this.destroy)).subscribe({error:()=>{}});
    },error:e=>this.fail(e)});
  }
  private fail(e:unknown){this.busy.set(false);this.error.set(apiError(e));}
}
