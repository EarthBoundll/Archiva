import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { CuotaAlmacenamiento, CuotaPayload, ResumenAlmacenamiento, calcularEstadoCuota } from '../models/storage.model';
import { CATEGORIAS_DOCUMENTALES, type CategoriaDocumental } from '../models/document.model';

/**
 * Series documentales cuya conservacion exige la norma. Son las que se
 * marcan como prioritarias y avisan antes de agotar su cuota.
 */
const SERIES_EXIGIDAS: CategoriaDocumental[] = [
  'contrato', 'factura', 'resolucion', 'convenio', 'politica', 'procedimiento'
];

@Injectable({ providedIn: 'root' })
export class StorageService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  async getPorPeriodo(year: number, month: number): Promise<CuotaAlmacenamiento[]> {
    const userId = this.authService.getUserId();
    if (!userId) return [];

    const data = await this.firebase.getCuotasPorPeriodo(userId, year, month);
    return data as CuotaAlmacenamiento[];
  }

  async asignarCuota(payload: CuotaPayload): Promise<CuotaAlmacenamiento> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const result = await this.firebase.definirCuota(userId, payload);
    return result as CuotaAlmacenamiento;
  }

  async getResumenPeriodo(year: number, month: number): Promise<ResumenAlmacenamiento> {
    const userId = this.authService.getUserId();
    if (!userId) throw new Error('No autenticado');

    const data = await this.firebase.calcularResumenAlmacenamiento(userId, year, month);
    return data as ResumenAlmacenamiento;
  }

  /**
   * Reparte una capacidad total entre las categorias que ya tienen
   * documentos, en proporcion a lo que cada una ocupa.
   *
   * Antes aplicaba la regla 50/30/20 del presupuesto domestico sobre un
   * ingreso mensual, y leia el gasto por categoria de los movimientos con
   * importe negativo. Los registros de ARCHIVA no tienen importe, asi que
   * el reparto salia siempre vacio.
   *
   * Las series exigidas por norma reciben un suelo minimo aunque hoy pesen
   * poco: son las que no pueden quedarse sin espacio.
   */
  async autoDistribuirCuotas(capacidadTotalMb: number, year: number, month: number): Promise<number> {
    const userId = this.authService.getUserId();
    if (!userId || capacidadTotalMb <= 0) return 0;

    // No pisa un reparto ya hecho a mano.
    const existentes = await this.getPorPeriodo(year, month);
    if (existentes.length > 0) return 0;

    const ocupacion = await this.getOcupacionPorCategoria();
    const categorias = Object.keys(ocupacion);
    if (categorias.length === 0) return 0;

    const ocupadoTotal = categorias.reduce((s, c) => s + ocupacion[c], 0);

    // Suelo por serie exigida: un 5% de la capacidad, para que una categoria
    // recien estrenada no nazca con cuota cero.
    const suelo = capacidadTotalMb * 0.05;

    let creadas = 0;
    for (const category of categorias) {
      const esPrioritaria = this.isPrimordialCategory(category);
      const proporcional = ocupadoTotal > 0
        ? (ocupacion[category] / ocupadoTotal) * capacidadTotalMb
        : capacidadTotalMb / categorias.length;

      const asignado = esPrioritaria ? Math.max(proporcional, suelo) : proporcional;

      await this.asignarCuota({
        category,
        categoryName: this.getCategoryDisplayName(category),
        esPrioritaria,
        budgetedAmount: Math.round(asignado * 10) / 10,
        periodoId: `${year}-${String(month).padStart(2, '0')}`,
        year,
        month
      });
      creadas++;
    }

    return creadas;
  }

  /** Megabytes que ocupa hoy cada categoria del acervo. */
  async getOcupacionPorCategoria(): Promise<Record<string, number>> {
    const userId = this.authService.getUserId();
    if (!userId) return {};

    const docs = await this.firebase.getDocumentos(userId);
    const porCategoria: Record<string, number> = {};

    for (const d of docs as any[]) {
      const cat = d.category || 'otros';
      porCategoria[cat] = (porCategoria[cat] || 0) + (d.tamanioMb || 0);
    }

    return porCategoria;
  }

  /**
   * Series cuya conservacion exige la norma: quedarse sin espacio en ellas
   * tiene consecuencias legales, no solo molestia. Sustituye a la lista de
   * gastos primordiales del hogar.
   */
  private isPrimordialCategory(category: string): boolean {
    return SERIES_EXIGIDAS.includes(category as CategoriaDocumental);
  }

  /** El nombre visible sale del catalogo documental, no de una lista aparte. */
  private getCategoryDisplayName(category: string): string {
    return CATEGORIAS_DOCUMENTALES[category as CategoriaDocumental]?.label ?? category;
  }

  // Calculate how much budget remains
  async getEspacioDisponible(year: number, month: number): Promise<number> {
    const summary = await this.getResumenPeriodo(year, month);
    return summary.totalRemaining;
  }

  // Get categories that are at risk
  async getCategoriasEnAlerta(year: number, month: number): Promise<CuotaAlmacenamiento[]> {
    const budgets = await this.getPorPeriodo(year, month);
    return budgets.filter(b => b.status === 'at_risk' || b.status === 'exceeded');
  }
}