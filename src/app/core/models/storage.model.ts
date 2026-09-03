// ============================================
// BUDGET MODEL - Cuota por Categoría
// ============================================

import { TipoSolicitud } from './review-request.model';

export type EstadoCuota = 'on_track' | 'at_risk' | 'exceeded' | 'unused';

export interface CuotaAlmacenamiento {
  id: string;
  userId: string;
  
  // Categoría
  category: string;
  categoryName: string;
  esPrioritaria: boolean;
  
  // Cantidads
  budgetedAmount: number;    // Lo que planeas gastar
  actualAmount: number;      // Lo que realmente gastaste
  disponibleMb: number;   // Restante (budgeted - actual)
  
  // Porcentaje
  porcentajeUso: number;    // % usado
  status: EstadoCuota;
  
  // Configuración
  umbralAlerta: number;     // % que activa alerta (default: 80)
  activo: boolean;
  
  // Mes
  periodoId: string;           // "2026-05"
  year: number;
  month: number;
  
  // Historial
  history: HistorialCuota[];
  
  // Notas
  notes?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface HistorialCuota {
  date: string;
  actualAmount: number;
  percentage: number;
}

export interface CuotaPayload {
  category: string;
  categoryName: string;
  esPrioritaria: boolean;
  budgetedAmount: number;
  umbralAlerta?: number;
  periodoId: string;
  year: number;
  month: number;
  notes?: string;
}

// ============================================
// MONTHLY BUDGET SUMMARY
// ============================================

export interface ResumenAlmacenamiento {
  periodoId: string;
  
  // Totales
  totalBudgeted: number;
  totalActual: number;
  totalRemaining: number;
  overallPercentage: number;
  overallStatus: EstadoCuota;
  
  // Por tipo
  primordialBudgeted: number;
  primordialActual: number;
  nonPrimordialBudgeted: number;
  nonPrimordialActual: number;
  
  // Por categoría
  budgets: CuotaAlmacenamiento[];
  
  // Alertas
  alerts: {
    category: string;
    name: string;
    budgeted: number;
    actual: number;
    percentage: number;
    status: EstadoCuota;
  }[];
  
  lastUpdated: string;
}

// ============================================
// CÁLCULOS
// ============================================

export function calcularEstadoCuota(
  porcentajeUso: number,
  umbralAlerta: number = 80
): EstadoCuota {
  if (porcentajeUso >= 100) return 'exceeded';
  if (porcentajeUso >= umbralAlerta) return 'at_risk';
  if (porcentajeUso === 0) return 'unused';
  return 'on_track';
}

export function calcularDisponible(budgeted: number, actual: number): number {
  return Math.max(0, budgeted - actual);
}

export function calcularPorcentaje(budgeted: number, actual: number): number {
  if (budgeted <= 0) return 0;
  return Math.round((actual / budgeted) * 100);
}