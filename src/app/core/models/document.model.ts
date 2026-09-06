// ============================================
// MODELO DE DOCUMENTOS - ARCHIVA
// Categorias documentales + ciclo de renovacion + control de vencimiento
// ============================================

export type CategoriaDocumental =
  | 'contrato'
  | 'factura'
  | 'orden_compra'
  | 'memorando'
  | 'oficio'
  | 'informe'
  | 'resolucion'
  | 'convenio'
  | 'manual'
  | 'politica'
  | 'procedimiento'
  | 'otros';

export type TipoDocumental =
  | 'contrato_servicios' | 'contrato_laboral' | 'contrato_obra' | 'adenda'
  | 'factura_compra' | 'factura_venta' | 'nota_credito' | 'nota_debito'
  | 'orden_compra_bienes' | 'orden_compra_servicios' | 'requerimiento'
  | 'memorando_interno' | 'memorando_multiple' | 'circular'
  | 'oficio_externo' | 'oficio_circular'
  | 'informe_tecnico' | 'informe_gestion' | 'acta'
  | 'resolucion_gerencial' | 'resolucion_directoral' | 'directiva'
  | 'convenio_marco' | 'convenio_especifico'
  | 'manual_procedimientos' | 'politica_interna' | 'procedimiento_operativo'
  | 'otros';

/** Ciclo de vida documental. Los ocho estados que promete el sistema. */
export type EstadoDocumental =
  | 'borrador'
  | 'en_revision'
  | 'pendiente_aprobacion'
  | 'aprobado'
  | 'observado'
  | 'rechazado'
  | 'archivado'
  | 'vencido';

/** Area emisora. Alimenta el segmento central del codigo documental. */
export type AreaEmisora =
  | 'gerencia'
  | 'administracion'
  | 'legal'
  | 'finanzas'
  | 'recursos_humanos'
  | 'operaciones'
  | 'tecnologia'
  | 'otros';

export type Confidencialidad = 'publico' | 'interno' | 'confidencial' | 'restringido';

export const ESTADOS_DOCUMENTALES: Record<EstadoDocumental, {
  label: string;
  icon: string;
  token: string;
  descripcion: string;
}> = {
  borrador:             { label: 'Borrador',      icon: 'file-pen',      token: 'var(--estado-borrador)',     descripcion: 'En elaboracion, aun no enviado a revision' },
  en_revision:          { label: 'En revision',   icon: 'file-search',   token: 'var(--estado-en-revision)',  descripcion: 'El area responsable lo esta revisando' },
  pendiente_aprobacion: { label: 'Por aprobar',   icon: 'clock',         token: 'var(--estado-pendiente)',    descripcion: 'Esperando el visto bueno de quien aprueba' },
  aprobado:             { label: 'Aprobado',      icon: 'file-check',    token: 'var(--estado-aprobado)',     descripcion: 'Vigente y en uso' },
  observado:            { label: 'Observado',     icon: 'file-warning',  token: 'var(--estado-observado)',    descripcion: 'Requiere correcciones antes de aprobarse' },
  rechazado:            { label: 'Rechazado',     icon: 'file-x',        token: 'var(--estado-rechazado)',    descripcion: 'Devuelto para reelaborar' },
  archivado:            { label: 'Archivado',     icon: 'archive',       token: 'var(--estado-archivado)',    descripcion: 'Fuera del acervo activo, consultable' },
  vencido:              { label: 'Vencido',       icon: 'calendar-x',    token: 'var(--estado-vencido)',      descripcion: 'Paso su fecha de vigencia sin renovarse' }
};

export const AREAS_EMISORAS: Record<AreaEmisora, { label: string; siglas: string }> = {
  gerencia:         { label: 'Gerencia',          siglas: 'GER' },
  administracion:   { label: 'Administracion',    siglas: 'ADM' },
  legal:            { label: 'Legal',             siglas: 'LEG' },
  finanzas:         { label: 'Finanzas',          siglas: 'FIN' },
  recursos_humanos: { label: 'Recursos Humanos',  siglas: 'RRHH' },
  operaciones:      { label: 'Operaciones',       siglas: 'OPE' },
  tecnologia:       { label: 'Tecnologia',        siglas: 'TIC' },
  otros:            { label: 'Otras areas',       siglas: 'GEN' }
};

export const NIVELES_CONFIDENCIALIDAD: Record<Confidencialidad, { label: string; icon: string }> = {
  publico:      { label: 'Publico',      icon: 'globe' },
  interno:      { label: 'Interno',      icon: 'building-2' },
  confidencial: { label: 'Confidencial', icon: 'lock' },
  restringido:  { label: 'Restringido',  icon: 'shield-alert' }
};

/**
 * Transiciones permitidas del ciclo de vida.
 * Sin esta tabla cualquier estado podia saltar a cualquier otro.
 */
export const TRANSICIONES: Record<EstadoDocumental, EstadoDocumental[]> = {
  borrador:             ['en_revision', 'archivado'],
  en_revision:          ['pendiente_aprobacion', 'observado', 'borrador'],
  pendiente_aprobacion: ['aprobado', 'observado', 'rechazado'],
  aprobado:             ['vencido', 'archivado', 'en_revision'],
  observado:            ['en_revision', 'archivado'],
  rechazado:            ['borrador', 'archivado'],
  vencido:              ['en_revision', 'archivado'],
  archivado:            []
};

export function puedeTransicionar(desde: EstadoDocumental, hasta: EstadoDocumental): boolean {
  return TRANSICIONES[desde]?.includes(hasta) ?? false;
}

export type FrecuenciaRenovacion =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'variable';

export type ReglaMensual =
  | { kind: 'day'; day: number }           // día 5, día 15, día 30
  | { kind: 'last_day' }                   // último día del mes
  | { kind: 'first_weekday'; weekday: number }; // primer lunes, primer viernes

export interface ReglaRenovacion {
  frequency: FrecuenciaRenovacion;
  startDate: string;                       // Fecha de inicio obligatoria (YYYY-MM-DD)
  // Semanal
  weeklyDays?: number[];                   // [1,3,5] = lunes, miércoles, viernes
  // Quincenal
  biweeklyMode?: 'two_dates' | 'every_15'; // dos días del mes vs cada 15 días
  biweeklyDates?: [number, number];        // [10, 25] – dos días fijos
  // Mensual y superiores
  monthlyRule?: ReglaMensual;
  // Anual
  annualMonth?: number;                    // 0 = enero, 1 = febrero, ... 11 = diciembre
  annualDay?: number;                      // 15
  // Variable / puntual
  endDate?: string | null;                 // Fecha final opcional
}

export interface Documento {
  id: string;
  userId: string;

  // Identificacion
  codigo: string;                  // CON-LEG-0001
  titulo: string;
  descripcion?: string;
  version: number;

  // Clasificacion
  category: CategoriaDocumental;
  type: TipoDocumental;
  area: AreaEmisora;
  confidencialidad: Confidencialidad;

  // Ciclo de vida
  estado: EstadoDocumental;
  motivoEstado?: string;           // Obligatorio al observar o rechazar
  fechaAprobacion?: string;        // Alimenta el tiempo promedio de aprobacion
  fechaEnvioRevision?: string;

  // Responsables
  responsable: string;
  elaboradoPor?: string;
  revisadoPor?: string;
  aprobadoPor?: string;

  /** Codigo de otro documento del que este deriva o al que responde. */
  documentoReferencia?: string;

  // Extension y peso
  /** Numero de folios: lo que se cuenta de un documento. */
  folios: number;
  /** Peso del archivo adjunto. Se calcula solo, no se pide. */
  tamanioMb: number;

  // Vigencia y renovacion
  renovacion: ReglaRenovacion;
  proximasRenovaciones: string[];
  fechaUltimaVersion?: string;
  vencimiento: {
    fechaVencimiento: string | null;
    diasParaVencer: number | null;
    estaVencido: boolean;
    renovacionesOmitidas: number;
    periodosOmitidos: string[];
  };
  alertarDiasAntes?: number | null;
  generarRegistroAuto?: boolean;

  activo: boolean;                 // false = archivado
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Una version concreta del documento, con su historial. */
export interface VersionDocumento {
  numero: number;
  fechaEmision: string;
  tamanioMb: number;
  resumenCambio: string;
  elaboradoPor?: string;
  aprobadoPor?: string;
  esVigente: boolean;
}


export interface DocumentoPayload {
  titulo: string;
  descripcion?: string;
  category: CategoriaDocumental;
  type: TipoDocumental;
  area: AreaEmisora;
  confidencialidad: Confidencialidad;
  responsable: string;
  folios: number;
  tamanioMb?: number;
  documentoReferencia?: string;
  renovacion: ReglaRenovacion;
  alertarDiasAntes?: number | null;
  notes?: string;
}


export interface DocumentosPeriodo {
  periodoId: string;
  year: number;
  month: number;
  byCategory: Record<CategoriaDocumental, number>;
  totalBudgeted: number;
  totalReceived: number;
  totalPending: number;
  receivedPercentage: number;
  sources: DocumentoPeriodo[];
  predictions: {
    nextPaymentDate: string | null;
    nextPaymentAmount: number;
    expectedEndOfMonth: number;
  };
  initialBalance: number;
  availableNow: number;
  lastUpdated: string;
}

export interface DocumentoPeriodo {
  documentoId: string;
  name: string;
  category: CategoriaDocumental;
  type: TipoDocumental;
  budgeted: number;
  received: number;
  expectedDate: string | null;
  receivedDate?: string | null;
  status: 'pending' | 'received' | 'overdue' | 'upcoming' | 'scheduled';
  daysUntilPayment: number | null;
}



// ============================================
// MAPAS DE CATEGORÍAS Y TIPOS
// ============================================

export const CATEGORIAS_DOCUMENTALES: Record<CategoriaDocumental, { label: string; icon: string; description: string }> = {
  contrato:      { label: 'Contratos', icon: 'file-signature', description: 'Contratos, adendas y acuerdos con terceros' },
  factura:       { label: 'Facturas', icon: 'receipt', description: 'Comprobantes de compra y venta' },
  orden_compra:  { label: 'Ordenes de Compra', icon: 'shopping-bag', description: 'Requerimientos y ordenes a proveedores' },
  memorando:     { label: 'Memorandos', icon: 'mail', description: 'Comunicacion interna entre areas' },
  oficio:        { label: 'Oficios', icon: 'send', description: 'Comunicacion oficial con entidades externas' },
  informe:       { label: 'Informes', icon: 'file-text', description: 'Informes tecnicos, de gestion y actas' },
  resolucion:    { label: 'Resoluciones', icon: 'gavel', description: 'Resoluciones y directivas de la direccion' },
  convenio:      { label: 'Convenios', icon: 'handshake', description: 'Convenios marco y especificos' },
  manual:        { label: 'Manuales', icon: 'book-open', description: 'Manuales de organizacion y procedimientos' },
  politica:      { label: 'Politicas', icon: 'shield-check', description: 'Politicas internas de la empresa' },
  procedimiento: { label: 'Procedimientos', icon: 'list-checks', description: 'Procedimientos operativos documentados' },
  otros:         { label: 'Otros', icon: 'folder', description: 'Documentos no clasificados en las categorias anteriores' }
};

export const TIPOS_DOCUMENTALES: Record<TipoDocumental, {
  label: string;
  category: CategoriaDocumental;
  icon: string;
  description: string;
  typicalFrequency: FrecuenciaRenovacion;
  esRapido?: boolean; // true = documento puntual, sin ciclo de renovacion
}> = {
  contrato_servicios: { label: 'Contrato de Servicios', category: 'contrato', icon: 'file-signature', description: 'Prestacion de servicios por terceros', typicalFrequency: 'annual' },
  contrato_laboral:   { label: 'Contrato Laboral', category: 'contrato', icon: 'user-check', description: 'Vinculo laboral con personal', typicalFrequency: 'annual' },
  contrato_obra:      { label: 'Contrato de Obra', category: 'contrato', icon: 'hard-hat', description: 'Ejecucion de obra determinada', typicalFrequency: 'variable' },
  adenda:             { label: 'Adenda', category: 'contrato', icon: 'file-plus', description: 'Modificacion de un contrato vigente', typicalFrequency: 'variable', esRapido: true },

  factura_compra: { label: 'Factura de Compra', category: 'factura', icon: 'receipt', description: 'Comprobante emitido por un proveedor', typicalFrequency: 'monthly', esRapido: true },
  factura_venta:  { label: 'Factura de Venta', category: 'factura', icon: 'receipt', description: 'Comprobante emitido a un cliente', typicalFrequency: 'monthly', esRapido: true },
  nota_credito:   { label: 'Nota de Credito', category: 'factura', icon: 'file-minus', description: 'Anulacion o descuento sobre una factura', typicalFrequency: 'variable', esRapido: true },
  nota_debito:    { label: 'Nota de Debito', category: 'factura', icon: 'file-plus', description: 'Cargo adicional sobre una factura', typicalFrequency: 'variable', esRapido: true },

  orden_compra_bienes:    { label: 'Orden de Compra de Bienes', category: 'orden_compra', icon: 'package', description: 'Adquisicion de bienes', typicalFrequency: 'monthly', esRapido: true },
  orden_compra_servicios: { label: 'Orden de Servicio', category: 'orden_compra', icon: 'wrench', description: 'Contratacion puntual de servicios', typicalFrequency: 'monthly', esRapido: true },
  requerimiento:          { label: 'Requerimiento', category: 'orden_compra', icon: 'clipboard-list', description: 'Solicitud interna de compra', typicalFrequency: 'monthly', esRapido: true },

  memorando_interno: { label: 'Memorando Interno', category: 'memorando', icon: 'mail', description: 'Comunicacion dirigida a un area', typicalFrequency: 'variable', esRapido: true },
  memorando_multiple:{ label: 'Memorando Multiple', category: 'memorando', icon: 'mails', description: 'Comunicacion dirigida a varias areas', typicalFrequency: 'variable', esRapido: true },
  circular:          { label: 'Circular', category: 'memorando', icon: 'megaphone', description: 'Comunicacion general a toda la empresa', typicalFrequency: 'variable', esRapido: true },

  oficio_externo:  { label: 'Oficio Externo', category: 'oficio', icon: 'send', description: 'Comunicacion oficial a una entidad externa', typicalFrequency: 'variable', esRapido: true },
  oficio_circular: { label: 'Oficio Circular', category: 'oficio', icon: 'send-horizontal', description: 'Oficio dirigido a varios destinatarios', typicalFrequency: 'variable', esRapido: true },

  informe_tecnico: { label: 'Informe Tecnico', category: 'informe', icon: 'file-text', description: 'Sustento tecnico de una decision', typicalFrequency: 'variable' },
  informe_gestion: { label: 'Informe de Gestion', category: 'informe', icon: 'chart-bar-increasing', description: 'Reporte periodico de resultados', typicalFrequency: 'monthly' },
  acta:            { label: 'Acta', category: 'informe', icon: 'clipboard-check', description: 'Registro de acuerdos de una reunion', typicalFrequency: 'variable', esRapido: true },

  resolucion_gerencial: { label: 'Resolucion Gerencial', category: 'resolucion', icon: 'gavel', description: 'Decision formal de la gerencia', typicalFrequency: 'variable' },
  resolucion_directoral:{ label: 'Resolucion Directoral', category: 'resolucion', icon: 'gavel', description: 'Decision formal del directorio', typicalFrequency: 'variable' },
  directiva:            { label: 'Directiva', category: 'resolucion', icon: 'scroll-text', description: 'Norma interna de cumplimiento obligatorio', typicalFrequency: 'annual' },

  convenio_marco:      { label: 'Convenio Marco', category: 'convenio', icon: 'handshake', description: 'Acuerdo general de cooperacion', typicalFrequency: 'annual' },
  convenio_especifico: { label: 'Convenio Especifico', category: 'convenio', icon: 'handshake', description: 'Acuerdo para una actividad concreta', typicalFrequency: 'annual' },

  manual_procedimientos: { label: 'Manual de Procedimientos', category: 'manual', icon: 'book-open', description: 'Manual con los procesos del area', typicalFrequency: 'annual' },
  politica_interna:      { label: 'Politica Interna', category: 'politica', icon: 'shield-check', description: 'Politica aprobada por la direccion', typicalFrequency: 'annual' },
  procedimiento_operativo:{ label: 'Procedimiento Operativo', category: 'procedimiento', icon: 'list-checks', description: 'Procedimiento documentado y vigente', typicalFrequency: 'annual' },

  otros: { label: 'Otros', category: 'otros', icon: 'folder', description: 'Documento no clasificado', typicalFrequency: 'variable', esRapido: true }
};

// Helpers
export function getTiposPorCategoria(category: CategoriaDocumental): TipoDocumental[] {
  return (Object.keys(TIPOS_DOCUMENTALES) as TipoDocumental[]).filter(t => TIPOS_DOCUMENTALES[t].category === category);
}
export function getEtiquetaCategoria(c: CategoriaDocumental): string { return CATEGORIAS_DOCUMENTALES[c]?.label || c; }
export function getEtiquetaTipo(t: TipoDocumental): string { return TIPOS_DOCUMENTALES[t]?.label || t; }
export function getIconoTipo(t: TipoDocumental): string { return TIPOS_DOCUMENTALES[t]?.icon || 'file-text'; }
export function getInfoTipo(t: TipoDocumental) { return TIPOS_DOCUMENTALES[t]; }
export function esTipoRapido(t: TipoDocumental): boolean { return !!TIPOS_DOCUMENTALES[t]?.esRapido; }

// ============================================
// MOTOR DE RECURRENCIA INTELIGENTE
// ============================================

/** Devuelve el último día válido de un mes/año */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Ajusta un día solicitado si excede los días del mes */
function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, lastDayOfMonth(year, month));
}

/** Primer día de la semana (0=domingo) en un mes/año */
function firstWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const d = new Date(year, month, 1);
  let daysToAdd = (weekday - d.getDay() + 7) % 7;
  if (daysToAdd < 0) daysToAdd += 7;
  d.setDate(1 + daysToAdd);
  return d;
}

/** Calcula la siguiente ocurrencia a partir de una fecha base */
/**
 * Fecha objetivo dentro de un mes concreto segun la regla mensual.
 * Se usa tanto para comprobar el mes en curso como el mes destino.
 */
function fechaObjetivoDelMes(
  year: number,
  month: number,
  rule: ReglaRenovacion,
  monthlyRule: ReglaMensual | undefined
): Date {
  const d = new Date(year, month, 1, 12, 0, 0, 0);

  if (monthlyRule?.kind === 'day') {
    d.setDate(clampDay(year, month, monthlyRule.day));
  } else if (monthlyRule?.kind === 'last_day') {
    d.setDate(lastDayOfMonth(year, month));
  } else if (monthlyRule?.kind === 'first_weekday') {
    return firstWeekdayOfMonth(year, month, monthlyRule.weekday);
  } else {
    const originalDay = new Date(rule.startDate).getDate();
    d.setDate(clampDay(year, month, originalDay));
  }

  return d;
}

export function proximaOcurrencia(rule: ReglaRenovacion, from: Date): Date | null {
  const { frequency, monthlyRule, weeklyDays, biweeklyMode, biweeklyDates, annualMonth, annualDay } = rule;
  const result = new Date(from);

  switch (frequency) {
    case 'weekly': {
      if (!weeklyDays?.length) return null;
      const currentWeekday = result.getDay();
      const nextDay = weeklyDays.find(d => d > currentWeekday) ?? weeklyDays[0];
      const daysToAdd = nextDay > currentWeekday
        ? nextDay - currentWeekday
        : (7 - currentWeekday) + nextDay;
      result.setDate(result.getDate() + daysToAdd);
      return result;
    }

    case 'biweekly': {
      if (biweeklyMode === 'two_dates' && biweeklyDates?.length === 2) {
        const [d1, d2] = biweeklyDates;
        const currentDay = result.getDate();
        const year = result.getFullYear();
        const month = result.getMonth();
        if (currentDay < d1) {
          result.setDate(clampDay(year, month, d1));
        } else if (currentDay < d2) {
          result.setDate(clampDay(year, month, d2));
        } else {
          result.setMonth(month + 1);
          result.setDate(clampDay(result.getFullYear(), result.getMonth(), d1));
        }
        return result;
      }
      // every_15: cada 15 días desde startDate
      result.setDate(result.getDate() + 14);
      return result;
    }

    case 'monthly':
    case 'bimonthly':
    case 'quarterly':
    case 'semi_annual': {
      const interval =
        frequency === 'monthly' ? 1 :
        frequency === 'bimonthly' ? 2 :
        frequency === 'quarterly' ? 3 : 6;

      // El mes en curso puede tener todavia pendiente su fecha objetivo.
      // Avanzar siempre saltaba la renovacion inminente y, con ella, su
      // alerta de vencimiento: un documento a 5 dias se informaba a 36.
      // Solo aplica a la frecuencia mensual, la unica en la que el mes en
      // curso pertenece siempre al ciclo.
      if (interval === 1) {
        const enCurso = fechaObjetivoDelMes(result.getFullYear(), result.getMonth(), rule, monthlyRule);
        if (enCurso.getTime() > result.getTime()) return enCurso;
      }

      let targetMonth = result.getMonth() + interval;
      let targetYear = result.getFullYear();
      while (targetMonth > 11) { targetMonth -= 12; targetYear++; }

      if (monthlyRule?.kind === 'day') {
        result.setFullYear(targetYear, targetMonth, clampDay(targetYear, targetMonth, monthlyRule.day));
      } else if (monthlyRule?.kind === 'last_day') {
        result.setFullYear(targetYear, targetMonth, lastDayOfMonth(targetYear, targetMonth));
      } else if (monthlyRule?.kind === 'first_weekday') {
        const d = firstWeekdayOfMonth(targetYear, targetMonth, monthlyRule.weekday);
        result.setTime(d.getTime());
      } else {
        // fallback: mismo día del mes
        const originalDay = new Date(rule.startDate).getDate();
        result.setFullYear(targetYear, targetMonth, clampDay(targetYear, targetMonth, originalDay));
      }
      return result;
    }

    case 'annual': {
      const start = new Date(rule.startDate);
      const month = annualMonth ?? start.getMonth();
      const day = annualDay ?? start.getDate();
      let targetYear = result.getFullYear();
      const candidate = new Date(targetYear, month, day);
      if (candidate <= from) candidate.setFullYear(targetYear + 1);
      // Ajuste bisiesto: si el día es 29 de febrero y no es bisiesto, usar 28
      if (month === 1 && day === 29 && !isLeapYear(candidate.getFullYear())) {
        candidate.setDate(28);
      }
      return candidate;
    }

    case 'variable':
    default:
      return null;
  }
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/** Genera las próximas N ocurrencias */
function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function generarOcurrencias(rule: ReglaRenovacion | undefined | null, count = 6): string[] {
  if (!rule || rule.frequency === 'variable') return [];
  const results: string[] = [];
  let cursor = new Date(rule.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(rule.startDate);
  startDate.setHours(0, 0, 0, 0);
  if (cursor < today) cursor = today;

  if (startDate >= today && localIsoDate(startDate) !== localIsoDate(cursor)) {
    cursor = new Date(startDate);
  }

  if (startDate >= today) {
    results.push(localIsoDate(startDate));
    cursor = new Date(startDate);
    cursor.setDate(cursor.getDate() + 1);
  }

  let safety = 0;
  while (results.length < count && safety < 100) {
    safety++;
    const next = proximaOcurrencia(rule, cursor);
    if (!next) break;
    const iso = localIsoDate(next);
    if (!results.includes(iso)) results.push(iso);
    cursor = new Date(next);
    cursor.setDate(cursor.getDate() + 1);

    if (rule.endDate && iso > rule.endDate) break;
  }
  return results;
}

/** Calcula el estado de pago actual */
export function calcularEstadoDocumento(
  rule: ReglaRenovacion,
  nextDates: string[],
  fechaUltimaVersion?: string,
  alertarDiasAntes: number = 3
): Documento['vencimiento'] {
  // Documento puntual/variable: no tiene próximas fechas
  if (rule.frequency === 'variable') {
    return { fechaVencimiento: null, diasParaVencer: null, estaVencido: false, renovacionesOmitidas: 0, periodosOmitidos: [] };
  }

  if (nextDates.length === 0) {
    return { fechaVencimiento: null, diasParaVencer: null, estaVencido: false, renovacionesOmitidas: 0, periodosOmitidos: [] };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Buscar la primera fecha futura en el array
  let futureIndex = -1;
  for (let i = 0; i < nextDates.length; i++) {
    const d = new Date(nextDates[i]);
    d.setHours(0, 0, 0, 0);
    if (d >= today) { futureIndex = i; break; }
  }

  let renovacionesOmitidas = 0;
  let periodosOmitidos: string[] = [];
  let chosenDateStr: string | null = null;

  if (futureIndex >= 0) {
    chosenDateStr = nextDates[futureIndex];
    renovacionesOmitidas = futureIndex;
    for (let i = 0; i < futureIndex; i++) {
      const d = new Date(nextDates[i] + 'T12:00:00');
      periodosOmitidos.push(d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }));
    }
  } else {
    // Todos los nextDates son pasados — regenerar desde renovacion
    const newDates = generarOcurrencias(rule, 6);
    if (newDates.length > 0) {
      chosenDateStr = newDates[0];
      renovacionesOmitidas = nextDates.length;
      for (const dateStr of nextDates) {
        const d = new Date(dateStr + 'T12:00:00');
        periodosOmitidos.push(d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }));
      }
    }
  }

  if (!chosenDateStr) {
    return { fechaVencimiento: null, diasParaVencer: null, estaVencido: false, renovacionesOmitidas: 0, periodosOmitidos: [] };
  }

  const chosenDate = new Date(chosenDateStr);
  chosenDate.setHours(0, 0, 0, 0);

  const diffMs = chosenDate.getTime() - today.getTime();
  const diasParaVencer = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Si ya recibió esta ocurrencia
  if (fechaUltimaVersion && renovacionesOmitidas === 0) {
    const last = new Date(fechaUltimaVersion);
    last.setHours(0, 0, 0, 0);
    if (last >= chosenDate) {
      return { fechaVencimiento: chosenDateStr, diasParaVencer: null, estaVencido: false, renovacionesOmitidas: 0, periodosOmitidos: [] };
    }
  }

  // Si hay pagos perdidos pero ya estamos en fecha futura, status es upcoming/scheduled
  if (renovacionesOmitidas > 0) {
    if (diasParaVencer <= alertarDiasAntes && diasParaVencer >= 0) {
      return { fechaVencimiento: chosenDateStr, diasParaVencer, estaVencido: false, renovacionesOmitidas, periodosOmitidos };
    }
    return { fechaVencimiento: chosenDateStr, diasParaVencer, estaVencido: false, renovacionesOmitidas, periodosOmitidos };
  }

  if (diasParaVencer < 0) {
    return { fechaVencimiento: chosenDateStr, diasParaVencer, estaVencido: true, renovacionesOmitidas: 0, periodosOmitidos: [] };
  }
  if (diasParaVencer <= alertarDiasAntes && diasParaVencer >= 0) {
    return { fechaVencimiento: chosenDateStr, diasParaVencer, estaVencido: false, renovacionesOmitidas: 0, periodosOmitidos: [] };
  }
  return { fechaVencimiento: chosenDateStr, diasParaVencer, estaVencido: false, renovacionesOmitidas: 0, periodosOmitidos: [] };
}

/** Detecta patrones simples a partir de fechas históricas */
export function detectarPatron(dates: string[]): { frequency: FrecuenciaRenovacion | null; confidence: number } {
  if (dates.length < 2) return { frequency: null, confidence: 0 };
  const sorted = dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.round((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24)));
  }
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((sum, g) => sum + Math.abs(g - avg), 0) / gaps.length;

  if (variance <= 2) {
    if (avg >= 13 && avg <= 17) return { frequency: 'biweekly', confidence: 0.9 };
    if (avg >= 27 && avg <= 31) return { frequency: 'monthly', confidence: 0.9 };
    if (avg >= 6 && avg <= 8) return { frequency: 'weekly', confidence: 0.9 };
    if (avg >= 58 && avg <= 62) return { frequency: 'bimonthly', confidence: 0.85 };
    if (avg >= 88 && avg <= 94) return { frequency: 'quarterly', confidence: 0.85 };
    if (avg >= 178 && avg <= 184) return { frequency: 'semi_annual', confidence: 0.85 };
    if (avg >= 360 && avg <= 370) return { frequency: 'annual', confidence: 0.85 };
  }
  return { frequency: null, confidence: 0 };
}

/** Predice cantidads futuros para dashboards */
export function proyectarRenovaciones(
  sources: Array<{ amount: number; renovacion: ReglaRenovacion; proximasRenovaciones: string[] }>,
  monthsAhead = 3
): Array<{ month: string; year: number; monthNum: number; predicted: number }> {
  const results: Array<{ month: string; year: number; monthNum: number; predicted: number }> = [];
  const now = new Date();

  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const monthNum = d.getMonth() + 1;
    const monthLabel = d.toLocaleDateString('es-PE', { month: 'long' });

    let predicted = 0;
    for (const src of sources) {
      if (src.renovacion.frequency === 'variable') continue;
      const hasOccurrenceInMonth = src.proximasRenovaciones.some(dateStr => {
        const date = new Date(dateStr);
        return date.getFullYear() === year && date.getMonth() + 1 === monthNum;
      });
      if (hasOccurrenceInMonth) predicted += src.amount;
    }

    results.push({ month: monthLabel, year, monthNum, predicted });
  }

  return results;
}

// ============================================
// HISTORIAL PERMANENTE DE MOVIMIENTOS
// ============================================

export interface EntradaBitacora {
  id: string;
  documentoId: string;
  sourceName: string;
  type: 'transfer' | 'deletion' | 'reactivation';
  amount: number;
  date: string;       // Fecha local: "2026-05-24"
  time: string;       // Hora local: "15:45"
  category: string;
  description: string;
}


// ============================================
// CODIFICACION DOCUMENTAL
// ============================================

const PREFIJO_CATEGORIA: Record<CategoriaDocumental, string> = {
  contrato: 'CON', factura: 'FAC', orden_compra: 'OCP', memorando: 'MEM',
  oficio: 'OFI', informe: 'INF', resolucion: 'RES', convenio: 'CNV',
  manual: 'MAN', politica: 'POL', procedimiento: 'PRO', otros: 'DOC'
};

/** Formato normalizado CAT-AREA-CORRELATIVO, p. ej. CON-LEG-0001. */
export function generarCodigo(
  category: CategoriaDocumental,
  area: AreaEmisora,
  correlativo: number
): string {
  const cat = PREFIJO_CATEGORIA[category] ?? 'DOC';
  const ar  = AREAS_EMISORAS[area]?.siglas ?? 'GEN';
  return `${cat}-${ar}-${String(correlativo).padStart(4, '0')}`;
}

export function esCodigoValido(codigo: string): boolean {
  return /^[A-Z]{3}-[A-Z]{2,4}-\d{4}$/.test(codigo.trim().toUpperCase());
}

/**
 * Deriva el estado de vigencia a partir de las fechas.
 * No decide el estado del ciclo de vida: solo detecta el vencimiento,
 * que es la unica transicion que ocurre sin que nadie la provoque.
 */
export function calcularVigencia(doc: Pick<Documento, 'proximasRenovaciones' | 'estado'>): {
  fechaVencimiento: string | null;
  diasParaVencer: number | null;
  estaVencido: boolean;
} {
  const proxima = doc.proximasRenovaciones?.[0] ?? null;
  if (!proxima) return { fechaVencimiento: null, diasParaVencer: null, estaVencido: false };

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(proxima + 'T00:00:00');
  const dias = Math.round((vence.getTime() - hoy.getTime()) / 86400000);

  return {
    fechaVencimiento: proxima,
    diasParaVencer: dias,
    estaVencido: dias < 0 && doc.estado === 'aprobado'
  };
}
