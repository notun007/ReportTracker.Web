import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { DashboardService, apiError } from './dashboard.service';
import { ReportResponsibilityAssignments, ResponsibilitySection } from './dashboard.models';

type AssignmentKey = 'controller' | 'receiver' | 'finalSubmission';
type Pair = { primaryAssigneeId: string; alternateAssigneeId: string };
type AssignmentSection = { key: AssignmentKey; label: string; responsibility: string };

@Component({
  selector: 'app-report-responsibilities',
  imports: [FormsModule],
  styleUrl: './report-responsibilities.component.scss',
  templateUrl: './report-responsibilities.component.html',
})
export class ReportResponsibilityAssignmentsComponent {
  readonly reportId = input.required<string>();
  readonly saved = output<void>();
  readonly saving = output<boolean>();
  private readonly api = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly directory = signal<ReportResponsibilityAssignments | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly pendingUnassign = signal<AssignmentSection | null>(null);
  protected readonly unassigning = signal(false);
  protected readonly sections: AssignmentSection[] = [
    { key: 'controller', label: 'Coordinating division', responsibility: 'Report Controller' },
    { key: 'receiver', label: 'Receiving division', responsibility: 'Report Receiver' },
    { key: 'finalSubmission', label: 'Final submitting division', responsibility: 'Final Submission' },
  ];
  protected form: Record<AssignmentKey, Pair> = {
    controller: { primaryAssigneeId: '', alternateAssigneeId: '' },
    receiver: { primaryAssigneeId: '', alternateAssigneeId: '' },
    finalSubmission: { primaryAssigneeId: '', alternateAssigneeId: '' },
  };
  private sequence = 0;
  private toastTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    this.destroyRef.onDestroy(() => this.pauseToast());
    effect((onCleanup) => {
      const id = this.reportId();
      this.dismissToast();
      const subscription = this.fetch(id);
      onCleanup(() => subscription.unsubscribe());
    });
  }
  private fetch(id: string, clearedRole?: AssignmentKey) {
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    this.directory.set(null);
    return this.api
      .reportResponsibilityAssignments(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          if (sequence !== this.sequence) return;
          for (const { key } of this.sections) {
            if (clearedRole && key !== clearedRole) continue;
            this.form[key] = {
              primaryAssigneeId: data[key].primaryAssigneeId ?? '',
              alternateAssigneeId: data[key].alternateAssigneeId ?? '',
            };
          }
          this.directory.set(data);
          this.loading.set(false);
        },
        error: (error) => {
          if (sequence === this.sequence) {
            this.error.set(apiError(error));
            this.loading.set(false);
          }
        },
      });
  }
  protected load() {
    this.message.set('');
    this.fetch(this.reportId());
  }
  protected dismissToast() {
    this.pauseToast();
    this.message.set('');
  }
  protected pauseToast() {
    clearTimeout(this.toastTimer);
  }
  protected resumeToast() {
    this.pauseToast();
    if (this.message()) this.toastTimer = setTimeout(() => this.dismissToast(), 5000);
  }
  protected hasAssignee(info: ResponsibilitySection, id: string) {
    return info.assignees.some((assignee) => assignee.id === id);
  }
  protected selectPrimary(key: AssignmentKey, id: string) {
    this.form[key].primaryAssigneeId = id;
    if (this.form[key].alternateAssigneeId === id) this.form[key].alternateAssigneeId = '';
  }
  protected valid() {
    const data = this.directory();
    return (
      !!data &&
      data.existingReceiverCount <= 2 &&
      this.sections.every(({ key }) => {
        const pair = this.form[key];
        return (
          !!data[key].divisionId &&
          this.hasAssignee(data[key], pair.primaryAssigneeId) &&
          (!pair.alternateAssigneeId ||
            (pair.alternateAssigneeId !== pair.primaryAssigneeId &&
              this.hasAssignee(data[key], pair.alternateAssigneeId)))
        );
      })
    );
  }
  protected primaryCount() {
    const data = this.directory();
    return data
      ? this.sections.filter(({ key }) =>
          this.hasAssignee(data[key], this.form[key].primaryAssigneeId),
        ).length
      : 0;
  }
  protected hasChanges() {
    const data = this.directory();
    return (
      !!data &&
      this.sections.some(
        ({ key }) =>
          this.form[key].primaryAssigneeId !== (data[key].primaryAssigneeId ?? '') ||
          this.form[key].alternateAssigneeId !== (data[key].alternateAssigneeId ?? ''),
      )
    );
  }
  protected assigneeInitials(info: ResponsibilitySection, id: string) {
    const name = info.assignees.find((assignee) => assignee.id === id)?.name;
    return name
      ? name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((word) => word.charAt(0))
          .join('')
          .toUpperCase()
      : '—';
  }
  protected assignmentStatus(key: AssignmentKey) {
    const data = this.directory();
    if (!data || !this.hasAssignee(data[key], this.form[key].primaryAssigneeId))
      return 'Primary needed';
    const pair = this.form[key];
    if (
      pair.alternateAssigneeId &&
      (pair.alternateAssigneeId === pair.primaryAssigneeId ||
        !this.hasAssignee(data[key], pair.alternateAssigneeId))
    )
      return 'Review alternate';
    return pair.primaryAssigneeId === (data[key].primaryAssigneeId ?? '') &&
      pair.alternateAssigneeId === (data[key].alternateAssigneeId ?? '')
      ? 'Assigned'
      : 'Ready';
  }
  protected canUnassign(data: ReportResponsibilityAssignments, key: AssignmentKey) {
    const info = data[key];
    return !!info.divisionId && !!(info.primaryAssigneeId || info.alternateAssigneeId) &&
      (key !== 'receiver' || data.existingReceiverCount <= 2);
  }
  protected openUnassign(section: AssignmentSection, dialog: HTMLDialogElement) {
    const data = this.directory();
    if (this.busy() || !data || !this.canUnassign(data, section.key)) return;
    this.pendingUnassign.set(section);
    dialog.showModal();
  }
  protected unassign(dialog: HTMLDialogElement) {
    const data = this.directory();
    const section = this.pendingUnassign();
    if (this.busy() || !data || !section || !this.canUnassign(data, section.key)) return;
    dialog.close();
    this.busy.set(true);
    this.unassigning.set(true);
    this.saving.emit(true);
    this.error.set('');
    this.dismissToast();
    this.api.unassignReportResponsibility(data.reportId, section.key, data.rowVersion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.finishUnassign();
          this.message.set(`${section.responsibility} assignees unassigned.`);
          this.resumeToast();
          this.saved.emit();
          this.fetch(data.reportId, section.key);
        },
        error: (error) => {
          this.finishUnassign();
          this.error.set(apiError(error));
        },
      });
  }
  private finishUnassign() {
    this.busy.set(false);
    this.unassigning.set(false);
    this.saving.emit(false);
  }
  protected save(form: NgForm) {
    const data = this.directory();
    if (!data || form.invalid || !this.valid() || this.busy()) return;
    const pair = (key: AssignmentKey) => ({
      primaryAssigneeId: this.form[key].primaryAssigneeId,
      alternateAssigneeId: this.form[key].alternateAssigneeId || null,
    });
    this.busy.set(true);
    this.saving.emit(true);
    this.error.set('');
    this.message.set('');
    this.api
      .saveReportResponsibilityAssignments(data.reportId, {
        controller: pair('controller'),
        receiver: pair('receiver'),
        finalSubmission: pair('finalSubmission'),
        rowVersion: data.rowVersion,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.saving.emit(false);
          this.message.set('Responsibilities saved.');
          this.resumeToast();
          this.saved.emit();
          this.fetch(data.reportId);
        },
        error: (error) => {
          this.busy.set(false);
          this.saving.emit(false);
          this.error.set(apiError(error));
        },
      });
  }
}
