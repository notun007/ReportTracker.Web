import { Component, OnChanges, OnInit, SimpleChanges, input, output, signal } from '@angular/core';
import { MenuIconComponent } from './menu-icon.component';
import { SidebarGroup, readSidebarState, sidebarStorageKey } from './sidebar-menu';

@Component({selector:'app-sidebar-navigation',imports:[MenuIconComponent],templateUrl:'./sidebar-navigation.component.html',styleUrl:'./sidebar-navigation.component.scss'})
export class SidebarNavigationComponent implements OnInit, OnChanges {
  readonly groups = input.required<SidebarGroup[]>();
  readonly activeView = input.required<string>();
  readonly collapsed = input(false);
  readonly userId = input.required<string>();
  readonly selected = output<string>();
  readonly expandRequested = output<void>();
  protected readonly expandedGroup = signal<string|null>(null);
  private initialized = false;

  ngOnInit() {
    const saved = readSidebarState(this.userId());
    const validSaved = saved && (saved.expandedGroup === null || this.groups().some(group => group.id === saved.expandedGroup));
    this.expandedGroup.set(validSaved ? saved.expandedGroup : this.activeGroup()?.id ?? this.groups()[0]?.id ?? null);
    this.initialized = true;
  }
  ngOnChanges(changes: SimpleChanges) {
    if (!this.initialized) return;
    if (changes['activeView']) this.expandedGroup.set(this.activeGroup()?.id ?? null);
    else if (this.expandedGroup() && !this.groups().some(group => group.id === this.expandedGroup())) this.expandedGroup.set(this.activeGroup()?.id ?? null);
    this.remember();
  }
  protected active(group: SidebarGroup) { return group.items.some(item => item.title === this.activeView()); }
  protected toggle(group: SidebarGroup) {
    this.expandedGroup.set(this.collapsed() || this.expandedGroup() !== group.id ? group.id : null);
    if (this.collapsed()) this.expandRequested.emit();
    this.remember();
  }
  protected open(group: SidebarGroup, title: string) {
    this.expandedGroup.set(group.id);
    this.remember(title);
    this.selected.emit(title);
  }
  private activeGroup() { return this.groups().find(group => this.active(group)); }
  private remember(view = this.activeView()) {
    try { localStorage.setItem(sidebarStorageKey(this.userId()),JSON.stringify({expandedGroup:this.expandedGroup(),activeView:view})); } catch { /* Navigation remains available if storage is disabled. */ }
  }
}
