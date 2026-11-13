import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { contributorRoleNames, contributorRows } from './component-contributors.component';
import { Lookups, ReportDefinition, ReportingCycle, SubmissionRecipient } from './dashboard.models';
import { DashboardService, apiError } from './dashboard.service';

function loadRows<T>(reportId: string, request: Observable<T[]>) {
  return request.pipe(
    map(rows => ({ reportId, rows, loading: false, error: '' })),
    catchError(error => of({ reportId, rows: [], loading: false, error: apiError(error) })),
    startWith({ reportId, rows: [], loading: true, error: '' })
  );
}

@Component({
  selector: 'app-report-profile',
  imports: [DatePipe],
  styles: [`

    :host { display:grid; container:report-form / inline-size; gap:16px; min-width:0; }
    .profile-card { min-width:0; overflow:hidden; border:1px solid var(--line); border-radius:var(--workspace-radius); background:#fff; box-shadow:var(--panel-shadow); }
    .profile-heading { margin:0; padding:14px 18px; border-bottom:1px solid var(--line); background:linear-gradient(180deg,#fff,#eff5fb); color:#12375f; font-size:17px; }
    .card-body { padding:16px 18px; }
    .fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 16px; margin:0; }
    .fields .field { align-items:stretch; min-width:0; }
    .field dt { align-self:center; color:var(--muted); font-size:12px; font-weight:600; }
    .field dd { display:flex; align-items:center; min-height:38px; margin:0; padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:#f7fafe; color:var(--ink); font-size:13px; line-height:1.4; overflow-wrap:anywhere; }
    .field .empty-value { color:var(--muted); }
    .fields .full { grid-column:1/-1; }
    .field .description { white-space:pre-wrap; }
    .collections { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr)); gap:16px; align-items:start; }
    .entries { display:grid; gap:8px; padding:12px; }
    .entry { min-width:0; border:1px solid var(--line); border-radius:10px; background:#fff; }
    .entry > summary { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border-radius:9px; color:#173b61; font-size:14px; line-height:1.4; cursor:pointer; list-style:none; overflow-wrap:anywhere; }
    .entry > summary::-webkit-details-marker { display:none; }
    .entry > summary::after { content:''; flex:0 0 7px; width:7px; height:7px; margin:0 4px 3px 0; border-right:2px solid currentColor; border-bottom:2px solid currentColor; transform:rotate(45deg); }
    .entry[open] > summary::after { margin-bottom:0; transform:rotate(225deg); }
    .entry > summary:hover,.entry[open] > summary { background:#f1f7ff; }
    .entry > summary:focus-visible { outline:2px solid var(--blue); outline-offset:-2px; }
    .entry[open] > summary { border-radius:9px 9px 0 0; }
    .entry-caption { display:block; margin-top:2px; color:var(--muted); font-size:12px; }
    .entry-body { padding:12px; border-top:1px solid var(--line); }
    .entry-body .report-inline-fields { --report-field-columns:min(7.5rem,42%) minmax(0,1fr); }
    .department-entry { margin-top:12px; }
    .departments { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:8px 24px; margin:0; padding-inline-start:18px; font-size:13px; overflow-wrap:anywhere; }
    .contributors { display:grid; gap:8px; margin:0; padding:0; list-style:none; font-size:13px; overflow-wrap:anywhere; }
    .contributors li + li { border-top:1px solid var(--line); padding-top:8px; }
    .field .contributor-value { display:block; }
    .state { margin:0; padding:16px 18px; color:var(--muted); font-size:13px; }
    .state[role=alert] { color:#8e2424; }
    @container report-form (max-width:700px) {
      .card-body > .fields { grid-template-columns:minmax(0,1fr); }
    }
    @container report-form (max-width:440px) {
      .fields,.entry-body .fields { grid-template-columns:minmax(0,1fr); }
      .entry-body .report-inline-fields { --report-field-columns:minmax(0,1fr); }
    }
    @media(max-width:520px) {
      .card-body { padding:12px; }
    }
  `],
  template: `

    <section class="profile-card" aria-labelledby="profile-definition">
      <h3 id="profile-definition" class="profile-heading">Report definition</h3>
      <div class="card-body">
        <dl class="fields report-inline-fields">
          @for (field of definition(); track field.label) {
            <div class="field report-field"><dt>{{ field.label }}</dt><dd [class.empty-value]="field.value === '—'">{{ field.value }}</dd></div>
          }
          <div class="field report-field full"><dt>Description</dt><dd class="description" [class.empty-value]="!report().description">{{ report().description || '—' }}</dd></div>
        </dl>
        <details class="entry department-entry">
          <summary><strong>Recipient departments ({{ departments().length }})</strong></summary>
          <div class="entry-body">
            @if (departments().length) {
              <ul class="departments">
                @for (department of departments(); track $index) { <li>{{ department }}</li> }
              </ul>
            } @else { <span class="entry-caption">No departments configured.</span> }
          </div>
        </details>
      </div>
    </section>

    <div class="collections">
      <section class="profile-card" aria-labelledby="profile-cycles">
        <h3 id="profile-cycles" class="profile-heading">Reporting cycles</h3>
        @let cycles = cycleState();
        @if (!cycles || cycles.reportId !== report().id || cycles.loading) {
          <p class="state" role="status">Loading reporting cycles…</p>
        } @else if (cycles.error) {
          <p class="state" role="alert">{{ cycles.error }}</p>
        } @else if (cycles.rows.length) {
          <div class="entries">
            @for (cycle of cycles.rows; track cycle.id) {
              <details class="entry cycle-entry">
                <summary>
                  <span><strong>{{ cycle.periodLabel }}</strong>
                    <span class="entry-caption">{{ cycle.periodStart | date:'dd MMM y' }} – {{ cycle.periodEnd | date:'dd MMM y' }}</span>
                  </span>
                </summary>
                <div class="entry-body">
                  <dl class="fields report-inline-fields">
                    <div class="field report-field"><dt>Period key</dt><dd>{{ cycle.periodKey }}</dd></div>
                    <div class="field report-field"><dt>Period start</dt><dd>{{ cycle.periodStart | date:'dd MMM y' }}</dd></div>
                    <div class="field report-field"><dt>Period end</dt><dd>{{ cycle.periodEnd | date:'dd MMM y' }}</dd></div>
                    <div class="field report-field"><dt>Final submission deadline (Dhaka)</dt><dd>{{ cycleDeadline(cycle) }}</dd></div>
                  </dl>
                </div>
              </details>
            }
          </div>
        } @else { <p class="state">No reporting cycles saved.</p> }
      </section>

      <section class="profile-card" aria-labelledby="profile-components">
        <h3 id="profile-components" class="profile-heading">Report components</h3>
        @let components = componentState();
        @if (!components || components.reportId !== report().id || components.loading) {
          <p class="state" role="status">Loading report components…</p>
        } @else if (components.error) {
          <p class="state" role="alert">{{ components.error }}</p>
        } @else if (components.rows.length) {
          <div class="entries">
            @for (component of components.rows; track component.id) {
              <details class="entry component-entry">
                <summary>
                  <span><strong>{{ component.name }}</strong>
                    <span class="entry-caption">{{ divisionName(component.providerDivisionId) }}</span>
                  </span>
                </summary>
                <div class="entry-body">
                  <dl class="fields report-inline-fields">
                    <div class="field report-field"><dt>Preparing division</dt><dd>{{ divisionName(component.providerDivisionId) }}</dd></div>
                    <div class="field report-field"><dt>Receiving division</dt><dd>{{ divisionName(component.receivingDivisionId) }}</dd></div>
                    <div class="field report-field"><dt>Lead days</dt><dd>{{ component.deadlineOffsetDays }}</dd></div>
                    <div class="field report-field full"><dt>Contributors</dt><dd class="contributor-value">
                      <ul class="contributors">
                        @for (contributor of component.contributors; track contributor.userId) {
                          <li><strong>{{ memberName(contributor.userId) }}</strong>
                            <span class="entry-caption">{{ roleNames(contributor) }}</span>
                          </li>
                        } @empty { <li>Unassigned</li> }
                      </ul>
                    </dd></div>
                    <div class="field report-field full"><dt>Description</dt><dd class="description" [class.empty-value]="!component.description">{{ component.description || '—' }}</dd></div>
                  </dl>
                </div>
              </details>
            }
          </div>
        } @else { <p class="state">No components configured.</p> }
      </section>
    </div>
  `
})
export class ReportProfileComponent {
  readonly report = input.required<ReportDefinition>();
  readonly lookups = input.required<Lookups>();
  readonly recipients = input.required<SubmissionRecipient[]>();

  private readonly api = inject(DashboardService);
  private readonly reportId = computed(() => this.report().id);
  private readonly reportIdChanges = toObservable(this.reportId);
  private readonly recipient = computed(() => this.recipients().find(item => item.id === this.report().submissionRecipientId));
  private readonly deadlineFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  });

  protected readonly cycleState = toSignal(this.reportIdChanges.pipe(switchMap(id => loadRows(id,
    this.api.cycles(id).pipe(map(cycles => [...cycles].sort((a, b) => b.periodStart.localeCompare(a.periodStart) || a.periodKey.localeCompare(b.periodKey))))
  ))));
  protected readonly componentState = toSignal(this.reportIdChanges.pipe(switchMap(id => loadRows(id,
    this.api.components(id).pipe(map(components => [...components].sort((a, b) => a.name.localeCompare(b.name))
      .map(component => ({ ...component, contributors: contributorRows(component) }))))
  ))));

  protected readonly definition = computed(() => {
    const report = this.report();
    return [
      { label: 'Code', value: report.code },
      { label: 'Report name', value: report.name },
      { label: 'Frequency', value: report.frequency },
      { label: 'Main deadline time', value: report.dueTime ? report.dueTime.slice(0, 5) + (report.timeZoneId ? ' (' + report.timeZoneId + ')' : '') : '—' },
      { label: 'Coordinating division', value: this.divisionName(report.ownerDivisionId) },
      { label: 'Receiving division', value: this.divisionName(report.receivingDivisionId) },
      { label: 'Final submitting division', value: this.divisionName(report.submittingDivisionId) },
      { label: 'Final submitting officer', value: this.memberName(report.primarySubmittingOfficerId, 'Unassigned') },
      { label: 'Deputy submitting officer', value: this.memberName(report.deputySubmittingOfficerId, '—') },
      { label: 'Deadline lead days', value: report.componentDeadlineOffsetDays ?? '—' },
      { label: 'Submission recipient', value: this.recipient()?.name || report.bbRecipient || 'Not configured' },
      { label: 'Instruction reference', value: report.instructionReference || '—' }
    ];
  });

  protected readonly departments = computed(() => {
    const ids = this.report().submissionDepartmentIds ?? [];
    const departments = this.recipient()?.departments ?? [];
    return departments.filter(item => ids.includes(item.id)).map(item => item.name).sort((a, b) => a.localeCompare(b));
  });

  protected divisionName(id: string | null) {
    return this.lookups().divisions.find(division => division.id === id)?.name ?? 'Not configured';
  }

  protected memberName(id: string | null, fallback = 'Unassigned') {
    return id ? this.lookups().officers.find(officer => officer.id === id)?.name ?? 'Unavailable team member' : fallback;
  }

  protected readonly roleNames = contributorRoleNames;

  protected cycleDeadline(cycle: ReportingCycle) {
    const deadline = cycle.obligations.find(obligation => obligation.type === 'BB')?.dueAtUtc;
    if (!deadline) return 'Not configured';
    // The API returns UTC values, including stored timestamps serialized without an offset.
    const timestamp = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(deadline) ? deadline : deadline + 'Z');
    return this.deadlineFormat.format(timestamp);
  }
}
