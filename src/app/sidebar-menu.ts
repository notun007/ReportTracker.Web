export interface SidebarItem { title: string; icon: string; permissions?: readonly string[] }
export interface SidebarGroup { id: string; title: string; icon: string; tone: string; items: SidebarItem[] }
export interface SidebarState { expandedGroup: string | null; activeView: string }
export const administrationDestinations: Readonly<Record<string, 'users'|'access'|'roles'|'divisions'|'recipients'|'departments'|'frequencies'|'schedules'>> = {
  'Users':'users', 'User Access':'access', 'Roles':'roles', 'Divisions':'divisions',
  'Submission Recipients':'recipients', 'Recipient Departments':'departments',
  'Reporting Frequencies':'frequencies', 'Reporting Cycle Rules':'schedules'
};
const operationalRead = ['components.read','components.submit','reports.read','report.submit','component.receive','tracking.read','tracking.record','reports.monitor'];
const finalRead = ['reports.read','report.submit','tracking.read','tracking.record','reports.monitor'];
const groups: SidebarGroup[] = [
  {id:'overview',title:'Overview',icon:'overview',tone:'blue',items:[
    {title:'Reporting Overview',icon:'dashboard'}, {title:'Report Register',icon:'register'}, {title:'Reporting Calendar',icon:'calendar'}
  ]},
  {id:'report-administration',title:'Report Administration',icon:'report-admin',tone:'cyan',items:[
    {title:'Report Configuration',icon:'report-settings',permissions:['reports.manage','cycles.manage','components.manage','responsibilities.manage','reports.monitor']},
    {title:'Components and Responsibilities',icon:'components',permissions:['components.manage']},
    {title:'Component Teams',icon:'team',permissions:['component.teams.manage']}
  ]},
  {id:'submissions',title:'Submissions',icon:'submission-group',tone:'emerald',items:[
    {title:'Component Submission',icon:'send',permissions:['components.read','components.submit','tracking.read','tracking.record','reports.monitor']},
    {title:'Incoming Components',icon:'inbox',permissions:['component.receive']},
    {title:'Submission Readiness',icon:'checklist',permissions:finalRead},
    {title:'Main Report Submission',icon:'upload',permissions:finalRead}
  ]},
  {id:'monitoring',title:'Monitoring',icon:'monitor',tone:'amber',items:[
    {title:'Deadline Extensions',icon:'clock',permissions:[...operationalRead,'extensions.review']},
    {title:'Reminder Settings',icon:'bell',permissions:['reminders.manage','reports.monitor','administration.manage']}
  ]},
  {id:'access-management',title:'Access Management',icon:'access',tone:'violet',items:[
    {title:'Users',icon:'users',permissions:['users.manage']},
    {title:'User Access',icon:'key',permissions:['roles.manage']},
    {title:'Roles',icon:'shield',permissions:['roles.manage','users.manage']}
  ]},
  {id:'system-configuration',title:'System Configuration',icon:'settings',tone:'slate',items:[
    {title:'Divisions',icon:'building',permissions:['divisions.manage']},
    {title:'Submission Recipients',icon:'recipient',permissions:['administration.manage']},
    {title:'Recipient Departments',icon:'department',permissions:['administration.manage']},
    {title:'Reporting Frequencies',icon:'repeat',permissions:['administration.manage']},
    {title:'Reporting Cycle Rules',icon:'cycle',permissions:['administration.manage']}
  ]}
];
export function sidebarGroups(permissions: readonly string[]): SidebarGroup[] {
  return groups.map(group => ({...group,items:group.items.filter(item => !item.permissions || item.permissions.some(code => permissions.includes(code)))})).filter(group => group.items.length > 0);
}
export function sidebarStorageKey(userId: string): string { return 'reporttracker.sidebar.' + userId; }
export function readSidebarState(userId: string): SidebarState | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(sidebarStorageKey(userId)) ?? 'null');
    if (!saved || typeof saved !== 'object') return null;
    const state = saved as Partial<SidebarState>;
    if ((state.expandedGroup !== null && typeof state.expandedGroup !== 'string') || typeof state.activeView !== 'string') return null;
    return {expandedGroup:state.expandedGroup,activeView:state.activeView};
  } catch { return null; }
}
