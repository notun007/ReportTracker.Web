import { Component, computed, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DashboardService, apiError } from './dashboard.service';
import { WeeklyPresetPeriod, ReportingFrequencyItem, SchedulePresetDirectory, SchedulePresetPeriod } from './dashboard.models';

@Component({
  selector: 'app-schedule-presets',
  imports: [FormsModule],
  template: `
    <section class="setup-card" aria-labelledby="schedule-title">
      <h2 id="schedule-title">Reporting Cycle Rules</h2>
      @if (error()) { <div class="error-banner" role="alert">{{ error() }} <button type="button" (click)="load()">Retry</button></div> }
      <form (ngSubmit)="save()">
        <label [class.full-width]="isYearly()">Report Cycle
          <select name="ruleCode" [ngModel]="ruleCode()" (ngModelChange)="selectRule($event)" [disabled]="saving() || !directory() || !reportingFrequencies()" required>
            <option value="">Choose a report cycle</option>
            @for (frequency of reportingFrequencies() ?? []; track frequency.id) {
              <option [value]="frequency.code">{{ frequency.name }}</option>
            }
          </select>
        </label>
        @if (periodNames().length) {
          @if (!isYearly()) {
            <label>{{ periodLabel() }}
              <select name="week" [ngModel]="selectedPeriod()" (ngModelChange)="selectedPeriod.set($event)" [disabled]="saving() || !!periodEdit()">
                @for (week of periodNames(); track week; let i = $index) {
                  <option [ngValue]="i">{{ week }}</option>
                }
              </select>
            </label>
          }
          @let index = selectedPeriod();
          @let period = editablePeriods()[index];
          @if (showsFixedMonths()) {
            <label>Start month
              <input type="text" [value]="monthName(index)" readonly>
            </label>
          }
          @if (isYearly()) {
            <label>Start month
              <select aria-label="Start month" name="startMonth" [ngModel]="period.startMonth"
                (ngModelChange)="changeYearlyMonth(period, $event, false)" [disabled]="saving() || !!periodEdit()">
                @for (month of months; track month) {
                  <option [ngValue]="month">{{ calendarMonthName(month) }}</option>
                }
              </select>
            </label>
          }
          <label>Period start
            <select aria-label="Period start day" name="startDay" [ngModel]="period.startDay"
              (ngModelChange)="changeStartDay($event)" [disabled]="saving() || !!periodEdit()">
              @for (day of startDays(index, period); track day) {
                <option [ngValue]="day">{{ dayLabel(index, day) }}</option>
              }
            </select>
          </label>
          @if (showsFixedMonths()) {
            <label>End month
              <input type="text" [value]="monthName(index, true)" readonly>
            </label>
          }
          @if (isYearly()) {
            <label>End month
              <select aria-label="End month" name="endMonth" [ngModel]="period.endMonth"
                (ngModelChange)="changeYearlyMonth(period, $event, true)" [disabled]="saving() || !!periodEdit()">
                @for (month of months.slice(period.startMonth! - 1); track month) {
                  <option [ngValue]="month">{{ calendarMonthName(month) }}</option>
                }
              </select>
            </label>
          }
          <label>Period end
            <select aria-label="Period end day" name="endDay" [ngModel]="period.endDay" (ngModelChange)="changeEndDay($event)" [disabled]="saving() || !!periodEdit()">
              @let options = endDays(index, period);
              @if (period.endDay !== null && period.endDay > options[options.length - 1]) {
                <option [ngValue]="period.endDay">{{ dayLabel(index, period.endDay, true) }} (saved day {{ period.endDay }})</option>
              }
              @for (day of options; track day) {
                <option [ngValue]="day">{{ dayLabel(index, day, true) }}</option>
              }
              @if (!isYearly()) { <option [ngValue]="null">EndDay of Month</option> }
            </select>
          </label>
        }
        <div class="actions"><button type="submit" class="primary" [disabled]="!ruleCode() || saving() || periodEdit() || isSaved()">
          {{ saving() ? 'Saving…' : 'Save rule' }}
        </button></div>
      </form>
      @if (isSaved()) { <p class="preview-note" role="status">This rule is already saved.</p> }
      @if (previewError()) { <p class="error-banner" role="alert">{{ previewError() }}</p> }
      @if (periodNames().length) {
        <div class="table-wrap">
          <table [attr.aria-label]="periodLabel() + ' schedule'">
            <thead>
              <tr>
                <th scope="col">{{ periodLabel() }}</th>
                @if (showsFixedMonths() || isYearly()) { <th scope="col">Start month</th> }
                <th scope="col">Period start</th>
                @if (showsFixedMonths() || isYearly()) { <th scope="col">End month</th> }
                <th scope="col">Period end</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (period of editablePeriods(); track $index) {
                <tr>
                  <th scope="row">{{ periodNames()[$index] }}</th>
                  @let edit = periodEdit();
                  @if (showsFixedMonths()) { <td>{{ monthName($index) }}</td> }
                  @if (edit && edit.index === $index) {
                    @if (isYearly()) {
                      <td>
                        <select aria-label="Start month" [ngModel]="edit.period.startMonth"
                          (ngModelChange)="changeYearlyMonth(edit.period, $event, false, edit)">
                          @for (month of months; track month) {
                            <option [ngValue]="month">{{ calendarMonthName(month) }}</option>
                          }
                        </select>
                      </td>
                    }
                    <td>
                      <select [attr.aria-label]="'Period start day for ' + periodNames()[$index]" [ngModel]="edit.period.startDay"
                        (ngModelChange)="changeEditedStartDay(edit, $event)">
                        @for (day of startDays($index, edit.period); track day) {
                          <option [ngValue]="day">{{ dayLabel($index, day) }}</option>
                        }
                      </select>
                    </td>
                    @if (showsFixedMonths()) { <td>{{ monthName($index, true) }}</td> }
                    @if (isYearly()) {
                      <td>
                        <select aria-label="End month" [ngModel]="edit.period.endMonth"
                          (ngModelChange)="changeYearlyMonth(edit.period, $event, true, edit)">
                          @for (month of months.slice(edit.period.startMonth! - 1); track month) {
                            <option [ngValue]="month">{{ calendarMonthName(month) }}</option>
                          }
                        </select>
                      </td>
                    }
                    <td>
                      <select [attr.aria-label]="'Period end day for ' + periodNames()[$index]" [ngModel]="edit.period.endDay" (ngModelChange)="periodEdit.set({ ...edit, period: { ...edit.period, endDay: $event } })">
                        @let options = endDays($index, edit.period);
                        @if (edit.period.endDay !== null && edit.period.endDay > options[options.length - 1]) {
                          <option [ngValue]="edit.period.endDay">{{ dayLabel($index, edit.period.endDay, true) }} (saved day {{ edit.period.endDay }})</option>
                        }
                        @for (day of options; track day) {
                          <option [ngValue]="day">{{ dayLabel($index, day, true) }}</option>
                        }
                        @if (!isYearly()) { <option [ngValue]="null">EndDay of Month</option> }
                      </select>
                    </td>
                    <td><div class="row-actions">
                      <button type="button" (click)="applyPeriodEdit(edit)">Apply</button>
                      <button type="button" (click)="periodEdit.set(null)">Cancel</button>
                    </div></td>
                  } @else {
                    @if (isYearly()) { <td>{{ calendarMonthName(period.startMonth!) }}</td> }
                    <td>{{ dayLabel($index, period.startDay) }}</td>
                    @if (showsFixedMonths()) { <td>{{ monthName($index, true) }}</td> }
                    @if (isYearly()) { <td>{{ calendarMonthName(period.endMonth!) }}</td> }
                    <td>{{ dayLabel($index, period.endDay, true) }}</td>
                    <td><button type="button" [disabled]="saving() || !!periodEdit()" [attr.aria-label]="'Edit ' + periodNames()[$index]" (click)="periodEdit.set({ index: $index, period })">Edit</button></td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (periods().length) {
        <div class="table-wrap">
          <table aria-label="Schedule preview">
            <thead><tr><th>Period start</th><th>Period end</th></tr></thead>
            <tbody>
              @for (period of periods(); track period.periodStart) {
                <tr><td>{{ formatDate(period.periodStart) }}</td><td>{{ formatDate(period.periodEnd) }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
    <section class="tracker-panel" aria-label="Saved reporting cycle rules">
      <div class="panel-heading"><h2>Saved rules ({{ directory()?.saved?.length ?? 0 }})</h2></div>
      <div class="table-wrap">
        <table aria-label="Saved reporting cycle rules">
          <thead><tr><th>Rule</th><th>Reporting period</th><th>Final deadline</th><th>Version</th><th scope="col">Display order</th></tr></thead>
          <tbody>
            @for (preset of directory()?.saved ?? []; track preset.id) {
              <tr><td><strong>{{ preset.name }}</strong></td><td>{{ preset.reportingPeriod }}</td><td>{{ preset.finalDeadline }}</td><td>{{ preset.version }}</td><td>{{ preset.displayOrder }}</td></tr>
            } @empty {
              <tr><td colspan="5" class="empty">{{ error() ? 'Saved rules could not be loaded.' : directory() ? 'No rules saved yet.' : 'Loading rules…' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    :host { display:grid; gap:16px; min-width:0; }
    h2 { margin:0; font-size:17px; color:#12375f; }
    form { margin-top:14px; grid-template-columns:repeat(2,minmax(0,1fr)); }
    .full-width { grid-column:1/-1; }
    .actions { grid-column:1/-1; display:flex; justify-content:flex-end; }
    .tracker-panel { margin:0; }
    .setup-card .table-wrap { margin-top:14px; border:1px solid var(--line); border-radius:8px; }
    .row-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .preview-note { margin:8px 0 0; }
  `]
})
export class SchedulePresetsComponent implements OnInit {
  private readonly api = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private previewRequest = 0;
  private readonly monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
  private readonly formatter = new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' });

  readonly notification = output<{ text:string; error:boolean }>();
  protected readonly reportingFrequencies = signal<ReportingFrequencyItem[] | null>(null);
  protected readonly directory = signal<SchedulePresetDirectory | null>(null);
  protected readonly ruleCode = signal('');
  protected readonly periodLabel = computed(() => {
    switch (this.ruleCode()) {
      case 'twice-monthly': return 'Bi-Week';
      case 'monthly': return 'Month';
      case 'yearly': return 'Yearly';
      case 'quarterly': return 'Quarter';
      case 'half-yearly': return 'Half-Year';
      default: return 'Week';
    }
  });
  protected readonly isYearly = computed(() => this.ruleCode() === 'yearly');
  protected readonly months = Array.from({ length: 12 }, (_, index) => index + 1);
  protected readonly showsFixedMonths = computed(() => this.ruleCode() === 'monthly' || this.spansMultipleMonths());
  protected readonly spansMultipleMonths = computed(() => ['quarterly', 'half-yearly'].includes(this.ruleCode()));
  protected readonly periodNames = computed(() => {
    switch (this.ruleCode()) {
      case 'weekly': return ['First Week', 'Second Week', 'Third Week', 'Fourth Week'];
      case 'twice-monthly': return ['First Bi-Week', 'Second Bi-Week'];
      case 'yearly': return ['Yearly'];
      case 'monthly': return Array.from({ length: 12 }, (_, index) => this.monthName(index));
      case 'quarterly': return ['First Quarter (Jan–Mar)', 'Second Quarter (Apr–Jun)', 'Third Quarter (Jul–Sep)', 'Fourth Quarter (Oct–Dec)'];
      case 'half-yearly': return ['First Half-Year (Jan–Jun)', 'Second Half-Year (Jul–Dec)'];
      default: return [];
    }
  });
  protected readonly selectedPeriod = signal(0);
  protected readonly periodEdit = signal<{ index: number; period: WeeklyPresetPeriod } | null>(null);
  protected readonly days = Array.from({ length: 31 }, (_, index) => index + 1);
  protected readonly editablePeriods = signal<WeeklyPresetPeriod[]>([]);
  private readonly previewMonth = new Intl.DateTimeFormat('sv-SE', { year:'numeric', month:'2-digit', timeZone:'Asia/Dhaka' }).format(new Date());
  protected readonly periods = signal<SchedulePresetPeriod[]>([]);
  protected readonly error = signal('');
  protected readonly previewError = signal('');
  protected readonly saving = signal(false);

  ngOnInit() { this.load(); }

  protected load() {
    this.error.set('');
    this.reportingFrequencies.set(null);
    this.api.reportingFrequencies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: frequencies => this.reportingFrequencies.set(frequencies),
      error: error => this.error.set(apiError(error))
    });
    this.api.schedulePresets().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: directory => this.directory.set(directory),
      error: error => this.error.set(apiError(error))
    });
  }

  protected selectRule(code: string) {
    this.periodEdit.set(null);
    this.ruleCode.set(code);
    if (this.periodNames().length) {
      this.selectedPeriod.set(code === 'monthly' ? Number(this.previewMonth.slice(5)) - 1 : 0);
      const saved = this.directory()?.saved.find(preset => preset.ruleCode === code);
      const defaults = code === 'weekly'
        ? [{ startDay: 1, endDay: 8 }, { startDay: 9, endDay: 15 }, { startDay: 16, endDay: 21 }, { startDay: 22, endDay: null }]
        : code === 'monthly' || this.spansMultipleMonths()
          ? this.periodNames().map(() => ({ startDay: 1, endDay: null }))
          : [{ startDay: 1, endDay: 15 }, { startDay: 16, endDay: null }];
      const yearlyDefaults = [{ startMonth: 1, startDay: 1, endMonth: 12, endDay: 31 }];
      this.editablePeriods.set(saved?.weeklyPeriods ?? (this.isYearly() ? yearlyDefaults : defaults));
    }
    this.preview();
  }

  protected changeStartDay(startDay: number) {
    const index = this.selectedPeriod();
    this.setPeriod(index, this.withStartDay(index, this.editablePeriods()[index], startDay));
  }

  protected changeEditedStartDay(edit: { index: number; period: WeeklyPresetPeriod }, startDay: number) {
    this.periodEdit.set({ ...edit, period: this.withStartDay(edit.index, edit.period, startDay) });
  }

  protected applyPeriodEdit(edit: { index: number; period: WeeklyPresetPeriod }) {
    this.setPeriod(edit.index, edit.period);
    this.selectedPeriod.set(edit.index);
    this.periodEdit.set(null);
  }

  protected startDays(index: number, period: WeeklyPresetPeriod) {
    if (this.isYearly()) return this.days.slice(0, this.calendarMonthLength(period.startMonth!));
    const lastDay = this.ruleCode() === 'monthly' || this.spansMultipleMonths() ? this.lastDayOfPeriodMonth(index) : 28;
    return this.days.slice(0, lastDay);
  }

  protected endDays(index: number, period: WeeklyPresetPeriod) {
    const { startDay, startMonth, endMonth } = period;
    if (this.isYearly()) {
      const firstDay = startMonth === endMonth ? startDay : 1;
      return this.days.slice(firstDay - 1, this.calendarMonthLength(endMonth!));
    }
    if (this.ruleCode() === 'monthly') return this.days.slice(startDay - 1, this.lastDayOfPeriodMonth(index));
    if (!this.spansMultipleMonths()) return this.days.slice(startDay - 1);
    return this.days.slice(0, this.lastDayOfPeriodMonth(index, true));
  }

  protected dayLabel(index: number, day: number | null, end = false): string | number {
    if (day === null) return 'EndDay of Month';
    return this.spansMultipleMonths() ? Math.min(day, this.lastDayOfPeriodMonth(index, end)) : day;
  }

  protected monthName(index: number, end = false) {
    const month = this.periodMonth(index, end);
    return this.calendarMonthName(month);
  }

  protected calendarMonthName(month: number) {
    return this.monthFormatter.format(new Date(Date.UTC(2000, month - 1, 1)));
  }

  private calendarMonthLength(month: number) {
    return new Date(Date.UTC(2000, month, 0)).getUTCDate();
  }

  protected changeYearlyMonth(period: WeeklyPresetPeriod, month: number, end: boolean,
    edit?: { index: number; period: WeeklyPresetPeriod }) {
    const startMonth = end ? period.startMonth! : month;
    const startDay = Math.min(period.startDay, this.calendarMonthLength(startMonth));
    const endMonth = end ? month : Math.max(startMonth, period.endMonth!);
    const lastDay = this.calendarMonthLength(endMonth);
    const endDay = Math.max(startMonth === endMonth ? startDay : 1, Math.min(period.endDay!, lastDay));
    const updated = { startMonth, startDay, endMonth, endDay };
    if (edit) this.periodEdit.set({ ...edit, period: updated });
    else this.setPeriod(this.selectedPeriod(), updated);
  }

  private periodMonth(index: number, end: boolean) {
    if (this.ruleCode() === 'monthly') return index + 1;
    const monthCount = this.ruleCode() === 'quarterly' ? 3 : 6;
    return index * monthCount + (end ? monthCount : 1);
  }

  private lastDayOfPeriodMonth(index: number, end = false) {
    return new Date(Date.UTC(2000, this.periodMonth(index, end), 0)).getUTCDate();
  }

  private withStartDay(index: number, period: WeeklyPresetPeriod, startDay: number): WeeklyPresetPeriod {
    if (this.isYearly()) {
      const endDay = period.startMonth === period.endMonth ? Math.max(period.endDay!, startDay) : period.endDay;
      return { ...period, startDay, endDay };
    }
    const endDay = this.ruleCode() === 'weekly' && index === 0 ? (startDay + 7 <= 31 ? startDay + 7 : null)
      : this.spansMultipleMonths() || period.endDay === null ? period.endDay : Math.max(period.endDay, startDay);
    return { startDay, endDay };
  }

  protected changeEndDay(endDay: number | null) {
    const index = this.selectedPeriod();
    this.setPeriod(index, { ...this.editablePeriods()[index], endDay });
  }

  private setPeriod(index: number, period: WeeklyPresetPeriod) {
    this.editablePeriods.update(periods => periods.map((entry, i) => i === index ? period : entry));
  }

  protected isSaved() {
    if (this.periodNames().length) return false;
    return this.directory()?.saved.some(preset => preset.ruleCode === this.ruleCode() && preset.version === 1) ?? false;
  }

  protected save() {
    const code = this.ruleCode();
    if (!code || !this.directory() || this.saving() || this.periodEdit() || this.isSaved()) return;
    this.saving.set(true);
    this.api.createSchedulePreset(code, this.periodNames().length ? this.editablePeriods() : undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: preset => {
        this.directory.update(directory => directory && { ...directory, saved:[...directory.saved, preset].sort((a,b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name) || b.version - a.version) });
        this.saving.set(false);
        this.notification.emit({ text:'Reporting cycle rule saved.', error:false });
      },
      error: error => {
        this.saving.set(false);
        this.notification.emit({ text:apiError(error), error:true });
        if (error.status === 409) this.load();
      }
    });
  }

  protected formatDate(value: string) {
    return this.formatter.format(new Date(value + 'T00:00:00Z'));
  }

  private preview() {
    const request = ++this.previewRequest;
    this.periods.set([]);
    this.previewError.set('');
    if (!this.ruleCode() || this.periodNames().length) return;
    this.api.previewSchedulePreset(this.ruleCode(), this.previewMonth + '-01').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { if (request === this.previewRequest) this.periods.set(rows); },
      error: error => { if (request === this.previewRequest) this.previewError.set(apiError(error)); }
    });
  }
}
