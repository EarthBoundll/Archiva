import {
  Directive,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  inject,
  output
} from '@angular/core';

/**
 * Comportamiento de teclado de un diálogo modal.
 *
 * La aplicación tenía diez capas modales y ninguna cerraba con Escape ni
 * retenía el foco: quien navegaba con teclado se quedaba en la página de
 * detrás, podía tabular por el contenido oculto bajo la capa y, al cerrar,
 * el foco no volvía al botón que lo había abierto.
 *
 * Se resuelve una vez, aquí, en vez de diez veces en cada plantilla:
 *
 *   - Escape emite `cerrar`.
 *   - El foco entra al abrirse, en el primer campo o en el propio diálogo.
 *   - Tab y Mayús+Tab circulan dentro del diálogo, sin salir.
 *   - Al destruirse, el foco vuelve a donde estaba.
 *
 * Uso:  <div class="modal" appDialogo (cerrar)="cerrarModal()"> … </div>
 */
@Directive({
  selector: '[appDialogo]',
  standalone: true,
  host: {
    'role': 'dialog',
    'aria-modal': 'true',
    'tabindex': '-1'
  }
})
export class DialogoDirective implements AfterViewInit, OnDestroy {
  private host: ElementRef<HTMLElement> = inject(ElementRef);

  /** Escape, o cualquier petición de cierre desde el teclado. */
  cerrar = output<void>();

  /** Dónde estaba el foco antes de abrirse, para devolverlo al cerrar. */
  private origen: HTMLElement | null = null;

  private readonly ENFOCABLES = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  ngAfterViewInit(): void {
    this.origen = document.activeElement as HTMLElement | null;

    // Un fotograma de margen: el contenido puede aún no estar pintado.
    requestAnimationFrame(() => {
      const primero = this.enfocables()[0];
      (primero ?? this.host.nativeElement).focus({ preventScroll: true });
    });

    document.addEventListener('keydown', this.alPulsar, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.alPulsar, true);

    // Devolver el foco solo si sigue en el diálogo: si el usuario ya lo
    // movió a otro sitio, arrebatárselo sería peor que no hacer nada.
    const activo = document.activeElement;
    const dentro = !activo || activo === document.body
                || this.host.nativeElement.contains(activo);

    if (dentro && this.origen?.isConnected) {
      this.origen.focus({ preventScroll: true });
    }
  }

  private alPulsar = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      this.cerrar.emit();
      return;
    }

    if (ev.key !== 'Tab') return;

    const lista = this.enfocables();
    if (lista.length === 0) {
      // Sin nada que enfocar dentro, el tabulador no debe escaparse.
      ev.preventDefault();
      this.host.nativeElement.focus({ preventScroll: true });
      return;
    }

    const primero = lista[0];
    const ultimo  = lista[lista.length - 1];
    const activo  = document.activeElement;

    // Circular: del último al primero y del primero al último.
    if (!ev.shiftKey && activo === ultimo) {
      ev.preventDefault();
      primero.focus({ preventScroll: true });
    } else if (ev.shiftKey && (activo === primero || activo === this.host.nativeElement)) {
      ev.preventDefault();
      ultimo.focus({ preventScroll: true });
    } else if (!this.host.nativeElement.contains(activo)) {
      // El foco se fue fuera por cualquier otra vía: se recupera.
      ev.preventDefault();
      primero.focus({ preventScroll: true });
    }
  };

  /** Elementos enfocables visibles, en orden de documento. */
  private enfocables(): HTMLElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(this.ENFOCABLES)
    ).filter(el =>
      el.offsetParent !== null &&
      !el.hasAttribute('inert') &&
      getComputedStyle(el).visibility !== 'hidden'
    );
  }
}
