import { ContributorAssignmentTableComponent } from './contributor-assignment-table.component';
import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, switchMap, tap } from 'rxjs';
import { DashboardService, apiError } from './dashboard.service';
import { ComponentTeamDirectory } from './dashboard.models';
import { ContributorSelection, contributorRows } from './component-contributors.component';
import { contributorRoles } from './contributor-role-picker.component';
import { NotificationService } from './notification.service';

@Component({
  selector: 'app-component-teams',
  imports: [FormsModule, ContributorAssignmentTableComponent],
  templateUrl: './component-teams.component.html',
  styleUrl: './component-teams.component.scss',
})
export class ComponentTeamsComponent implements OnInit {
  private readonly api = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationService);
  private readonly assignment = viewChild(ContributorAssignmentTableComponent);
  protected readonly directory = signal<ComponentTeamDirectory>({ components: [], members: [] });
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly reloadRequired = signal(false);
  protected readonly error = signal('');
  protected readonly reportId = signal('');
  protected readonly componentId = signal('');
  protected readonly team = computed(() =>
    this.selected() ? contributorRows(this.selected()!.component) : [],
  );
  protected readonly reports = computed(() => [
    ...new Map(
      this.directory().components.map((row) => [
        row.reportId,
        { id: row.reportId, code: row.reportCode, name: row.reportName },
      ]),
    ).values(),
  ]);
  protected readonly components = computed(() =>
    this.directory().components.filter((row) => row.reportId === this.reportId()),
  );
  protected readonly selected = computed(() =>
    this.components().find((row) => row.component.id === this.componentId()),
  );
  protected readonly members = computed(() =>
    this.directory().members.filter(
      (member) => member.divisionId === this.selected()?.component.providerDivisionId,
    ),
  );
  protected readonly roleLabels = contributorRoles;
  protected isActiveMember(id: string) {
    return this.members().some((member) => member.id === id);
  }
  protected memberName(id: string) {
    return this.members().find((member) => member.id === id)?.name ?? 'Unavailable team member';
  }
  protected memberInitials(id: string) {
    return this.memberName(id)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }
  ngOnInit() {
    this.load();
  }
  private displayDirectory(data: ComponentTeamDirectory) {
    this.directory.set(data);
    if (!this.reports().some((row) => row.id === this.reportId()))
      this.reportId.set(this.reports()[0]?.id ?? '');
    if (!this.components().some((row) => row.component.id === this.componentId()))
      this.componentId.set(this.components()[0]?.component.id ?? '');
    this.assignment()?.clearEntry();
    this.reloadRequired.set(false);
  }
  protected load() {
    if (this.saving() || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.api
      .componentTeams()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.displayDirectory(data);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(apiError(error));
        },
      });
  }
  protected chooseReport(id: string) {
    if (this.saving() || this.reloadRequired()) return;
    this.reportId.set(id);
    this.chooseComponent(this.components()[0]?.component.id ?? '');
  }
  protected chooseComponent(id: string) {
    if (this.saving() || this.reloadRequired()) return;
    this.assignment()?.clearEntry();
    this.componentId.set(id);
    this.error.set('');
  }
  protected saveMember(member: ContributorSelection) {
    const selected = this.selected();
    if (!selected || this.saving() || this.loading() || this.reloadRequired()) return;
    this.persist(
      this.api.saveComponentTeamMember(
        selected.reportId,
        selected.component.id,
        member.userId,
        member.roles,
      ),
      'Team member saved.',
    );
  }
  protected removeMember(userId: string) {
    const selected = this.selected();
    if (
      !selected ||
      this.saving() ||
      this.loading() ||
      this.reloadRequired() ||
      this.assignment()?.hasPendingEntry()
    )
      return;
    this.persist(
      this.api.removeComponentTeamMember(selected.reportId, selected.component.id, userId),
      'Team member removed.',
    );
  }
  private persist(request: Observable<unknown>, message: string) {
    this.saving.set(true);
    this.error.set('');
    let committed = false;
    request
      .pipe(
        tap(() => {
          committed = true;
          this.assignment()?.clearEntry();
          this.reloadRequired.set(true);
        }),
        switchMap(() => this.api.componentTeams()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => {
          this.displayDirectory(data);
          this.saving.set(false);
          this.notifications.success(message);
        },
        error: (error) => {
          this.saving.set(false);
          this.error.set(
            committed
              ? 'The change was saved, but the team could not be reloaded. Refresh teams to view the saved data.'
              : apiError(error),
          );
        },
      });
  }
}
