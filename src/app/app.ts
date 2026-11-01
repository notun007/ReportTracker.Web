import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DashboardService } from './dashboard.service';
import { DashboardSummary, Obligation } from './dashboard.models';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly dashboardService = inject(DashboardService);
  protected readonly dashboard = signal<DashboardSummary | null>(null);
  protected readonly activeFilter = signal('All');
  protected readonly navCollapsed = signal(window.innerWidth <= 760);
  protected readonly selected = signal<Obligation | null>(null);
  protected readonly toast = signal('');
  protected search = '';
  protected readonly today = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'Asia/Dhaka' }).format(new Date());
  protected readonly filtered = computed(() => {
    const rows = this.dashboard()?.upcoming ?? [];
    const filter = this.activeFilter();
    const term = this.search.trim().toLowerCase();
    return rows.filter(row => (filter === 'All' || row.timeliness === filter || row.type === filter) &&
      (!term || `${row.report} ${row.obligation} ${row.owner} ${row.period}`.toLowerCase().includes(term)));
  });
  constructor() { this.dashboardService.getDashboard().subscribe(data => this.dashboard.set(data)); }
  protected setFilter(filter: string): void { this.activeFilter.set(filter); }
  protected openRecord(row: Obligation): void { this.selected.set(row); }
  protected closeRecord(): void { this.selected.set(null); }
  protected saveRecord(): void {
    const row = this.selected(); if (!row) return;
    row.sendingStatus = 'Sent'; row.timeliness = 'Sent';
    this.dashboard.update(value => value ? { ...value, upcoming: [...value.upcoming] } : value);
    this.closeRecord(); this.toast.set('Sending record saved. No report data was transmitted.');
    window.setTimeout(() => this.toast.set(''), 3500);
  }
  protected statusClass(value: string): string { return value.toLowerCase().replaceAll(' ', '-'); }
}
