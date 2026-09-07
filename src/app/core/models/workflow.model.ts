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

  /** Definicion de cada etapa, en orden. */
  etapasDefinidas?: EtapaDefinida[];

  /** Nombres sueltos de las etapas. Se conserva para los flujos antiguos. */
  nombresEtapas?: string[];

  /** Un flujo desactivado no admite nuevos expedientes. */
  activo?: boolean;

  /** De que flujo se copio, si nacio de un duplicado. */
  duplicadoDe?: string;

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
  /** Por que se retiro del seguimiento. */
  motivoAnulacion?: string;

  // Metadata
  tags?: string[];
  version?: number;
}

/**
 * Resultado de una etapa.
 *
 * Aprobar hace avanzar el contador. Observar devuelve el documento a quien
 * lo presento sin detener el flujo: se corrige y se vuelve a presentar la
 * misma etapa. Rechazar es la negativa firme del aprobador y suspende el
 * flujo hasta que alguien decida reanudarlo.
 */
export type ResultadoEtapa = 'aprobada' | 'observada' | 'rechazada';

export const RESULTADOS_ETAPA: Record<ResultadoEtapa, {
  label: string;
  icon: string;
  token: string;
  /** Que le ocurre al flujo despues de este resultado. */
  efecto: string;
}> = {
  aprobada: {
    label: 'Aprobada', icon: 'file-check', token: 'var(--estado-aprobado)',
    efecto: 'El flujo avanza a la etapa siguiente'
  },
  observada: {
    label: 'Observada', icon: 'file-warning', token: 'var(--estado-observado)',
    efecto: 'Vuelve a quien lo presentó; la etapa sigue pendiente'
  },
  rechazada: {
    label: 'Rechazada', icon: 'file-x', token: 'var(--estado-rechazado)',
    efecto: 'El flujo queda suspendido hasta que se reanude'
  }
};

export const ESTADOS_FLUJO: Record<EstadoFlujo, {
  label: string;
  icon: string;
  token: string;
  descripcion: string;
}> = {
  active: {
    label: 'En curso', icon: 'git-branch', token: 'var(--estado-en-revision)',
    descripcion: 'Recorriendo sus etapas'
  },
  completed: {
    label: 'Completado', icon: 'check-circle', token: 'var(--estado-aprobado)',
    descripcion: 'Todas las etapas aprobadas'
  },
  paused: {
    label: 'Suspendido', icon: 'file-x', token: 'var(--estado-rechazado)',
    descripcion: 'Detenido tras un rechazo'
  },
  cancelled: {
    label: 'Anulado', icon: 'archive', token: 'var(--estado-archivado)',
    descripcion: 'Retirado del seguimiento'
  }
};

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

  etapasDefinidas?: EtapaDefinida[];
  /** Nombres de las etapas, en orden. */
  nombresEtapas?: string[];
  activo?: boolean;
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

/**
 * El color sale del token, no de un literal. Los hex fijos —#A3342B para
 * alta— daban 2,40:1 sobre la tarjeta del tema oscuro, muy por debajo del
 * minimo de 3:1 que WCAG pide para un indicador de color.
 */
export const PRIORIDADES_FLUJO: Record<PrioridadFlujo, { label: string; color: string }> = {
  high:   { label: 'Alta',  color: 'var(--color-error)' },
  medium: { label: 'Media', color: 'var(--color-warning)' },
  low:    { label: 'Baja',  color: 'var(--color-success)' }
};
// ============================================
// SECUENCIA DE ETAPAS
// ============================================

/**
 * Orden de la etapa que toca resolver.
 *
 * Un flujo con dos etapas aprobadas espera la tercera. La secuencia importa:
 * la etapa 2 no se firma antes que la 1, y sin esta cuenta cualquiera podia
 * registrar la ultima etapa de un flujo recien creado.
 */
export function siguienteOrden(flujo: Pick<FlujoAprobacion, 'etapasCompletadas'>): number {
  return (flujo.etapasCompletadas ?? 0) + 1;
}

/** Nombre declarado para una etapa, o uno derivado de su posicion. */
export function nombreDeEtapa(
  flujo: Pick<FlujoAprobacion, 'nombresEtapas' | 'etapasTotales'>,
  orden: number
): string {
  const declarado = flujo.nombresEtapas?.[orden - 1]?.trim();
  return declarado || `Etapa ${orden} de ${flujo.etapasTotales}`;
}

/** Solo un flujo en curso y con etapas pendientes admite resoluciones. */
export function admiteResolucion(flujo: Pick<FlujoAprobacion, 'status' | 'etapasCompletadas' | 'etapasTotales'>): boolean {
  return flujo.status === 'active' && flujo.etapasCompletadas < flujo.etapasTotales;
}

/** Un flujo suspendido por rechazo puede volver al curso. */
export function admiteReanudacion(flujo: Pick<FlujoAprobacion, 'status'>): boolean {
  return flujo.status === 'paused';
}

// ============================================
// VALIDACION DEL ALTA
// ============================================

/**
 * Devuelve el primer motivo por el que el flujo no puede guardarse, o null
 * si esta completo. Se valida aqui, en el modelo, para que la pantalla y
 * el servicio compartan exactamente las mismas reglas.
 */
export function validarFlujo(p: Partial<FlujoAprobacionPayload>): string | null {
  if (!p.name?.trim()) {
    return 'Ponle un nombre al flujo: es como se le reconoce en el listado.';
  }
  if (p.name.trim().length < 3) {
    return 'El nombre necesita al menos tres caracteres.';
  }
  if (!p.category) {
    return 'Elige el tipo de flujo.';
  }
  if (!p.etapasTotales || p.etapasTotales < 1) {
    return 'Un flujo necesita al menos una etapa.';
  }
  if (p.etapasTotales > 20) {
    return 'Veinte etapas es el máximo: por encima de eso conviene partirlo en varios flujos.';
  }
  if (!p.etapasPorPeriodo || p.etapasPorPeriodo < 1) {
    return 'Indica cuántas etapas se resuelven por periodo, al menos una.';
  }
  if (p.etapasPorPeriodo > p.etapasTotales) {
    return 'No se pueden resolver más etapas por periodo que las que tiene el flujo.';
  }
  if (p.fechaLimiteCierre && p.fechaLimiteCierre < hoyIso()) {
    return 'La fecha límite ya pasó.';
  }
  return null;
}

function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajusta la lista de nombres al numero de etapas declarado. */
export function ajustarNombresEtapas(nombres: string[], total: number): string[] {
  const salida = nombres.slice(0, total);
  while (salida.length < total) salida.push('');
  return salida;
}

// ============================================
// RESUMEN DEL CONJUNTO
// ============================================

export interface ResumenFlujos {
  total: number;
  enCurso: number;
  completados: number;
  suspendidos: number;
  anulados: number;
  /** Etapas aprobadas sobre etapas previstas, en los flujos no anulados. */
  avanceGlobal: number;
  /** Flujos que pasaron su fecha limite sin cerrarse. */
  vencidos: number;
}

export function resumirFlujos(flujos: FlujoAprobacion[]): ResumenFlujos {
  const hoy = hoyIso();
  const vivos = flujos.filter(f => f.status !== 'cancelled');

  const etapasPrevistas = vivos.reduce((s, f) => s + (f.etapasTotales || 0), 0);
  const etapasHechas    = vivos.reduce((s, f) => s + (f.etapasCompletadas || 0), 0);

  const cuenta = (e: EstadoFlujo) => flujos.filter(f => f.status === e).length;

  return {
    total: flujos.length,
    enCurso: cuenta('active'),
    completados: cuenta('completed'),
    suspendidos: cuenta('paused'),
    anulados: cuenta('cancelled'),
    avanceGlobal: etapasPrevistas > 0
      ? Math.round((etapasHechas / etapasPrevistas) * 100)
      : 0,
    vencidos: flujos.filter(f =>
      f.status === 'active' &&
      f.fechaLimiteCierre &&
      f.fechaLimiteCierre < hoy
    ).length
  };
}

// ============================================
// DEFINICION DE ETAPAS
// ============================================

/**
 * Una etapa del flujo con su responsable.
 *
 * Antes la etapa era solo un nombre en un arreglo de cadenas: no habia
 * forma de saber a quien le tocaba, asi que la bandeja de una persona no
 * podia existir. Aqui la etapa declara quien responde de ella, con que rol
 * minimo y en cuantos dias deberia resolverse.
 */
export interface EtapaDefinida {
  orden: number;
  nombre: string;

  /** Persona concreta que responde de la etapa. */
  responsableUid: string;
  responsableNombre: string;

  /** Rol minimo exigido; sirve para reasignar sin romper el flujo. */
  rolRequerido?: string;
  area?: string;

  /** Plazo sugerido en dias desde que la etapa se abre. */
  plazoDias?: number;
  /** Indicaciones para quien la resuelve. */
  instrucciones?: string;
}

/** Etapa vacia lista para rellenar en el formulario. */
export function etapaVacia(orden: number): EtapaDefinida {
  return {
    orden,
    nombre: '',
    responsableUid: '',
    responsableNombre: '',
    plazoDias: 3
  };
}

/** Ajusta la lista de etapas al numero declarado, sin perder lo escrito. */
export function ajustarEtapas(etapas: EtapaDefinida[], total: number): EtapaDefinida[] {
  const salida = etapas.slice(0, total).map((e, i) => ({ ...e, orden: i + 1 }));
  while (salida.length < total) salida.push(etapaVacia(salida.length + 1));
  return salida;
}

/**
 * Primer motivo por el que las etapas no sirven, o null.
 *
 * Una etapa sin responsable no genera tarea y el expediente se queda
 * parado sin que nadie sepa a quien reclamarle.
 */
export function validarEtapas(etapas: EtapaDefinida[] | undefined): string | null {
  if (!etapas?.length) return 'El flujo necesita al menos una etapa.';

  for (const e of etapas) {
    if (!e.nombre?.trim()) {
      return `La etapa ${e.orden} necesita un nombre.`;
    }
    if (!e.responsableUid) {
      return `La etapa ${e.orden} no tiene responsable: nadie recibiria el expediente.`;
    }
    if (e.plazoDias != null && (e.plazoDias < 1 || e.plazoDias > 180)) {
      return `El plazo de la etapa ${e.orden} va de 1 a 180 dias.`;
    }
  }

  return null;
}

/** Convierte los nombres sueltos de un flujo antiguo en etapas definidas. */
export function migrarNombresAEtapas(
  nombres: string[] | undefined,
  total: number
): EtapaDefinida[] {
  return ajustarEtapas(
    (nombres ?? []).map((n, i) => ({
      ...etapaVacia(i + 1),
      nombre: n?.trim() || `Etapa ${i + 1}`
    })),
    total
  );
}

/** Copia un flujo como plantilla nueva, sin su historial. */
export function duplicarFlujo(f: FlujoAprobacion): FlujoAprobacionPayload {
  return {
    name: `${f.name} (copia)`,
    description: f.description,
    category: f.category,
    etapasTotales: f.etapasTotales,
    etapasCompletadas: 0,
    etapasPorPeriodo: f.etapasPorPeriodo,
    etapasDefinidas: (f.etapasDefinidas ?? []).map(e => ({ ...e })),
    nombresEtapas: [...(f.nombresEtapas ?? [])],
    priority: f.priority,
    notes: f.notes,
    activo: true
  };
}
