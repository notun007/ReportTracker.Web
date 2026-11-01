import { Component, inject, output, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { SessionService, apiError } from './dashboard.service';

@Component({
  selector: 'app-sign-in', imports: [FormsModule],
  template: `
    <main class="auth-page"><section class="auth-card">
      <div class="auth-brand">SB <span>Southeast Bank PLC.</span></div>
      <h1>BB Reporting Tracker</h1>
      <p>{{ session.setupRequired() ? 'Create your first administrator account and coordinating division.' : 'Sign in to your reporting workspace.' }}</p>
      @if (error()) { <div class="error-banner" role="alert">{{ error() }}</div> }
      <form #form="ngForm" (ngSubmit)="submit(form)">
        @if (session.setupRequired()) {
          <label>Division code<input name="divisionCode" [(ngModel)]="fields.divisionCode" required maxlength="40" autocomplete="off"></label>
          <label>Division name<input name="divisionName" [(ngModel)]="fields.divisionName" required maxlength="150"></label>
          <label>Employee ID<input name="employeeId" [(ngModel)]="fields.employeeId" required maxlength="40"></label>
          <label>Your name<input name="displayName" [(ngModel)]="fields.displayName" required maxlength="150" autocomplete="name"></label>
        }
        <label>Email<input type="email" name="email" [(ngModel)]="fields.email" required email maxlength="254" autocomplete="username"></label>
        <label>Password<input type="password" name="password" [(ngModel)]="fields.password" required [minlength]="session.setupRequired() ? 12 : 1" maxlength="128" [autocomplete]="session.setupRequired() ? 'new-password' : 'current-password'"></label>
        @if (session.setupRequired()) {
          <small>Use at least 12 characters. This account receives separate System Administrator and Report Coordinator roles.</small>
          <label>Setup key <small>Required outside local development</small><input type="password" name="setupKey" [(ngModel)]="fields.setupKey" autocomplete="off"></label>
        }
        <button class="primary" type="submit" [disabled]="busy() || form.invalid">{{ busy() ? 'Please wait…' : session.setupRequired() ? 'Create workspace' : 'Sign in' }}</button>
      </form>
      <p class="auth-note">Track obligations and confirmation records. Business report data stays in the bank’s existing reporting process.</p>
    </section></main>
  `
})
export class SignInComponent {
  protected readonly session = inject(SessionService);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  readonly signedIn = output<void>();
  protected fields = { divisionCode: '', divisionName: '', employeeId: '', displayName: '', email: '', password: '', setupKey: '' };
  protected submit(form: NgForm) {
    if (form.invalid || this.busy()) return;
    this.busy.set(true); this.error.set('');
    const request = this.session.setupRequired() ? this.session.setup(this.fields) : this.session.login({ email: this.fields.email, password: this.fields.password });
    request.subscribe({ next: () => { this.busy.set(false); this.fields.password = ''; this.signedIn.emit(); }, error: error => { this.busy.set(false); this.error.set(apiError(error)); } });
  }
}
