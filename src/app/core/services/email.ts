import { Injectable, inject } from '@angular/core';
import { Auth } from './auth';
import { DevSettingsService } from './dev-settings';

@Injectable({ providedIn: 'root' })
export class EmailService {
  private auth = inject(Auth);
  private devSettings = inject(DevSettingsService);

  private readonly SERVICE_ID = 'service_6vvbqgb';
  private readonly TEMPLATE_CONFIRM = 'template_72dublr';
  private readonly TEMPLATE_CATCHUP = 'template_drjgfr3';
  private readonly PUBLIC_KEY = 'H9OIzm5XW747ed2Ff';

  private emailjs: any = null;
  private loadPromise: Promise<any> | null = null;

  private async loadEmailJS(): Promise<any> {
    if (this.emailjs) return this.emailjs;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const mod = await import('@emailjs/browser');
        this.emailjs = mod.default || mod;
        this.emailjs.init(this.PUBLIC_KEY);
        console.log('[EmailService] EmailJS loaded OK');
        return this.emailjs;
      } catch (e: any) {
        console.error('[EmailService] Failed to load EmailJS:', e);
        this.loadPromise = null;
        throw e;
      }
    })();
    return this.loadPromise;
  }

  async sendAprobacionConfirmacion(params: {
    sourceName: string;
    amount: number;
    currency: string;
    date: string;
    frequency?: string;
    fechaVencimiento?: string;
    anticipationDays?: number;
  }): Promise<boolean> {
    if (!this.devSettings.emailsEnabled()) {
      console.log('[EmailService] Emails disabled by dev settings');
      return false;
    }

    const user = this.auth.currentUser();
    if (!user?.email) {
      console.warn('[EmailService] No user email, skipping');
      return false;
    }

    const currencySymbol = params.currency === 'PEN' ? '' : params.currency === 'USD' ? '$' : params.currency;

    try {
      const emailjs = await this.loadEmailJS();
      const templateParams = {
        to_email: user.email,
        to_name: user.displayName || 'Usuario',
        source_name: params.sourceName,
        amount: `${currencySymbol} ${params.amount.toFixed(2)}`,
        amount_raw: params.amount,
        currency: params.currency || 'PEN',
        date: params.date,
        frequency: params.frequency || 'Mensual',
        next_date: params.fechaVencimiento || 'N/A',
        anticipation_days: params.anticipationDays ?? 0,
        app_name: 'ARCHIVA',
        subject: `✅ Documento confirmado: ${params.sourceName}`,
        header_color: '#10b981',
        header_icon: '✅',
        status_text: 'RECIBIDO',
        status_color: '#10b981'
      };
      console.log('[EmailService] Sending confirmation:', templateParams);
      await emailjs.send(this.SERVICE_ID, this.TEMPLATE_CONFIRM, templateParams);
      console.log('[EmailService] Confirmation sent OK');
      return true;
    } catch (error: any) {
      console.error('[EmailService] Send failed:', error?.status, error?.text || error?.message || error);
      return false;
    }
  }

  async sendCatchUpReminder(params: {
    sourceName: string;
    renovacionesOmitidas: number;
    periodosOmitidos: string[];
    amount?: number;
    currency?: string;
  }): Promise<boolean> {
    if (!this.devSettings.emailsEnabled()) {
      console.log('[EmailService] Emails disabled by dev settings');
      return false;
    }

    const user = this.auth.currentUser();
    if (!user?.email) {
      console.warn('[EmailService] No user email, skipping catch-up');
      return false;
    }

    const currencySymbol = (params.currency || 'PEN') === 'PEN' ? '' : '$';

    try {
      const emailjs = await this.loadEmailJS();
      const templateParams = {
        to_email: user.email,
        to_name: user.displayName || 'Usuario',
        source_name: params.sourceName,
        missed_count: params.renovacionesOmitidas,
        missed_months: params.periodosOmitidos.join(', '),
        amount: params.amount ? `${currencySymbol} ${params.amount.toFixed(2)}` : 'N/A',
        app_name: 'ARCHIVA',
        subject: `⚠️ Pagos pendientes: ${params.sourceName} (${params.renovacionesOmitidas} meses)`,
        header_color: '#f59e0b',
        header_icon: '⚠️',
        status_text: 'PENDIENTE',
        status_color: '#f59e0b'
      };
      console.log('[EmailService] Sending catch-up:', templateParams);
      await emailjs.send(this.SERVICE_ID, this.TEMPLATE_CATCHUP, templateParams);
      console.log('[EmailService] Catch-up sent OK');
      return true;
    } catch (error: any) {
      console.error('[EmailService] Catch-up send failed:', error?.status, error?.text || error?.message || error);
      return false;
    }
  }
}
