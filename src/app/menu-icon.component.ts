import { Component, input } from '@angular/core';
const paths: Readonly<Record<string,string>> = {
  'search':'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M15 15l6 6',
  'refresh':'M20 7a9 9 0 0 0-15-2L2 8 M2 3v5h5 M4 17a9 9 0 0 0 15 2l3-3 M22 21v-5h-5',
  'plus':'M12 5v14 M5 12h14',
  'trash':'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  'check':'M5 12l4 4L19 6',
  'arrow-right':'M4 12h16 M14 6l6 6-6 6',
  'globe':'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a18 18 0 0 1 0 20 18 18 0 0 1 0-20',
  'overview':'M3 3v18h18 M7 14l4-5 4 3 5-7 M17 5h3v3',
  'dashboard':'M3 3h7v7H3z M14 3h7v4h-7z M14 11h7v10h-7z M3 14h7v7H3z',
  'register':'M5 3h14a1 1 0 0 1 1 1v17H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2z M6 17h14 M7 7h9 M7 11h7',
  'calendar':'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M7 2v4 M17 2v4 M3 10h18 M7 14h2 M15 14h2 M7 18h2',
  'report-admin':'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M7 11h10 M7 15h6',
  'report-settings':'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 12h8 M8 16h5',
  'components':'M12 2l9 5-9 5-9-5 9-5z M3 12l9 5 9-5 M3 17l9 5 9-5',
  'team':'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2 M17 4a4 4 0 0 1 0 8 M22 21v-2a6 6 0 0 0-4-5.65',
  'submission-group':'M4 3h12v7 M4 3v18h16v-7 M8 7h4 M8 11h2 M12 15l9-9 M16 6h5v5',
  'send':'M22 2L9 15 M22 2l-7 20-6-7-7-6 20-7z',
  'inbox':'M3 13l3-9h12l3 9v7H3v-7z M3 13h5l2 3h4l2-3h5 M12 3v7 M9 7l3 3 3-3',
  'checklist':'M9 4h6v4H9z M9 6H5v15h14V6h-4 M8 13l2 2 5-5 M8 18h7',
  'upload':'M12 16V3 M7 8l5-5 5 5 M3 15v6h18v-6',
  'monitor':'M3 4h18v13H3z M8 21h8 M12 17v4 M6 11h3l2-4 3 7 2-3h2',
  'clock':'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9z M12 7v5l3 2 M19 2v5h-5',
  'bell':'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M9 21h6 M12 2V1',
  'access':'M12 2l9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6l9-4z M12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M12 12v4',
  'users':'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-2a6 6 0 0 1 12 0v2 M18 8v6 M15 11h6',
  'key':'M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3z M12 12l9 9 M17 17l3-3 M14 14l3-3 M6 7h.01',
  'shield':'M12 2l9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6l9-4z M8 12l3 3 5-6',
  'settings':'M3 6h5 M12 6h9 M3 18h9 M16 18h5 M8 3v6 M16 15v6 M3 12h12 M19 12h2 M15 9v6',
  'building':'M4 22V3h12v19 M16 9h4v13 M2 22h20 M8 7h4 M8 11h4 M8 15h4 M8 22v-3h4v3',
  'recipient':'M3 5h18v14H3z M3 5l9 8 9-8 M3 19l6-7 M21 19l-6-7',
  'department':'M8 2h8v6H8z M2 16h7v6H2z M15 16h7v6h-7z M12 8v4 M5 16v-4h14v4',
  'repeat':'M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3',
  'cycle':'M20 7a9 9 0 0 0-15-2L2 8 M2 3v5h5 M4 17a9 9 0 0 0 15 2l3-3 M22 21v-5h-5 M12 7v5l3 2'
};
@Component({selector:'app-menu-icon',template:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path [attr.d]="path()" /></svg>',styles:':host{display:inline-flex;width:100%;height:100%;align-items:center;justify-content:center}svg{width:20px;height:20px;display:block;filter:drop-shadow(0 1px 1px #09244130)}'})
export class MenuIconComponent {
  readonly name = input.required<string>();
  protected path() { return paths[this.name()] ?? paths['report-settings']; }
}
