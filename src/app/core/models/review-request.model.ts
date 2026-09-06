// ============================================
// MODELO DE SOLICITUDES DE REVISION - ARCHIVA
// Sistema dual: solicitudes prioritarias vs. ordinarias
// ============================================

// Tipos de solicitud prioritaria (bloquean el avance del documento)
export type TipoSolicitudPrioritaria =
  | 'aprobacion_gerencial'      // Requiere visto bueno de gerencia
  | 'revision_legal'            // Revision del area legal
  | 'subsanacion_observacion'   // Corregir una observacion registrada
  | 'actualizacion_vencimiento' // Renovar un documento por vencer o vencido
  | 'validacion_firma'          // Falta firma del responsable
  | 'correccion_datos'          // Datos erroneos en la ficha del documento
  | 'reasignacion_responsable'; // Cambiar el responsable o el area custodia      // Educación (colegiatura, universidad)

// Tipos de solicitud ordinaria (no bloquean el avance)
export type TipoSolicitudOrdinaria =
  | 'revision_formato'      // Formato o plantilla incorrecta
  | 'revision_ortografica'  // Correccion de redaccion y ortografia
  | 'actualizacion_anexos'  // Adjuntar o reemplazar anexos
  | 'cambio_categoria'      // Reclasificar la categoria documental
  | 'solicitud_copia'       // Solicitud de copia controlada
  | 'digitalizacion'        // Digitalizar un documento fisico
  | 'reclasificacion'       // Cambiar la serie o el nivel de acceso
  | 'traslado_archivo'      // Trasladar al archivo historico
  | 'otros';                // Otras solicitudes          // Otros solicitudes varios

// ============================================
// CATEGORÍAS EXPANDIBLES (para futuro)
// ============================================

// Extendible: agregar más categorías aquí sin romper
export type TipoSolicitudPrioritariaExt =
  | TipoSolicitudPrioritaria
  | 'auditoria'             // Hallazgo de auditoria
  | 'cumplimiento_legal'    // Requerimiento normativo
  | 'seguridad_informacion' // Clasificacion o acceso indebido
  | 'custom_prioritaria';   // Personalizado  // Personalizado

export type TipoSolicitudOrdinariaExt =
  | TipoSolicitudOrdinaria
  | 'mejora_plantilla'    // Propuesta de mejora de plantilla
  | 'indexacion'          // Mejorar metadatos de busqueda
  | 'depuracion'          // Eliminar duplicados
  | 'custom_ordinaria';   // Personalizado // Personalizado

export type TipoSolicitud = TipoSolicitudPrioritaria | TipoSolicitudOrdinaria;

// Estados de pago
export type EstadoSolicitud = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';

// Frecuencia de solicitud
export type FrecuenciaSolicitud = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

// ============================================
// INTERFACE PRINCIPAL (EXTENSIBLE)
// ============================================

export interface SolicitudRevision {
  id: string;
  userId: string;
  
  // Clasificación principal
  esPrioritaria: boolean; // true = esencial, false = no esencial
  category: TipoSolicitud;
  subcategory?: string;  // Ej: "luz", "agua", "netflix"
  
  // Información básica
  name: string;           // "Netflix", "Alquiler", "Luz"
  provider?: string;      // "Netflix", "EDEGEL", "BCP"
  description?: string;
  
  // Cantidads
  budgetedAmount: number;  // Lo que planeas pagar
  actualAmount: number;    // Lo que realmente pagaste
  
  // Fechas
  diaLimiteMes: number | null;        // Día de vencimiento (ej: 15)
  fechaDisponible?: string;               // Fecha de inicio de ventana (YYYY-MM-DD)
  fechaLimite?: string;                     // Fecha de vencimiento completa (YYYY-MM-DD)
  diaOptimoAtencion?: number;           // Día óptimo para pagar (calculado)
  fechaAtencion?: string;                 // Fecha cuando se pagó
  startDate: string;                    // Desde cuándo aplica
  endDate?: string;                     // Hasta cuándo aplica (null = indefinido)
  
  // Estado
  status: EstadoSolicitud;
  isRecurring: boolean;
  frequency: FrecuenciaSolicitud;
  activo: boolean;
  
  // Registro asociada (cuando se marca como pagado)
  registroId?: string;
  
  // Para solicitudes reincidentes
  esReincidente?: boolean;
  prioridadSolicitud?: number;
  periodicidadSolicitud?: 'monthly' | 'yearly';
  prioridadAnterior?: number;
  cambioPrioridad?: boolean;
  
  // Para solicitudes variables
  isVariable?: boolean;        // Si el cantidad varía (ej: luz)
  averageAmount?: number;      // Promedio histórico
  lastMonthAmount?: number;    // Del mes anterior
  umbralAlerta?: number;     // % que activa alerta
  
  // ============================================
  // CAMPOS EXTENSIBLES (para futuro)
  // ============================================
  
  // Detalle del proveedor (extensible)
  providerDetails?: {
    accountNumber?: string;      // Número de cuenta
    contractNumber?: string;     // Número de contrato
    planType?: string;          // Tipo de plan (ej: "Premium", "Básico")
    billingCycle?: string;      // Ciclo de facturación
    contactPhone?: string;      // Teléfono de contacto
    website?: string;           // Web del proveedor
  };
  
  // Deudas específicas (extensible)
  debtDetails?: {
    debtType: 'personal' | 'credit_card' | 'car_loan' | 'mortgage' | 'student_loan' | 'friend' | 'other';
    creditorName: string;       // A quién debes
    interestRate?: number;      // Tasa de interés
    totalDebt?: number;         // Deuda total original
    remainingPayments?: number; // Cuotas restantes
    isConsolidated?: boolean;   // Si está consolidado
  };
  
  // Servicios detallados (extensible)
  serviceDetails?: {
    serviceType?: string;       // Tipo de servicio específico
    usage?: string;             // Consumo (kWh, m3, GB)
    previousReading?: number;   // Lectura anterior (para variables)
    currentReading?: number;    // Lectura actual
    tariffType?: string;       // Tipo de tarifa
  };
  
  // Tags personalizados (extensible)
  tags?: string[];
  
  // Metadatos adicionales (extensible - key-value)
  metadata?: Record<string, any>;
  
  // Notas estructuradas
  notes?: string;
  
  // ============================================
  // Para sincronización y versionado
  // ============================================
  version?: number;
  lastSyncedAt?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// ============================================
// PAYLOAD PARA CREAR/ACTUALIZAR
// ============================================

export interface SolicitudRevisionPayload {
  esPrioritaria: boolean;
  category: TipoSolicitud;
  subcategory?: string;
  name: string;
  provider?: string;
  description?: string;
  budgetedAmount: number;
  diaLimiteMes: number | null;
  fechaDisponible?: string;
  fechaLimite?: string;
  isRecurring: boolean;
  frequency: FrecuenciaSolicitud;
  esReincidente?: boolean;
  prioridadSolicitud?: number;
  isVariable?: boolean;
  umbralAlerta?: number;
  metadata?: Record<string, any>;
  notes?: string;
}

// ============================================
// MONTHLY EXPENSE SUMMARY
// ============================================

export interface ResumenSolicitudes {
  periodoId: string;
  
  // Totals presupuestados
  totalBudgeted: number;
  totalActual: number;
  
  // Primordiales
  primordialBudgeted: number;
  primordialActual: number;
  primordialCount: number;
  
  // No primordiales  
  nonPrimordialBudgeted: number;
  nonPrimordialActual: number;
  nonPrimordialCount: number;
  
  // Por categoría
  byCategory: {
    category: TipoSolicitud;
    name: string;
    budgeted: number;
    actual: number;
    status: EstadoSolicitud;
  }[];
  
  // Próximos pagos
  upcomingPayments: {
    solicitudId: string;
    name: string;
    amount: number;
    fechaLimite: number;
    isOverdue: boolean;
  }[];
  
  // Alertas
  alerts: {
    type: 'overdue' | 'budget_exceeded' | 'price_change' | 'variable_spike';
    solicitudId: string;
    message: string;
  }[];
  
  lastUpdated: string;
}

// ============================================
// CATEGORÍAS PREDEFINIDAS
// ============================================

export const TIPOS_PRIORITARIOS: Record<TipoSolicitudPrioritaria, { name: string; icon: string }> = {
  aprobacion_gerencial:      { name: 'Aprobacion gerencial', icon: 'stamp' },
  revision_legal:            { name: 'Revision legal', icon: 'scale' },
  subsanacion_observacion:   { name: 'Subsanar observacion', icon: 'file-warning' },
  actualizacion_vencimiento: { name: 'Actualizar por vencimiento', icon: 'calendar-clock' },
  validacion_firma:          { name: 'Validar firma', icon: 'pen-line' },
  correccion_datos:          { name: 'Corregir datos', icon: 'file-pen' },
  reasignacion_responsable:  { name: 'Reasignar responsable', icon: 'user-cog' }
};

export const TIPOS_ORDINARIOS: Record<TipoSolicitudOrdinaria, { name: string; icon: string }> = {
  revision_formato:     { name: 'Revision de formato', icon: 'layout-template' },
  revision_ortografica: { name: 'Revision ortografica', icon: 'spell-check' },
  actualizacion_anexos: { name: 'Actualizar anexos', icon: 'paperclip' },
  cambio_categoria:     { name: 'Cambio de categoria', icon: 'folder-symlink' },
  solicitud_copia:      { name: 'Solicitud de copia', icon: 'copy' },
  digitalizacion:       { name: 'Digitalizacion', icon: 'scan' },
  reclasificacion:      { name: 'Reclasificacion', icon: 'folder-tree' },
  traslado_archivo:     { name: 'Traslado a archivo', icon: 'archive' },
  otros:                { name: 'Otros', icon: 'file-question' }
};

// ============================================
// SUBCATEGORÍAS PREDEFINIDAS POR CATEGORÍA
// ============================================

export const DETALLES_POR_TIPO: Record<string, string[]> = {
  // Prioritarias
  aprobacion_gerencial:      ['Visto bueno gerencia', 'Aprobacion directorio', 'Autorizacion de solicitud'],
  revision_legal:            ['Clausulas', 'Vigencia', 'Partes intervinientes', 'Penalidades'],
  subsanacion_observacion:   ['Contenido', 'Anexos', 'Firmas', 'Fechas'],
  actualizacion_vencimiento: ['Renovacion anual', 'Prorroga', 'Nueva version'],
  validacion_firma:          ['Firma responsable', 'Firma gerencia', 'Firma contraparte'],
  correccion_datos:          ['Codigo', 'Titulo', 'Area', 'Responsable', 'Fechas'],
  reasignacion_responsable:  ['Cambio de area', 'Cambio de custodio', 'Cese de personal'],
  // Ordinarias
  revision_formato:     ['Plantilla', 'Membrete', 'Numeracion', 'Margenes'],
  revision_ortografica: ['Ortografia', 'Redaccion', 'Terminologia'],
  actualizacion_anexos: ['Agregar anexo', 'Reemplazar anexo', 'Retirar anexo'],
  cambio_categoria:     ['Recategorizar', 'Cambiar tipo documental'],
  solicitud_copia:      ['Copia controlada', 'Copia informativa', 'Copia certificada'],
  digitalizacion:       ['Escaneo', 'Indexado', 'Control de calidad'],
  reclasificacion:      ['Nivel de acceso', 'Serie documental', 'Retencion'],
  traslado_archivo:     ['Archivo pasivo', 'Archivo historico', 'Custodia externa'],
  otros:                ['Otro']
};

// Helper para obtener todas las categorías
export function getAllTiposSolicitud() {
  return {
    ...TIPOS_PRIORITARIOS,
    ...TIPOS_ORDINARIOS
  };
}

// ============================================
// CÁLCULOS DE ESTADO
// ============================================

export function calcularEstadoSolicitud(
  diaLimiteMes: number | null,
  actualAmount: number,
  budgetedAmount: number,
  fechaAtencion?: string
): EstadoSolicitud {
  const today = new Date();
  const currentDay = today.getDate();
  
  // Si tiene fecha de pago, está pagado
  if (fechaAtencion) {
    return 'paid';
  }
  
  // Si no hay día de vencimiento, está pendiente
  if (!diaLimiteMes) {
    return actualAmount > 0 ? 'partial' : 'pending';
  }
  
  // Si ya pasó la fecha y no hay pago, overdue
  if (currentDay > diaLimiteMes && actualAmount === 0) {
    return 'overdue';
  }
  
  // Si hay pago parcial
  if (actualAmount > 0 && actualAmount < budgetedAmount) {
    return 'partial';
  }
  
  // Si hay pago completo
  if (actualAmount >= budgetedAmount) {
    return 'paid';
  }
  
  // Pendiente
  return 'pending';
}

export function calcularDiaOptimoAtencion(
  incomeDay: number,
  dueDay: number
): number {
  // Si el ingreso viene antes del vencimiento, pagar el día del ingreso
  if (incomeDay <= dueDay) {
    return incomeDay;
  }
  // Si el ingreso viene después, pagar el día anterior al vencimiento
  return Math.max(1, dueDay - 3);
}