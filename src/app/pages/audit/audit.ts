import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditService } from '../../core/services/audit';
import { IconComponent } from '../../core/components/icon/icon.component';
import {
  AsientoAuditoria,
  EntidadAuditada,
  ACCIONES_AUDITADAS,
  narrar,
  tokenDe,
  agruparPorDia
} from '../../core/models/audit.model';

/**
 * Registro de trazabilidad.
 *
 * Quién hizo qué, sobre qué y cuándo. Es la evidencia que se presenta ante
 * una auditoría, así que la pantalla solo lee: no hay forma de editar ni
 * de borrar un asiento desde aquí, ni desde ninguna otra parte.
 */
@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './audit.html',
  styleUrl: './audit.scss'
})
export class AuditComponent implements OnInit {
  private audit = inject(AuditService);

  asientos = signal<AsientoAuditoria[]>([]);
  cargando = signal(true);
  error = signal('');

  filtroEntidad = signal<EntidadAuditada | null>(null);
  busqueda = signal('');

  acciones = ACCIONES_AUDITADAS;

  entidades: Array<{ value: EntidadAuditada; label: string }> = [
    { value: 'documento',  label: 'Documentos' },
    { value: 'flujo',      label: 'Flujos' },
    { value: 'tarea',      label: 'Aprobaciones' },
    { value: 'solicitud',  label: 'Solicitudes' },
    { value: 'usuario',    label: 'Personas' },
    { value: 'invitacion', label: 'Invitaciones' },
    { value: 'empresa',    label: 'Empresa' },
    { value: 'cuota',      label: 'Almacenamiento' }
  ];

  visibles = computed(() => {
    const e = this.filtroEntidad();
    const q = this.busqueda().trim().toLowerCase();

    return this.asientos().filter(a => {
      if (e && a.entidad !== e) return false;
      if (!q) return true;
      return a.actorNombre.toLowerCase().includes(q)
          || a.entidadEtiqueta.toLowerCase().includes(q)
          || (a.detalle ?? '').toLowerCase().includes(q);
    });
  });

  porDia = computed(() => agruparPorDia(this.visibles()));

  conteoPorEntidad = computed(() => {
    const c: Record<string, number> = {};
    for (const a of this.asientos()) c[a.entidad] = (c[a.entidad] ?? 0) + 1;
    return c;
  });

  async ngOnInit() {
    this.cargando.set(true);
    try {
      this.asientos.set(await this.audit.getAsientos(400));
    } catch {
      this.error.set('No se pudo leer el registro de auditoría.');
    } finally {
      this.cargando.set(false);
    }
  }

  frase(a: AsientoAuditoria): string { return narrar(a); }
  token(a: AsientoAuditoria): string { return tokenDe(a.accion); }

  alternar(e: EntidadAuditada) {
    this.filtroEntidad.set(this.filtroEntidad() === e ? null : e);
  }

  fechaLarga(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    const hoy = new Date();
    const ayer = new Date(hoy.getTime() - 86400000);

    const mismo = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    if (mismo(d, hoy))  return 'Hoy';
    if (mismo(d, ayer)) return 'Ayer';

    return d.toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}
