# Firestore Architecture — Track Pays

> **⚠️ ESTADO: VISIÓN IDEAL (PARCIALMENTE IMPLEMENTADO)**
> 
> Este documento describe la estructura **IDEAL** de Firestore. Muestra la visión completa
> del sistema financiero, pero **NO toda la estructura está implementada**.
> 
> **Para ver qué está implementado realmente, ver:**
> - `backend-analysis-and-methodology.md` - Gap analysis detallado
> - El código en `src/app/core/services/firebase.ts`
>
> ---
> **Última actualización**: Mayo 2026
> **Estado de implementación**: ~20% (profile, transactions, goals, categories básicos)

## Visión General

Esta arquitectura redefine completamente cómo almacenamos y procesamos datos financieros en Track Pays. El objetivo es transformar de una app básica de control de gastos a un **sistema operativo financiero personal** moderno.

---

## Problemas de la Arquitectura Anterior

| Problema | Solución |
|----------|----------|
| Transactions como core absoluto | Events financieros, no centro del sistema |
| Sin estructura temporal | Months como unidad organizativa primaria |
| Sin budgeting real | Sistema de presupuestos con planned vs actual |
| Sin analytics | Arquitectura de insights persistidos |
| Todo mixto (input/processing/output) | Separación clara de capas |
| Lectura + cálculo en frontend | Snapshots y agregaciones pre-calculadas |

---

## Nueva Estructura Firestore

```
/users/{userId}/
│
├── profile/                          # Datos del usuario
│   ├── uid: string
│   ├── fullName: string
│   ├── email: string
│   ├── monthlyIncome: number         # Ingreso mensual base
│   ├── currency: string              # "PEN" (soles)
│   ├── locale: string               # "es-PE"
│   ├── createdAt: timestamp
│   ├── updatedAt: timestamp
│   └── preferences/
│       ├── theme: "light"           # Solo light por ahora
│       ├── currencyFormat: string
│       └── notifications: boolean
│
├── financialConfig/                  # Configuración financiera global
│   ├── incomeCategories: string[]
│   ├── expenseCategories: string[]
│   ├── savingsCategories: string[]
│   ├── defaultRule50320: { need: 50, want: 30, saving: 20 }
│   └── customBudgets: { [categoryId]: number }
│
├── recurring/                        # Transacciones recurrentes
│   └── {recurringId}/
│       ├── id: string
│       ├── name: string
│       ├── amount: number
│       ├── type: "income" | "expense"
│       ├── categoryId: string
│       ├── frequency: "daily" | "weekly" | "biweekly" | "monthly"
│       ├── startDate: string        # YYYY-MM-DD
│       ├── endDate: string | null  # null = indefinido
│       ├── isActive: boolean
│       ├── lastProcessed: string   # YYYY-MM
│       └── nextProcessingDate: string
│
├── goals/                           # Metas de ahorro (multiples)
│   └── {goalId}/
│       ├── id: string
│       ├── name: string
│       ├── targetAmount: number
│       ├── currentAmount: number
│       ├── monthlyContribution: number
│       ├── targetDate: string | null
│       ├── monthsToGoal: number
│       ├── priority: number         # 1 = alta, 2 = media, 3 = baja
│       ├── color: string           # Color para UI
│       ├── icon: string
│       ├── isCompleted: boolean
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── months/                          # ⭐ CORE: Períodos mensuales
│   └── {year}-{month}/
│       ├── id: string              # "2025-06"
│       ├── year: number
│       ├── month: number
│       ├── status: "active" | "closed" | "locked"
│       │
│       ├── financialState/          # ⭐ ESTADO CENTRAL DEL MES
│       │   ├── income: number
│       │   ├── expenses: number
│       │   ├── balance: number
│       │   ├── savings: number
│       │   ├── savingsRate: number  # Porcentaje ahorrado
│       │   ├── financialScore: number  # 0-100
│       │   ├── healthStatus: "excellent" | "good" | "warning" | "critical"
│       │   ├── rule50320: { need: { planned: number, actual: number }, want: {...}, saving: {...} }
│       │   ├── budgetUsed: { [categoryId]: { planned: number, actual: number } }
│       │   ├── projectedEnd: number    # Proyección de gasto fin de mes
│       │   ├── daysRemaining: number
│       │   ├── dailyBudgetRemaining: number
│       │   ├── trend: "improving" | "stable" | "declining"
│       │   ├── lastUpdated: timestamp
│       │   └── previousMonthDelta: number  # vs mes anterior
│       │
│       ├── summary/                 # Resumen pre-calculado
│       │   ├── totalTransactions: number
│       │   ├── totalIncome: number
│       │   ├── totalExpenses: number
│       │   ├── averageDailySpend: number
│       │   ├── highestTransaction: { amount: number, description: string, date: string }
│       │   ├── mostFrequentCategory: string
│       │   └── topCategories: { categoryId: string, amount: number, percentage: number }[]
│       │
│       ├── transactions/            # Transacciones del mes
│       │   └── {transactionId}/
│       │       ├── id: string
│       │       ├── amount: number          # Positivo = ingreso, negativo = gasto
│       │       ├── type: "income" | "expense"
│       │       ├── description: string
│       │       ├── categoryId: string
│       │       ├── categoryName: string    # Denormalized para velocidad
│       │       ├── categoryIcon: string    # Denormalized
│       │       ├── ruleType: "need" | "want" | "saving"
│       │       ├── date: string            # YYYY-MM-DD
│       │       ├── dayOfWeek: number       # 0-6 para análisis
│       │       ├── isRecurring: boolean
│       │       ├── recurringId: string | null
│       │       ├── createdAt: timestamp
│       │       └── updatedAt: timestamp
│       │
│       ├── budgets/                 # Presupuesto del mes
│       │   └── {categoryId}/
│       │       ├── categoryId: string
│       │       ├── categoryName: string
│       │       ├── planned: number         # Presupuesto planeado
│       │       ├── actual: number          # Gastado real
│       │       ├── remaining: number
│       │       ├── percentage: number      # Porcentaje usado
│       │       ├── status: "on_track" | "at_risk" | "exceeded"
│       │       ├── history: { date: string, actual: number }[]
│       │       └── alerts: { type: string, message: string, threshold: number }[]
│       │
│       ├── analytics/               # Analytics persistidos del mes
│       │   ├── categoryBreakdown: { categoryId: string, amount: number, percentage: number, trend: "up" | "down" | "stable" }[]
│       │   ├── spendingTrend: number       # % vs mes anterior
│       │   ├── dayOfWeekPattern: { "0": number, "1": number, ... }  # Gasto por día
│       │   ├── timeOfDayPattern: { "morning": number, "afternoon": number, "evening": number }
│       │   ├── recurringTotal: number       # Total de gastos recurrentes
│       │   ├── largestExpense: number
│       │   ├── transactionCount: number
│       │   └── averageTransaction: number
│       │
│       ├── insights/                # ⭐ Insights generados automáticamente
│       │   └── {insightId}/
│       │       ├── id: string
│       │       ├── type: "warning" | "tip" | "achievement" | "trend" | "anomaly"
│       │       ├── category: string | null
│       │       ├── title: string
│       │       ├── description: string
│       │       ├── value: number | null
│       │       ├── comparison: { type: string, value: number, reference: string }
│       │       ├── action: { label: string, action: string }
│       │       ├── isRead: boolean
│       │       ├── isDismissed: boolean
│       │       ├── createdAt: timestamp
│       │       └── expiresAt: timestamp
│       │
│       ├── snapshots/              # Snapshots para regresión rápida
│       │   ├── {snapshotDate}/     # YYYY-MM-DD
│       │       ├── balanceAtDate: number
│       │       ├── expensesAtDate: number
│       │       ├── incomeAtDate: number
│       │       ├── categoryBreakdown: { [categoryId]: number }
│       │       └── dailyBurn: number
│       │
│       └── projections/            # Proyecciones
│           ├── endOfMonth: { projectedExpenses: number, projectedBalance: number, confidence: number }
│           ├── goalProgress: { goalId: string, projectedCompletion: string, onTrack: boolean }
│           └── threeMonthForecast: { month: string, projectedExpenses: number, projectedIncome: number }[]
│
├── goalsHistory/                   # Historia de metas (para trends)
│   └── {goalId}/
│       └── history/
│           └── {year}-{month}/
│               ├── currentAmount: number
│               ├── monthlyContribution: number
│               └── projectedCompletion: string
│
├── analytics/                      # Analytics globales/aggregados
│   ├── yearly/
│   │   └── {year}/
│   │       ├── totalIncome: number
│   │       ├── totalExpenses: number
│   │       ├── totalSavings: number
│   │       ├── monthCount: number
│   │       ├── averageIncome: number
│   │       ├── averageExpenses: number
│   │       ├── topCategories: { categoryId: string, total: number }[]
│   │       └── categoryTrend: { [categoryId]: { yearlyTotal: number, monthlyAvg: number } }[]
│   │
│   ├── allTime/
│   │   ├── totalIncome: number
│   │   ├── totalExpenses: number
│   │   ├── totalSaved: number
│   │   ├── activeMonths: number
│   │   ├── longestStreak: number
│   │   └── financialHealthScore: number
│   │
│   └── recurringPatterns/
│       ├── detectedSubscriptions: { name: string, amount: number, frequency: string, categoryId: string }[]
│       ├── expectedMonthlyRecurring: number
│       └── topRecurringCategories: { categoryId: string, total: number }[]
│
└── cache/                          # Cache para queries frecuentes
    ├── dashboard/
    │   └── latest: { monthId: string, data: MonthlyFinancialState, updatedAt: timestamp }
    │
    ├── categories/
    │   └── user: { categories: Category[], updatedAt: timestamp }
    │
    └── quickStats/
        └── latest: { balance: number, savingsRate: number, financialScore: number }
```

---

## Arquitectura Basada en Meses

### Por qué Months como Core

```
ANTES (CRUD básico):
Transactions ──────► leer todo ──────► calcular en frontend

NUEVO (Fintech moderno):
Months ────────────► MonthlyFinancialState (ya calculado) ──────► mostrar
                          │
                          └── calculations en backend/triggers
```

### Beneficios de la Arquitectura por Meses

| Beneficio | Descripción |
|-----------|-------------|
| **UX instantánea** | El Dashboard carga el estado mensual pre-calculado, no calcula nada |
| **Performance** | Queries simples, datos agregados, no hay que procesar miles de transacciones |
| **UX financiera** | El usuario piensa en "este mes", la arquitectura refleja eso |
| **Snapshots** | Puedo ver el estado en cualquier día del mes |
| **Comparaciones** | Este mes vs mes anterior ya está calculado |
| **Analytics** | Cada mes tiene sus propios analytics persistidos |

### Flujo de Datos

```
1. Usuario registra transacción (Quick Entry)
     │
     ▼
2. Transaction se guarda en months/{monthId}/transactions/
     │
     ▼
3. Cloud Function / Trigger:
   - Actualiza financialState del mes
   - Actualiza summary
   - Regenera analytics del mes
   - Genera insights nuevos si aplica
   - Actualiza budgets affected
   - Genera snapshot del día
     │
     ▼
4. Dashboard carga months/{current}/financialState (ya listo)
```

---

## Monthly Financial State

### Definición

```typescript
interface MonthlyFinancialState {
  // Basics
  income: number;
  expenses: number;
  balance: number;
  savings: number;
  savingsRate: number;  // savings / income * 100

  // Health
  financialScore: number;      // 0-100 score calculado
  healthStatus: HealthStatus;  // excellent | good | warning | critical

  // Budget
  rule503020: Rule503020Breakdown;
  budgetUsed: { [categoryId]: BudgetStatus };

  // Projections
  projectedEnd: number;           // Proyección fin de mes
  daysRemaining: number;
  dailyBudgetRemaining: number;

  // Context
  trend: FinancialTrend;          // improving | stable | declining
  previousMonthDelta: number;      // % vs mes anterior

  // Metadata
  lastUpdated: Timestamp;
}
```

### Cómo se Actualiza

```
On Transaction Create/Update/Delete:
  │
  ├─► Calculate totals (income, expenses, balance)
  │
  ├─► Calculate savings (income - expenses)
  │
  ├─► Calculate rule503020 breakdown
  │
  ├─► Calculate financial score:
  │     - Savings rate: 20% → 30 puntos
  │     - Expenses vs budget: < 90% → 20 puntos
  │     - No anomalies: 20 puntos
  │     - Goal progress: 20 puntos
  │     - Trend improving: 10 puntos
  │
  ├─► Determine health status:
  │     - Score > 80: excellent
  │     - Score > 60: good
  │     - Score > 40: warning
  │     - Score <= 40: critical
  │
  ├─► Calculate projections:
  │     - projectedEnd = (expenses / daysPassed) * daysInMonth
  │     - dailyBudgetRemaining = remainingBudget / daysRemaining
  │
  └─► Determine trend:
        - Compare vs previous month delta
```

### Por qué Existe Este Estado

1. **El Dashboard lo necesita primero** — Es lo primero que ve el usuario
2. **No debe calcularse en frontend** — Para que sea instantáneo
3. **Se actualiza automáticamente** — Cloud Functions mantienen sincronía
4. **Contiene todo lo necesario para la UX financiera** — Score, health, trend, projections

---

## Analytics + Insights System

### Arquitectura de Analytics

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANALYTICS LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TRANSACCIONES ──► PROCESAMIENTO ──► OUTPUTS                  │
│       │                    │                    │              │
│       │                    ▼                    ▼              │
│       │              CALCULATIONS         ANALYTICS             │
│       │              - Totals            - categoryBreakdown    │
│       │              - Trends            - spendingTrend       │
│       │              - Patterns          - dayOfWeekPattern    │
│       │              - Anomalies         - recurringTotal      │
│       │                                    - insights          │
│       ▼                                    ▼                   │
│  PERSISTIDO              PERSISTIDO         PERSISTIDO          │
│  (en months/{id}/        (en months/{id}/    (en months/{id}/    │
│   transactions/)          analytics/)         insights/)         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Tipos de Analytics Persistidos

**1. Category Breakdown** (por categoría)
```typescript
interface CategoryAnalytics {
  categoryId: string;
  amount: number;
  percentage: number;           // % del total de gastos
  trend: "up" | "down" | "stable";
  trendPercentage: number;      // % vs mes anterior
  budgetStatus: "under" | "on_track" | "over";
}
```

**2. Spending Trend**
```typescript
interface SpendingTrend {
  percentageChange: number;      // -20% = gastó 20% menos
  isAnomaly: boolean;            // Si está muy fuera de lo normal
  comparisonBasis: "last_month" | "average_3m" | "same_month_last_year";
}
```

**3. Day of Week Pattern**
```typescript
interface DayOfWeekPattern {
  "0": number;  // Domingo
  "1": number;  // Lunes
  "2": number;
  "3": number;
  "4": number;
  "5": number;
  "6": number;  // Sábado
};
```
Sirve para responder: "¿Qué días gasto más?"

**4. Recurring Detection**
```typescript
interface RecurringAnalysis {
  totalRecurring: number;
  recurringCount: number;
  subscriptionsDetected: DetectedSubscription[];
  nonRecurringTotal: number;
}
```

### Sistema de Insights

Los insights son **mensajes actionable** generados automáticamente:

```typescript
interface Insight {
  type: "warning" | "tip" | "achievement" | "trend" | "anomaly";
  title: string;
  description: string;
  action?: { label: string; action: string };
  priority: number;
  expiresAt: Timestamp;
}
```

**Ejemplos de Insights**:

| Tipo | Title | Description |
|------|-------|-------------|
| **warning** | "Gasto alto detectado" | "Gastaste S/ 350 en una compra, 40% más que tu promedio de S/ 250" |
| **tip** | "Considera reducir" | "Llevas 75% de tu presupuesto de entretenimiento. S/ 75 restantes" |
| **achievement** | "¡Meta alcanzada!" | "Llegaste al 100% de tu meta de ahorro de S/ 10,000" |
| **trend** | "Gasto en aumento" | "Tu gasto en alimentación aumentó 15% vs el mes pasado" |
| **anomaly** | "Gasto fuera de lo normal" | "S/ 200 en categoría que sueles usar poco este mes" |

---

## Budgeting System Real

### Estructura de Budget

```
months/{monthId}/budgets/{categoryId}/
├── categoryId: string
├── categoryName: string         # Denormalized
├── planned: number             # Presupuesto planeado
├── actual: number              # Gastado real
├── remaining: number           # planned - actual
├── percentage: number          # (actual / planned) * 100
├── status: "on_track" | "at_risk" | "exceeded"
│
├── history: {                  # Para ver evolución en el mes
│   date: string;
│   actual: number;
│ }[]
│
└── alerts: {                   # Alertas generadas
  type: "near_limit" | "exceeded";
  message: string;
  threshold: number;            # Porcentaje que disparó la alerta
  createdAt: timestamp;
}[]
```

### Tipos de Budget

1. **Budget por Categoría** (custom)
   - El usuario define cuánto quiere gastar en cada categoría
   - Se compara planned vs actual

2. **Budget Regla 50/30/20** (automático)
   - Calculado desde monthlyIncome
   - Dividido en: necesidades (50%), deseos (30%), ahorro (20%)

3. **Budget Diario** (calculado)
   -剩余 presupuesto / días restantes
   - Para saber cuánto puede gastar por día

### Flujo de Budget

```
1. Inicio del mes:
   - Se crea budget desde financialConfig
   - O se usa budget custom del usuario
   - status = "on_track"

2. Durante el mes:
   - Cada transacción actualiza actual en budget
   - Si percentage > 80%: status = "at_risk", generar alerta
   - Si percentage > 100%: status = "exceeded", generar alerta

3. Fin del mes:
   - month.status = "closed"
   - Se guarda en historial
   - Se calcula performance para el mes siguiente
```

---

## Future Scalability

### La Arquitectura Soporta

| Feature Futuro | Cómo lo Soporta |
|----------------|-----------------|
| **Open Banking** | months/{id}/transactions puede alimentarse de API de banco |
| **IA Financiera** | analytics/ tiene datos estructurados para ML |
| **Categorización Auto** | transactions tiene categoryId, se puede auto-asignar |
| **Multi-Account** | users/{userId}/accounts/ permite múltiples cuentas |
| **Subscriptions** | recurring/ detecta y gestiona suscripciones |
| **Multi-Currency** | profile.currency permite expansión |
| **Collaborative** | users/{userId}/sharedWith/ permite finanzas compartidas |

### Datos Listos para ML

```typescript
// analytics/yearly/{year}/ tiene datos agregados perfectos para:
// - Predecir gastos futuros
// - Detectar anomalías
// - Recomendaciones personalizadas
// - Financial scoring avanzado
```

---

## Angular Integration Strategy

### Cómo Conectar Esta Arquitectura con Angular 21

```
┌─────────────────────────────────────────────────────────────────┐
│                      ANGULAR LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FEATURES          SERVICES              DATA LAYER             │
│  ─────────         ────────              ────────────           │
│                                                                    │
│  Dashboard ──────► DashboardFacade ────► FirestoreRepository    │
│                       │                      │                 │
│                       ▼                      ▼                 │
│                  FinancialEngine      months/{currentMonth}/    │
│                  (calculation)          financialState         │
│                       │                      │                 │
│                       ▼                      ▼                 │
│                  Signals              months/{currentMonth}/    │
│                                            analytics            │
│                                            insights              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Facade Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  // Estado reactivo con signals
  readonly isLoading = signal(true);
  readonly financialState = signal<MonthlyFinancialState | null>(null);
  readonly insights = signal<Insight[]>([]);
  readonly recentTransactions = signal<Transaction[]>([]);

  constructor(
    private monthRepository: MonthRepository,
    private financialEngine: FinancialEngine
  ) {}

  async loadCurrentMonth(): Promise<void> {
    this.isLoading.set(true);
    const monthId = getCurrentMonthId(); // "2025-06"

    // Carga estado pre-calculado (no calcula nada)
    const state = await this.monthRepository.getFinancialState(monthId);
    this.financialState.set(state);

    // Carga insights
    const insights = await this.monthRepository.getInsights(monthId);
    this.insights.set(insights);

    this.isLoading.set(false);
  }
}
```

### Queries Optimizadas

```typescript
// En MonthRepository
async getFinancialState(monthId: string): Promise<MonthlyFinancialState> {
  // Un solo documento, datos pre-calculados
  const doc = await firestore
    .collection('users')
    .doc(userId)
    .collection('months')
    .doc(monthId)
    .collection('financialState')
    .doc('current')
    .get();

  return doc.data();
}

// NO necesita:
// - Obtener todas las transacciones
// - Calcular totales en frontend
// - Agrupar por categoría
// - Calcular regla 50/30/20
// Todo eso ya está en financialState
```

### Realtime Updates

```typescript
// Suscribirse a cambios del mes actual
subscribeToMonthChanges(monthId: string) {
  return firestore
    .collection('users')
    .doc(userId)
    .collection('months')
    .doc(monthId)
    .collection('financialState')
    .doc('current')
    .onSnapshot(snapshot => {
      if (snapshot.exists) {
        this.financialState.set(snapshot.data());
      }
    });
}
```

---

## Diferencias Clave: Antes vs Ahora

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Centro de datos** | Transactions | Months/financialState |
| **Cálculos** | En frontend, cada carga | Pre-calculados en backend |
| **Dashboard** | Lee miles de transactions | Lee 1 documento |
| **Analytics** | No existe | Persistido por mes |
| **Insights** | No existe | Generados automáticamente |
| **Budget** | Solo categoría | Completo con alerts |
| **UX** | Lista de gastos | Estado financiero + insights |
| **Performance** | Lento con muchos datos | Instantáneo |

---

## Resumen Ejecutivo

Esta arquitectura transforma Track Pays de:

| De | A |
|----|---|
| App de control de gastos | Sistema operativo financiero |
| Transactions como core | Months + financialState como core |
| CRUD básico | Fintech moderna |
| Cálculos en frontend | Pre-calculado + snapshots |
| Sin analytics | Analytics + insights por mes |
| Sin budget real | Budget completo con alertas |
| Datos planos | Datos estructurados para escala |

La clave: **El usuario quiere responder "¿cómo estoy este mes?" en menos de 10 segundos**. Esta arquitectura lo hace posible cargando un solo documento pre-calculado.