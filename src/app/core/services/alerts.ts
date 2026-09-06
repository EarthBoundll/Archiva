import { Injectable, inject } from '@angular/core';
import { DocumentService } from './document';
import { ReviewRequestService } from './review-request';
import { StorageService } from './storage';
import { Documento } from '../models/document.model';
import { SolicitudRevision } from '../models/review-request.model';

// ============================================
// ALERTAS DOCUMENTALES — ARCHIVA
// ============================================
// Lo que exige atencion hoy, ordenado por urgencia. El servicio no guarda
// nada: cada alerta se deriva del estado actual del acervo, porque una
// alerta almacenada seguiria avisando de algo ya resuelto.
//
// Sustituye al modelo financiero anterior, que avisaba de gastos vencidos,
// ingresos no recibidos y tasa de ahorro baja.

export type TipoAlerta =
  | 'documento_vencido'
  | 'documento_por_vencer'
  | 'documento_observado'
  | 'revision_estancada'
  | 'solicitud_vencida'
  | 'solicitud_prioritaria'
  | 'cuota_excedida'
  | 'cuota_en_riesgo';

export type Urgencia = 'critica' | 'alta' | 'media' | 'baja';

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  urgencia: Urgencia;
  titulo: string;
  mensaje: string;
  /** Hacia donde lleva al pulsarla. */
  ruta: string;
  codigo?: string;
  icono: string;
  createdAt: string;
}

/** Dias en revision a partir de los cuales se considera estancado. */
const DIAS_REVISION_ESTANCADA = 15;

/** Ventana de aviso previo al vencimiento. */
const DIAS_PREAVISO = 30;

const ORDEN: Record<Urgencia, number> = { critica: 0, alta: 1, media: 2, baja: 3 };

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private documentService = inject(DocumentService);
  private reviewService   = inject(ReviewRequestService);
  private storageService  = inject(StorageService);

  /**
   * Reune todas las alertas vigentes. Recibe el periodo porque las cuotas de
   * almacenamiento se asignan por mes; el resto del acervo no depende de el.
   */
  async getAlertasDocumentales(year: number, month: number): Promise<Alerta[]> {
    const [documentos, solicitudes] = await Promise.all([
      this.documentService.getAll(),
      this.reviewService.getAll()
    ]);

    const alertas = [
      ...this.deDocumentos(documentos),
      ...this.deSolicitudes(solicitudes),
      ...await this.deCuotas(year, month)
    ];

    return alertas.sort((a, b) => ORDEN[a.urgencia] - ORDEN[b.urgencia]);
  }

  // ------------------------------------------
  // DOCUMENTOS
  // ------------------------------------------

  private deDocumentos(docs: Documento[]): Alerta[] {
    const alertas: Alerta[] = [];
    const ahora = new Date().toISOString();

    for (const d of docs) {
      if (d.estado === 'archivado') continue;

      const dias = d.vencimiento?.diasParaVencer ?? null;

      // Vencido: la vigencia ya expiro y el documento sigue en circulacion.
      if (d.estado === 'vencido' || (dias !== null && dias < 0)) {
        alertas.push({
          id: `doc-vencido-${d.id}`,
          tipo: 'documento_vencido',
          urgencia: 'critica',
          titulo: `Documento vencido: ${d.titulo}`,
          mensaje: dias !== null
            ? `Su vigencia expiró hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}. Registra una versión nueva o envíalo al archivo.`
            : 'Su vigencia expiró. Registra una versión nueva o envíalo al archivo.',
          ruta: '/documentos',
          codigo: d.codigo,
          icono: 'calendar-x',
          createdAt: ahora
        });
        continue;
      }

      // Por vencer: aviso con antelacion suficiente para renovarlo.
      if (d.estado === 'aprobado' && dias !== null && dias >= 0 && dias <= DIAS_PREAVISO) {
        alertas.push({
          id: `doc-por-vencer-${d.id}`,
          tipo: 'documento_por_vencer',
          urgencia: dias <= 7 ? 'alta' : 'media',
          titulo: `Vence en ${dias === 0 ? 'hoy' : `${dias} ${dias === 1 ? 'día' : 'días'}`}: ${d.titulo}`,
          mensaje: 'Prepara la renovación antes de que pierda vigencia.',
          ruta: '/documentos',
          codigo: d.codigo,
          icono: 'calendar-clock',
          createdAt: ahora
        });
      }

      // Devuelto a su autor: nadie avanza mientras no se corrija.
      if (d.estado === 'observado' || d.estado === 'rechazado') {
        alertas.push({
          id: `doc-observado-${d.id}`,
          tipo: 'documento_observado',
          urgencia: d.estado === 'rechazado' ? 'alta' : 'media',
          titulo: `${d.estado === 'rechazado' ? 'Rechazado' : 'Observado'}: ${d.titulo}`,
          mensaje: d.motivoEstado?.trim()
            ? d.motivoEstado
            : 'Fue devuelto sin motivo registrado. Consulta con quien lo revisó.',
          ruta: '/documentos',
          codigo: d.codigo,
          icono: 'file-warning',
          createdAt: ahora
        });
      }

      // Estancado en revision: no esta bloqueado por nada, solo olvidado.
      if (d.estado === 'en_revision' && d.fechaEnvioRevision) {
        const espera = Math.floor(
          (Date.now() - new Date(d.fechaEnvioRevision).getTime()) / 86400000
        );
        if (espera >= DIAS_REVISION_ESTANCADA) {
          alertas.push({
            id: `doc-estancado-${d.id}`,
            tipo: 'revision_estancada',
            urgencia: 'media',
            titulo: `Lleva ${espera} días en revisión: ${d.titulo}`,
            mensaje: 'Nadie lo ha aprobado ni observado desde que se envió.',
            ruta: '/documentos',
            codigo: d.codigo,
            icono: 'clock',
            createdAt: ahora
          });
        }
      }
    }

    return alertas;
  }

  // ------------------------------------------
  // SOLICITUDES DE REVISION
  // ------------------------------------------

  private deSolicitudes(solicitudes: SolicitudRevision[]): Alerta[] {
    const alertas: Alerta[] = [];
    const ahora = new Date().toISOString();

    for (const s of solicitudes) {
      if (s.status === 'atendida' || s.status === 'anulada') continue;

      if (s.status === 'vencida') {
        alertas.push({
          id: `sol-vencida-${s.id}`,
          tipo: 'solicitud_vencida',
          urgencia: s.esPrioritaria ? 'critica' : 'alta',
          titulo: `Solicitud vencida: ${s.titulo}`,
          mensaje: `Pasó su fecha límite (${s.fechaLimiteAtencion}) sobre ${s.codigoDocumento}.`,
          ruta: '/solicitudes',
          codigo: s.codigoDocumento,
          icono: 'file-x',
          createdAt: ahora
        });
        continue;
      }

      // Una prioritaria abierta bloquea el avance del documento.
      if (s.esPrioritaria && s.status === 'pendiente') {
        alertas.push({
          id: `sol-prioritaria-${s.id}`,
          tipo: 'solicitud_prioritaria',
          urgencia: 'alta',
          titulo: `Prioritaria sin atender: ${s.titulo}`,
          mensaje: `${s.codigoDocumento} no puede avanzar mientras siga abierta.`,
          ruta: '/solicitudes',
          codigo: s.codigoDocumento,
          icono: 'shield-alert',
          createdAt: ahora
        });
      }
    }

    return alertas;
  }

  // ------------------------------------------
  // CUOTAS DE ALMACENAMIENTO
  // ------------------------------------------

  private async deCuotas(year: number, month: number): Promise<Alerta[]> {
    const alertas: Alerta[] = [];
    const ahora = new Date().toISOString();
    const [cuotas, ocupacion] = await Promise.all([
      this.storageService.getPorPeriodo(year, month),
      this.storageService.getOcupacionPorCategoria()
    ]);

    for (const c of cuotas as any[]) {
      const asignado = c.budgetedAmount || 0;
      // Medido sobre el acervo: el documento de cuota no guarda el consumo.
      const ocupado  = ocupacion[c.category] ?? 0;
      if (asignado <= 0) continue;

      const pct = Math.round((ocupado / asignado) * 100);
      const nombre = c.categoryName || c.category;

      if (pct >= 100) {
        alertas.push({
          id: `cuota-excedida-${c.category}-${month}`,
          tipo: 'cuota_excedida',
          urgencia: c.esPrioritaria ? 'critica' : 'alta',
          titulo: `Cuota agotada: ${nombre}`,
          mensaje: `La serie ocupa el ${pct}% del espacio asignado. Amplía la cuota o archiva lo que ya no esté vigente.`,
          ruta: '/almacenamiento',
          icono: 'hard-drive',
          createdAt: ahora
        });
      } else if (pct >= 80) {
        alertas.push({
          id: `cuota-riesgo-${c.category}-${month}`,
          tipo: 'cuota_en_riesgo',
          urgencia: 'baja',
          titulo: `Cuota al ${pct}%: ${nombre}`,
          mensaje: 'Queda poco espacio en esta serie documental.',
          ruta: '/almacenamiento',
          icono: 'hard-drive',
          createdAt: ahora
        });
      }
    }

    return alertas;
  }
}
