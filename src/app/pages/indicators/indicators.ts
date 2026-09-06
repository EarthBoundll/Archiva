import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryService } from '../../core/services/history';
import { DocumentService } from '../../core/services/document';
import { CATEGORIAS_DOCUMENTALES, CategoriaDocumental } from '../../core/models/document.model';
import { RegistroHistorial } from '../../core/models/history.model';

interface Observacion {
  title: string;
  description: string;
  type: 'warning' | 'positive' | 'info';
}

/** Un punto de la serie: un mes con su recuento de movimientos. */
interface PuntoSerie {
  etiqueta: string;
  valor: number;
}

/** Variacion de una magnitud respecto al periodo anterior. */
interface Comparacion {
  label: string;
  actual: number;
  anterior: number;
  variacion: number | null;   // null = no hay base con la que comparar
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

@Component({
  selector: 'app-indicadores',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './indicators.html',
  styleUrl: './indicators.scss'
})
export class IndicatorsComponent implements OnInit {
  private historyService  = inject(HistoryService);
  private documentService = inject(DocumentService);

  /** Mes en curso o los ultimos doce meses. */
  periodo = signal<'mes' | 'anio'>('mes');
  cargando = signal(true);

  /** Bitacora completa; el periodo se recorta en memoria. */
  private bitacora = signal<RegistroHistorial[]>([]);

  now = new Date();
  currentMonth = this.now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  // ------------------------------------------
  // RECORTE POR PERIODO
  // ------------------------------------------

  /** Registros del periodo seleccionado. */
  private delPeriodo = computed<RegistroHistorial[]>(() => {
    const desde = this.inicioDelPeriodo();
    return this.bitacora().filter(r => r.date >= desde);
  });

  /** Registros del periodo inmediatamente anterior, del mismo tamano. */
  private delPeriodoPrevio = computed<RegistroHistorial[]>(() => {
    const desde = this.inicioDelPeriodo();
    const previo = this.inicioDelPeriodoPrevio();
    return this.bitacora().filter(r => r.date >= previo && r.date < desde);
  });

  private inicioDelPeriodo(): string {
    const d = new Date(this.now);
    if (this.periodo() === 'mes') d.setDate(1);
    else { d.setFullYear(d.getFullYear() - 1); d.setDate(d.getDate() + 1); }
    return this.iso(d);
  }

  private inicioDelPeriodoPrevio(): string {
    const d = new Date(this.now);
    if (this.periodo() === 'mes') { d.setDate(1); d.setMonth(d.getMonth() - 1); }
    else { d.setFullYear(d.getFullYear() - 2); d.setDate(d.getDate() + 1); }
    return this.iso(d);
  }

  private iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ------------------------------------------
  // TOTALES
  // ------------------------------------------

  totals = computed(() => this.historyService.calcTotales(this.delPeriodo()));

  /**
   * Serie de los ultimos seis meses, terminando en el mes en curso.
   * Antes era un arreglo fijo de cifras inventadas: dibujaba una tendencia
   * que no existia y siempre rotulaba de enero a junio.
   */
  serie = computed<PuntoSerie[]>(() => {
    const puntos: PuntoSerie[] = [];
    const registros = this.bitacora();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(this.now.getFullYear(), this.now.getMonth() - i, 1);
      const prefijo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      puntos.push({
        etiqueta: MESES_CORTOS[d.getMonth()],
        valor: registros.filter(r => r.date.startsWith(prefijo)).length
      });
    }
    return puntos;
  });

  /** True cuando no hay ni un movimiento en los seis meses. */
  serieVacia = computed(() => this.serie().every(p => p.valor === 0));

  // ------------------------------------------
  // COMPARACION CONTRA EL PERIODO ANTERIOR
  // ------------------------------------------

  comparaciones = computed<Comparacion[]>(() => {
    const hoy   = this.delPeriodo();
    const antes = this.delPeriodoPrevio();

    const cuenta = (rs: RegistroHistorial[], acciones: string[]) =>
      rs.filter(r => acciones.includes(r.accion)).length;

    const filas: { label: string; acciones: string[] }[] = [
      { label: 'Altas',        acciones: ['creacion'] },
      { label: 'Aprobaciones', acciones: ['aprobacion'] },
      { label: 'Observados',   acciones: ['observacion', 'rechazo'] },
      { label: 'Archivados',   acciones: ['archivado'] }
    ];

    return filas.map(f => {
      const actual   = cuenta(hoy, f.acciones);
      const anterior = cuenta(antes, f.acciones);
      return {
        label: f.label,
        actual,
        anterior,
        // Sin base previa no hay porcentaje que calcular: mostrarlo como
        // +100% seria inventar una tendencia sobre un solo dato.
        variacion: anterior === 0 ? null : Math.round(((actual - anterior) / anterior) * 100)
      };
    });
  });

  // ------------------------------------------
  // CATEGORIAS
  // ------------------------------------------

  topCategories = computed(() => {
    const porCat = this.historyService.calcPorCategoria(this.delPeriodo());
    const filas = Object.entries(porCat) as [string, number][];
    const total = filas.reduce((s, [, n]) => s + n, 0);

    return filas
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([clave, n]) => ({
        name: CATEGORIAS_DOCUMENTALES[clave as CategoriaDocumental]?.label ?? clave,
        amount: n,
        percentage: total > 0 ? (n / total) * 100 : 0
      }));
  });

  // ------------------------------------------
  // ANILLO: ENTRADAS FRENTE A SALIDAS
  // ------------------------------------------

  private arco(parte: number): string {
    const t = this.totals();
    const total = t.entradas + t.salidas;
    if (total === 0) return '0, 100';
    return `${(parte / total) * 47.5}, 100`;
  }

  get arcoEntradas(): string { return this.arco(this.totals().entradas); }
  get arcoSalidas(): string  { return this.arco(this.totals().salidas); }

  /** Porcentaje del movimiento que suma al acervo en vez de retirarlo. */
  get indiceVigencia(): number {
    const t = this.totals();
    if (t.entradas === 0) return 0;
    return Math.max(0, Math.round(((t.entradas - t.salidas) / t.entradas) * 100));
  }

  // ------------------------------------------
  // LECTURA EN PALABRAS
  // ------------------------------------------

  observaciones = computed<Observacion[]>(() => {
    const t = this.totals();
    const lista: Observacion[] = [];

    if (t.total === 0) {
      lista.push({
        title: 'Todavía no hay movimiento',
        description: 'Registra documentos y los indicadores se llenarán solos.',
        type: 'info'
      });
      return lista;
    }

    if (t.salidas > t.entradas) {
      lista.push({
        title: 'Salen más documentos de los que entran',
        description: 'Hay más observaciones, rechazos y archivados que altas y aprobaciones.',
        type: 'warning'
      });
    }

    if (this.indiceVigencia >= 60) {
      lista.push({
        title: 'Acervo bajo control',
        description: `El ${this.indiceVigencia}% del movimiento suma al acervo activo.`,
        type: 'positive'
      });
    }

    const observados = this.comparaciones().find(c => c.label === 'Observados');
    if (observados && observados.variacion !== null && observados.variacion > 25) {
      lista.push({
        title: 'Suben las devoluciones',
        description: `Los documentos observados o rechazados crecieron ${observados.variacion}% frente al periodo anterior.`,
        type: 'warning'
      });
    }

    lista.push({
      title: 'Consejo del día',
      description: 'Revisa cada mes los documentos por vencer.',
      type: 'info'
    });

    return lista;
  });

  // ------------------------------------------
  // TRAZADO DE LA SERIE
  // ------------------------------------------

  get trazo(): string {
    const datos = this.serie().map(p => p.valor);
    if (datos.length < 2) return '';

    const max = Math.max(...datos);
    const min = Math.min(...datos);
    const rango = max - min || 1;
    const ancho = 280;
    const alto  = 100;
    const paso  = ancho / (datos.length - 1);

    return datos
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * paso + 10},${alto - ((v - min) / rango) * alto + 10}`)
      .join(' ');
  }

  get area(): string {
    const t = this.trazo;
    return t ? `${t} L 290,110 L 10,110 Z` : '';
  }

  // ------------------------------------------
  // CARGA
  // ------------------------------------------

  async ngOnInit() {
    this.cargando.set(true);
    try {
      this.bitacora.set(await this.historyService.getBitacora());
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarPeriodo(p: 'mes' | 'anio') {
    this.periodo.set(p);
  }

  /** Los documentos se cuentan en enteros, no en decimales. */
  formatoConteo(n: number): string {
    return Math.abs(Math.round(n)).toLocaleString('es-PE');
  }

  /** Signo incluido, o un guion cuando no hay con que comparar. */
  formatoVariacion(v: number | null): string {
    if (v === null) return '—';
    return `${v > 0 ? '+' : ''}${v}%`;
  }
}
