import { Injectable, signal } from '@angular/core';

export interface DevSettings {
  emailsEnabled: boolean;
  debugMode: boolean;
}

const STORAGE_KEY = 'trackpays_dev_settings';

@Injectable({ providedIn: 'root' })
export class DevSettingsService {
  private defaults: DevSettings = {
    emailsEnabled: true,
    debugMode: false
  };

  private loadSettings(): DevSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...this.defaults, ...parsed } as DevSettings;
      }
    } catch {}
    return { ...this.defaults };
  }

  private saveSettings(settings: DevSettings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  // ── Signals ──
  emailsEnabled = signal(this.loadSettings().emailsEnabled);
  debugMode = signal(this.loadSettings().debugMode);

  toggleEmails() {
    const next = !this.emailsEnabled();
    this.emailsEnabled.set(next);
    this.patch({ emailsEnabled: next });
  }

  toggleDebugMode() {
    const next = !this.debugMode();
    this.debugMode.set(next);
    this.patch({ debugMode: next });
  }

  private patch(partial: Partial<DevSettings>) {
    const current = this.loadSettings();
    this.saveSettings({ ...current, ...partial });
  }
}
