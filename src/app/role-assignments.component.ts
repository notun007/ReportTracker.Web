import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DivisionItem, UserItem } from './dashboard.models';
import { MenuIconComponent } from './menu-icon.component';
import { UserRoleEditorComponent } from './user-role-editor.component';

@Component({selector:'app-role-assignments',imports:[FormsModule,MenuIconComponent,UserRoleEditorComponent],templateUrl:'./role-assignments.component.html',styleUrls:['./role-assignments.component.scss','./role-assignments-table.component.scss','./role-assignments-drawer.component.scss']})
export class RoleAssignmentsComponent {
  readonly users = input.required<UserItem[]>();
  readonly divisions = input.required<DivisionItem[]>();
  readonly loading = input(false);
  readonly error = input('');
  readonly refresh = output<void>();
  readonly saved = output<void>();
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('roleDrawer');
  private readonly editor = viewChild(UserRoleEditorComponent);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('userSearch');
  private readonly destroy = inject(DestroyRef);
  private opener: HTMLElement | null = null;
  private previousOverflow: string | null = null;
  private backdropPressed = false;
  protected readonly selectedId = signal('');
  protected readonly search = signal('');
  protected readonly divisionId = signal('');
  protected readonly assignmentFilter = signal('all');
  protected readonly selectedUser = computed(()=>this.users().find(user=>user.id===this.selectedId())??null);
  protected readonly matching = computed(()=>{
    const term=this.search().trim().toLowerCase();
    return this.users().filter(user=>(!this.divisionId()||user.divisionId===this.divisionId())&&
      (this.assignmentFilter()==='all'||this.assignmentFilter()==='assigned'&&user.roles.length>0||this.assignmentFilter()==='unassigned'&&!user.roles.length)&&
      [user.displayName,user.employeeId,user.email,this.division(user.divisionId),...user.roles].join(' ').toLowerCase().includes(term));
  });
  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.selectedUser() && !dialog.open) {
        this.previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.showModal();
      } else if (!this.selectedUser() && dialog.open) dialog.close();
    });
    this.destroy.onDestroy(() => {
      const dialog = this.dialog()?.nativeElement;
      if (dialog?.open) dialog.close();
      this.unlockScroll();
    });
  }
  protected openUser(id:string,event:Event) {
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.selectedId.set(id);
  }
  protected cancelDrawer(event:Event) { event.preventDefault(); this.editor()?.requestClose(); }
  protected backdropDown(event:PointerEvent) { this.backdropPressed = this.outsideDrawer(event); }
  protected backdropClick(event:MouseEvent) {
    if (this.backdropPressed && this.outsideDrawer(event)) this.editor()?.requestClose();
    this.backdropPressed = false;
  }
  private outsideDrawer(event:MouseEvent) {
    const dialog=this.dialog()?.nativeElement;
    if(!dialog || event.target!==dialog)return false;
    const rect=dialog.getBoundingClientRect();
    return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;
  }
  protected drawerClosed() {
    this.selectedId.set(''); this.unlockScroll();
    if(this.opener?.isConnected)this.opener.focus();else this.searchInput()?.nativeElement.focus();
  }
  private unlockScroll() {
    if(this.previousOverflow!==null){document.body.style.overflow=this.previousOverflow;this.previousOverflow=null;}
  }
  protected division(id:string) { return this.divisions().find(division=>division.id===id)?.name??'Division unavailable'; }
  protected initials(name:string) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase(); }
  protected clearFilters() { this.search.set('');this.divisionId.set('');this.assignmentFilter.set('all'); }
}
