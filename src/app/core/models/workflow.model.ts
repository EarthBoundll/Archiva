// ============================================
// MODELO DE FLUJOS DE APROBACION - ARCHIVA
// Avance por etapas + proyeccion de cierre
// ============================================

export type TipoFlujo =
  | 'aprobacion_contrato'     // Aprobacion de un contrato
  | 'aprobacion_factura'      // Conformidad y pago de factura
  | 'aprobacion_cuota'  // Aprobacion de cuota
  | 'revision_legal'          // Revision del area legal
  | 'visto_bueno_gerencia'    // Visto bueno de gerencia
  | 'validacion_tecnica'      // Validacion del area tecnica
  | 'firma_convenio'          // Suscripcion de convenio
  | 'publicacion_politica'    // Publicacion de politica interna
  | 'homologacion_proveedor'  // Homologacion de proveedor
  | 'cierre_expediente'       // Cierre y archivo de expediente
  | 'renovacion_documento'    // Renovacion de documento por vencimiento
  | 'otro';                   // Otro flujo         // Otro

export type PrioridadFlujo = 'high' | 'medium' | 'low';

export type EstadoFlujo = 'active' | 'completed' | 'paused' | 'cancelled';

export interface FlujoAprobacion {
  id: string;
  userId: string;
  
  // Documento que recorre el flujo
  documentoId?: string;
  codigoDocumento?: string;

  // Informacion basica
  name: string;
  description?: string;
  category: TipoFlujo;
  
  // Cantidads
  etapasTotales: number;
  etapasCompletadas: number;
  etapasPorPeriodo: number;

  /** Nombres de las etapas, en orden. */
  nombresEtapas?: string[];
  
  // Fechas
  fechaLimiteCierre?: string;          // Fecha objetivo específica
  createdAt: string;
  updatedAt: string;
  
  // Estado
  status: EstadoFlujo;
  priority: PrioridadFlujo;
  estaCompletado: boolean;
  
  // Proyecciones calculadas
  periodosParaCierre: number | null;
  fechaProyectadaCierre?: string;
  
  // Historial
  etapas: EtapaAprobacion[];
  
  // Notas
  notes?: string;
  
  // Metadata
  tags?: string[];
  version?: number;
}

/** Resultado de una etapa. Observar devuelve el flujo, no lo detiene. */
export type ResultadoEtapa = 'aprobada' | 'observada';

export interface EtapaAprobacion {
  id: string;
  /** Posicion en la secuencia: la etapa 2 no se firma antes que la 1. */
  orden: number;
  nombre: string;
  aprobador: string;
  resultado: ResultadoEtapa;
  observacion?: string;
  date: string;
}

export interface FlujoAprobacionPayload {
  name: string;
  description?: string;
  category: TipoFlujo;
  etapasTotales: number;
  etapasCompletadas?: number;
  etapasPorPeriodo: number;

  /** Nombres de las etapas, en orden. */
  nombresEtapas?: string[];
  fechaLimiteCierre?: string;
  priority?: PrioridadFlujo;
  notes?: string;
  tags?: string[];
}

// ============================================
// CÁLCULOS
// ============================================

export function calcularPeriodosParaCierre(
  etapasTotales: number,
  etapasCompletadas: number,
  etapasPorPeriodo: number
): number | null {
  const remaining = etapasTotales - etapasCompletadas;
  if (remaining <= 0) return 0;
  if (etapasPorPeriodo <= 0) return null;
  return Math.ceil(remaining / etapasPorPeriodo);
}

export function calcularFechaProyectada(periodosParaCierre: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + periodosParaCierre);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calcularAvanceFlujo(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

export function calcularEtapasRequeridas(
  etapasTotales: number,
  etapasCompletadas: number,
  monthsRemaining: number
): number {
  const remaining = etapasTotales - etapasCompletadas;
  if (remaining <= 0 || monthsRemaining <= 0) return 0;
  return Math.ceil(remaining / monthsRemaining);
}

// ============================================
// CATEGORÍAS PREDEFINIDAS
// ============================================

export const TIPOS_FLUJO: Record<TipoFlujo, { name: string; icon: string }> = {
  aprobacion_contrato:    { name: 'Aprobacion de contrato', icon: 'file-signature' },
  aprobacion_factura:     { name: 'Aprobacion de factura', icon: 'receipt' },
  aprobacion_cuota: { name: 'Aprobacion de cuota', icon: 'calculator' },
  revision_legal:         { name: 'Revision legal', icon: 'scale' },
  visto_bueno_gerencia:   { name: 'Visto bueno de gerencia', icon: 'stamp' },
  validacion_tecnica:     { name: 'Validacion tecnica', icon: 'settings-2' },
  firma_convenio:         { name: 'Firma de convenio', icon: 'handshake' },
  publicacion_politica:   { name: 'Publicacion de politica', icon: 'shield-check' },
  homologacion_proveedor: { name: 'Homologacion de proveedor', icon: 'building-2' },
  cierre_expediente:      { name: 'Cierre de expediente', icon: 'archive' },
  renovacion_documento:   { name: 'Renovacion documental', icon: 'calendar-clock' },
  otro:                   { name: 'Otro flujo', icon: 'git-branch' }
};

export const PRIORIDADES_FLUJO: Record<PrioridadFlujo, { label: string; color: string }> = {
  high: { label: 'Alta', color: '#A3342B' },
  medium: { label: 'Media', color: '#B8791F' },
  low: { label: 'Baja', color: '#2D7D5A' }
};