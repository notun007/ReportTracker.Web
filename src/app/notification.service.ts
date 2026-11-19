import { Injectable, signal } from '@angular/core';

export interface AppNotification { text: string; error: boolean; }

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly toast = signal<AppNotification | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  error(text: string) { this.show(text, true, 8000); }
  success(text: string) { this.show(text, false, 5000); }
  dismiss() { clearTimeout(this.timer); this.toast.set(null); }

  private show(text: string, error: boolean, duration: number) {
    clearTimeout(this.timer);
    this.toast.set({ text, error });
    this.timer = setTimeout(() => this.toast.set(null), duration);
  }
}
