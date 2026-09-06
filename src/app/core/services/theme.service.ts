import { Injectable, signal } from '@angular/core';

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

  private mqMovimiento = typeof matchMedia !== 'undefined'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  constructor() {
    this.aplicar(this.tema());

    // Si sigue al sistema, hay que reaccionar cuando el sistema cambia.
    this.mq?.addEventListener?.('change', () => {
      if (this.tema() === 'sistema') this.aplicar('sistema');
    });
  }

  /**
   * Cambia de tema con un barrido circular desde el punto pulsado.
   *
   * Usa la View Transitions API: el navegador toma una instantanea del
   * estado anterior y la del nuevo, y aqui se revela la segunda con un
   * circulo que crece desde el interruptor. Donde no esta disponible, o
   * si la persona pidio menos movimiento, el cambio es instantaneo.
   */
  alternar(origen?: { x: number; y: number }): void {
    const siguiente: Tema = this.temaAplicado() === 'oscuro' ? 'claro' : 'oscuro';

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };

    const sinMovimiento = this.mqMovimiento?.matches ?? false;

    if (!doc.startViewTransition || sinMovimiento || !origen) {
      this.fijar(siguiente);
      return;
    }

    // El cambio debe ocurrir de forma sincrona dentro del callback, o el
    // navegador captura la instantanea antes de que el tema haya cambiado.
    const transicion = doc.startViewTransition(() => this.fijar(siguiente));

    transicion.ready.then(() => {
      const { x, y } = origen;
      // Radio hasta la esquina mas lejana: el circulo debe cubrir la pantalla.
      const radio = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y)
      );

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radio}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 560,
          easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    }).catch(() => { /* si la transicion se cancela, el tema ya cambio */ });
  }

  seguirAlSistema(): void {
    this.fijar('sistema');
  }

  private fijar(t: Tema): void {
    this.tema.set(t);
    this.aplicar(t);
    try { localStorage.setItem(CLAVE, t); } catch { /* modo privado */ }
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
