import { Injectable, effect, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro' | 'sistema';

const CLAVE = 'archiva_tema';

/**
 * Tema de la interfaz.
 *
 * Tres estados, no dos: "sistema" respeta prefers-color-scheme y es el valor
 * por defecto, porque quien ya configuro su equipo en oscuro no deberia tener
 * que repetirlo aqui. Solo cuando la persona elige explicitamente se marca el
 * atributo data-theme en la raiz, que tiene prioridad sobre la media query.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {

  tema = signal<Tema>(this.leerPreferencia());

  /** Tema efectivo una vez resuelto "sistema". */
  temaAplicado = signal<'claro' | 'oscuro'>('claro');

  private mq = typeof matchMedia !== 'undefined'
    ? matchMedia('(prefers-color-scheme: dark)')
    : null;

  constructor() {
    effect(() => {
      const t = this.tema();
      this.aplicar(t);
      try { localStorage.setItem(CLAVE, t); } catch { /* modo privado */ }
    });

    // Si sigue al sistema, hay que reaccionar cuando el sistema cambia.
    this.mq?.addEventListener?.('change', () => {
      if (this.tema() === 'sistema') this.aplicar('sistema');
    });
  }

  alternar(): void {
    // Desde "sistema" se salta al contrario de lo que se este viendo,
    // que es lo que la persona espera al pulsar el boton.
    const actual = this.temaAplicado();
    this.tema.set(actual === 'oscuro' ? 'claro' : 'oscuro');
  }

  seguirAlSistema(): void {
    this.tema.set('sistema');
  }

  private aplicar(t: Tema): void {
    if (typeof document === 'undefined') return;

    const raiz = document.documentElement;
    const oscuroDelSistema = this.mq?.matches ?? false;
    const efectivo: 'claro' | 'oscuro' =
      t === 'sistema' ? (oscuroDelSistema ? 'oscuro' : 'claro') : t;

    if (t === 'sistema') raiz.removeAttribute('data-theme');
    else raiz.setAttribute('data-theme', t === 'oscuro' ? 'dark' : 'light');

    raiz.style.colorScheme = efectivo === 'oscuro' ? 'dark' : 'light';
    this.temaAplicado.set(efectivo);
  }

  private leerPreferencia(): Tema {
    try {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado === 'claro' || guardado === 'oscuro' || guardado === 'sistema') return guardado;
    } catch { /* modo privado */ }
    return 'sistema';
  }
}
