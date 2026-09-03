# 🚀 Análisis Premium del Backend - Track Pays
## Sistema Financiero Completo v2.0 - Mayo 2026

---

## 📋 TABLA DE CONTENIDOS

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Arquitectura de Base de Datos NoSQL](#2-arquitectura-de-base-de-datos-nosql)
3. [Servicios del Backend - Análisis Detallado](#3-servicios-del-backend---análisis-detallado)
4. [Modelo de Datos Completo](#4-modelo-de-datos-completo)
5. [Flujo de Datos y Operaciones](#5-flujo-de-datos-y-operaciones)
6. [Seguridad y Autenticación](#6-seguridad-y-autenticación)
7. [Patrones de Diseño Implementados](#7-patrones-de-diseño-implementados)
8. [Estado de Implementación y Métricas](#8-estado-de-implementación-y-métricas)
9. [Comparación NoSQL vs Relacional](#9-comparación-nosql-vs-relacional)
10. [Futuro y Expansiones](#10-futuro-y-expansiones)

---

## 1. VISIÓN GENERAL DEL SISTEMA

### 1.1 ¿Qué es Track Pays?

Track Pays es un **sistema operativo financiero personal** construido sobre Firebase/Firestore que permite a los usuarios gestionar sus finanzas personales de manera integral.

### 1.2 Características Principales

| Característica | Descripción |
|----------------|-------------|
| **Sistema Dual de Gastos** | Clasificación de gastos en Primordiales (esenciales) y No Primordiales |
| **Múltiples Fuentes de Ingreso** | Soporte para salary, freelance, business, AFP, rental, dividends, allowance |
| **Presupuestos por Categoría** | Budgeting con alertas automáticas (on_track/at_risk/exceeded) |
| **Metas de Ahorro Múltiples** | Gestión de múltiples goals con prioridades y proyecciones |
| **Comparativas Mensuales** | Análisis comparativo entre meses con tendencias |
| **Sistema de Alertas** | 8 tipos de alertas centralizadas |
| **Exportación de Datos** | Reportes en CSV y JSON |
| **Sincronización Offline** | Cache local con IndexedDB |

### 1.3 Tecnología Utilizada

```
├── Frontend: Angular 21
├── Backend: Firebase/Firestore
├── Auth: Firebase Authentication
├── Cache: IndexedDB (offline)
└── Package Manager: pnpm
```

---

## 2. ARQUITECTURA DE BASE DE DATOS NoSQL

### 2.1 Estructura de Colecciones

```
firestore: track-pays
│
└── users/{userId}/
    │
    ├── profile/data
    │   └── Documento: { email, fullName, age, employmentType, 
    │                     monthlyIncome, currency, locale, 
    │                     initialBalance, onboardingCompleted, ... }
    │
    ├── incomeSources/
    │   └── Subcolección → Documentos por {sourceId}
    │       └── { type, name, amount, frequency, paymentDayOfMonth, 
    │                isActive, isRecurring, deductions, ... }
    │
    ├── expenses/
    │   └── Subcolección → Documentos por {expenseId}
    │       └── { isPrimordial, category, subcategory, name, 
    │                budgetedAmount, actualAmount, dueDayOfMonth, 
    │                status, isRecurring, frequency, ... }
    │
    ├── goals/
    │   └── Subcolección → Documentos por {goalId}
    │       └── { name, category, targetAmount, currentAmount, 
    │                monthlyContribution, priority, status, 
    │                monthsToGoal, contributions[], ... }
    │
    └── months/{monthId}/          ← Formato: "YYYY-MM" (ej: "2026-05")
        │
        ├── transactions/
        │   └── Sub-subcolección → Documentos por {transactionId}
        │       └── { type, amount, description, date, category, 
        │                ruleType, deletedAt, ... }
        │
        ├── budgets/
        │   └── Sub-subcolección → Documentos por {category}
        │       └── { categoryName, isPrimordial, budgetedAmount, 
        │                actualAmount, percentageUsed, status, 
        │                alertThreshold, history[], ... }
        │
        └── financialState
            └── Documento único: { income, expenses, balance, 
                                   savings, savingsRate, financialScore, 
                                   healthStatus, rule50320, ... }
```

### 2.2 Jerarquía de Acceso

```
users/{userId}/                                    ← Nivel 1 (root)
  ├── profile/                                    ← Nivel 2
  │   └── data                                    ← Nivel 3 (documento)
  │
  ├── incomeSources/                              ← Nivel 2
  │   └── {sourceId}                              ← Nivel 3 (documento)
  │
  ├── months/{monthId}/                           ← Nivel 2
  │   ├── transactions/                           ← Nivel 3
  │   │   └── {transactionId}                    ← Nivel 4 (documento)
  │   │
  │   ├── budgets/                                ← Nivel 3
  │   │   └── {category}                         ← Nivel 4 (documento)
  │   │
  │   └── financialState                          ← Nivel 3 (documento)
```

### 2.3 Patrón de Nombrado

| Colección | Patrón de ID | Ejemplo |
|------------|-------------|---------|
| users | UUID automático | `CFWogdbBvUTBLE5qSKLtB1l1wxT2` |
| incomeSources | ID personalizado o auto | `sueldo`, `freelance` |
| expenses | ID personalizado | `alquiler`, `netflix` |
| goals | ID auto generado | `abc123xyz` |
| months | Formato YYYY-MM | `2026-05` |
| transactions | ID auto generado | `tx_abc123` |
| budgets | Nombre de categoría | `housing`, `utilities` |

---

## 3. SERVICIOS DEL BACKEND - ANÁLISIS DETALLADO

### 3.1 FirebaseService (firebase.ts)

**Propósito**: Servicio central que maneja toda la comunicación con Firestore.

**Tamaño**: ~980 líneas de código

**Métodos principales**:

```typescript
// AUTENTICACIÓN
getCurrentUser(): User | null
onAuthStateChange(callback): Unsubscribe
signIn(email, password): Promise<UserCredential>
signUp(email, password): Promise<UserCredential>
signOut(): Promise<void>

// PERFIL
getUserProfile(userId): Promise<any>
saveUserProfile(userId, data): Promise<void>

// MESES
getOrCreateMonth(userId, year, month): Promise<string>
getUserMonths(userId): Promise<any[]>

// TRANSACCIONES
getTransactions(userId, year?, month?): Promise<any[]>
getTransactionsByMonth(userId, year, month): Promise<any[]>
createTransaction(userId, data): Promise<any>
createTransactionInMonth(userId, data): Promise<any>
updateTransaction(userId, txId, data): Promise<void>
deleteTransaction(userId, txId): Promise<void>

// ESTADO FINANCIERO
getFinancialState(userId, year, month): Promise<any>
updateFinancialState(userId, monthId): Promise<any>
getMonthSummary(userId, year, month): Promise<any>

// INGRESOS
getIncomeSources(userId): Promise<any[]>
getActiveIncomeSources(userId): Promise<any[]>
createIncomeSource(userId, data): Promise<any>
updateIncomeSource(userId, sourceId, data): Promise<void>
deactivateIncomeSource(userId, sourceId): Promise<void>
calculateMonthlyIncome(userId, year, month): Promise<any>

// GASTOS
getExpenses(userId): Promise<any[]>
getActiveExpenses(userId): Promise<any[]>
getExpensesByMonth(userId, year, month): Promise<any[]>
createExpense(userId, data): Promise<any>
updateExpense(userId, expenseId, data): Promise<void>
markExpensePaid(userId, expenseId, amount, date?): Promise<void>
cancelExpense(userId, expenseId): Promise<void>
calculateMonthlyExpenses(userId, year, month): Promise<any>

// PRESUPUESTOS
getBudgetsByMonth(userId, year, month): Promise<any[]>
setBudget(userId, data): Promise<any>
updateBudgetActual(userId, category, monthId, amount): Promise<void>
calculateMonthlyBudgetSummary(userId, year, month): Promise<any>

// METAS
getGoal(userId): Promise<any>
getGoals(userId): Promise<any[]>
getAllGoals(userId): Promise<any[]>
getGoalById(userId, goalId): Promise<any>
createGoal(userId, data): Promise<any>
updateGoal(userId, goalId, data): Promise<void>
addContribution(userId, goalId, amount, note?): Promise<void>
deleteGoal(userId, goalId): Promise<void>

// CATEGORÍAS
getCategories(userId): Promise<any[]>
createCategory(userId, data): Promise<any>
createCategories(userId, categories[]): Promise<void>
```

**Características especiales**:
- ✅ Pre-cálculo de `financialState` en cada transacción
- ✅ Búsqueda automática de mes para update/delete
- ✅ Soft delete en transacciones
- ✅ Historial en budgets

---

### 3.2 TransactionService (transaction.ts)

**Propósito**: Gestionar transacciones financieras (CRUD completo).

```typescript
// CRUD
create(payload: TransactionPayload): Promise<Transaction>
getByMonth(year: number, month: number): Promise<Transaction[]>
getAll(): Promise<Transaction[]>
update(id: string, payload: Partial<TransactionPayload>): Promise<Transaction>
delete(id: string): Promise<void>

// Cálculos
calcTotals(transactions: Transaction[]): { income, expenses, balance }
calcByRuleType(transactions: Transaction[]): { need: number, want: number, saving: number }
calcByCategory(transactions: Transaction[]): Map<string, { name, icon, total }>
```

**Tipos de transacción**:
- `income` → Monto positivo
- `expense` → Monto negativo

**Regla 50/30/20**:
- `need` → Necesidades (50%)
- `want` → Deseos (30%)
- `saving` → Ahorro (20%)

---

### 3.3 IncomeService (income.ts)

**Propósito**: Gestionar múltiples fuentes de ingreso con fechas de pago.

```typescript
// CRUD
getAll(): Promise<IncomeSource[]>
getActive(): Promise<IncomeSource[]>
create(payload: IncomeSourcePayload): Promise<IncomeSource>
update(sourceId: string, payload: Partial<IncomeSourcePayload>): Promise<void>
deactivate(sourceId: string): Promise<void>

// Cálculos mensuales
getMonthlyIncome(year, month): Promise<MonthlyIncome>
calculateTotalMonthlyIncome(year, month): Promise<number>
getAvailableNow(year, month): Promise<number>

// Balance inicial
getInitialBalance(): Promise<number>
setInitialBalance(amount: number): Promise<void>
```

**Tipos de ingreso soportados**:
```typescript
type: 'salary' | 'freelance' | 'business' | 'afp' | 'rental' | 'dividends' | 'allowance' | 'other'
```

**Frecuencias**:
```typescript
frequency: 'weekly' | 'biweekly' | 'monthly'
```

**Estados de ingreso**:
- `pending` → Pendiente
- `partial` → Parcialmente recibido
- `received` → Completamente recibido
- `overdue` → Vencido

---

### 3.4 ExpenseService (expense.ts)

**Propósito**: Sistema dual de gastos (Primordial vs No Primordial).

```typescript
// CRUD
getAll(): Promise<Expense[]>
getActive(): Promise<Expense[]>
create(payload: ExpensePayload): Promise<Expense>
update(expenseId: string, payload: Partial<ExpensePayload>): Promise<void>
markAsPaid(expenseId: string, amount: number): Promise<void>
cancel(expenseId: string): Promise<void>

// Resumen mensual
getMonthlySummary(year, month): Promise<MonthlyExpenseSummary>
```

**Categorías Primordiales (esenciales)**:
```typescript
'housing'       // Alquiler / Hipoteca
'utilities'      // Servicios (luz, agua, internet, gas, teléfono)
'transport'     // Transporte
'health'        // Salud
'debt'          // Deudas
'groceries'     // Supermercado
'education'     // Educación
```

**Categorías No Primordiales**:
```typescript
'dining_out'    // Comida fuera
'entertainment' // Cine, eventos
'streaming'    // Netflix, Spotify
'pets'          // Mascotas
'clothing'      // Ropa
'travel'        // Viajes
'shopping'      // Compras
'subscriptions' // Suscripciones
```

**Estados de pago**:
```typescript
'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'
```

**Características especiales**:
- ✅ Soporte para gastos variables (luz, agua)
- ✅ tracking de suscripciones con cambios de precio
- ✅ Detalles de deuda (tipo, acreedor, tasa)
- ✅ Categorías extensibles sin romper código

---

### 3.5 BudgetService (budget.ts)

**Propósito**: Presupuestos por categoría con alertas automáticas.

```typescript
// CRUD
getByMonth(year, month): Promise<Budget[]>
createOrUpdate(payload: BudgetPayload): Promise<Budget>
getMonthlySummary(year, month): Promise<MonthlyBudgetSummary>

// Helpers
autoCreateBudgetsFromIncome(incomeBudgeted, year, month): Promise<void>
getRemainingBudget(year, month): Promise<number>
getAtRiskCategories(year, month): Promise<Budget[]>
```

**Estados de presupuesto**:
```typescript
'on_track'   // Dentro del presupuesto (< 80%)
'at_risk'    // En riesgo (80-99%)
'exceeded'   // Excedido (>= 100%)
'unused'     // Sin usar (0%)
```

**Características**:
- ✅ Breakdowns: Primordial vs No Primordial
- ✅ Alertas automáticas por categoría
- ✅ Historial de cambios
- ✅ Regla 50/30/20 integrada

---

### 3.6 GoalService (goal.ts)

**Propósito**: Gestión de múltiples metas de ahorro.

```typescript
// CRUD completo
getAll(): Promise<SavingGoal[]>
getAllIncludingInactive(): Promise<SavingGoal[]>
getById(goalId: string): Promise<SavingGoal | null>
create(payload: GoalPayload): Promise<SavingGoal>
update(goalId: string, payload: Partial<GoalPayload>): Promise<SavingGoal>
delete(goalId: string): Promise<void>

// Contribuciones
addContribution(goalId: string, amount: number, note?: string): Promise<SavingGoal>

// Helpers
calcProgress(goal: SavingGoal): number
calcEstimatedDate(monthsToGoal): string
getCategories(): Record<GoalCategory, { name, icon }>
getPriorities(): Record<GoalPriority, { label, color }>

// Filtros
getByPriority(priority): Promise<SavingGoal[]>
getByCategory(category): Promise<SavingGoal[]>

// Totales
getTotalSaved(): Promise<number>
getTotalTarget(): Promise<number>
```

**Categorías de metas**:
```typescript
'emergency' | 'travel' | 'vehicle' | 'house' | 'education' 
| 'technology' | 'wedding' | 'investment' | 'retirement' 
| 'debt_payoff' | 'business' | 'other'
```

**Prioridades**:
```typescript
'high' (color: #EF4444)
'medium' (color: #F59E0B)
'low' (color: #10B981)
```

**Estados**:
```typescript
'active' | 'completed' | 'paused' | 'cancelled'
```

---

### 3.7 ComparisonService (comparison.ts) - NUEVO

**Propósito**: Comparativas mensuales y análisis de tendencias.

```typescript
// Comparativa mes actual vs anterior
getMonthComparison(year, month): Promise<MonthComparison>
// Returns: { currentMonth, previousMonth, income, expenses, 
//            balance, savings, byCategory, healthComparison }

// Tendencias de últimos N meses
getTrendSummary(year, month, monthsBack): Promise<{
  months: { monthId, income, expenses, savings }[],
  averageIncome, averageExpenses, averageSavings,
  incomeTrend, expenseTrend
}>
```

**Datos comparativos**:
- Income: current, previous, difference, percentageChange, trend (up/down/stable)
- Expenses: mismo formato
- Balance: mismo formato
- Savings: mismo formato
- ByCategory: comparación por categoría
- HealthComparison: currentScore, previousScore, scoreChange, status

---

### 3.8 AlertsService (alerts.ts) - NUEVO

**Propósito**: Sistema centralizado de alertas financieras.

```typescript
// Obtener todas las alertas
getAllAlerts(year, month): Promise<Alert[]>
// Returns: Alert[] con type, severity, title, message, category, amount

// Resumen por severidad
getAlertSummary(year, month): Promise<{
  total, critical, high, medium, low
}>
```

**8 tipos de alertas**:
| Tipo | Severidad | Descripción |
|------|-----------|-------------|
| `overdue_expense` | high | Gasto vencido |
| `budget_exceeded` | critical | Presupuesto excedido |
| `budget_at_risk` | medium | Presupuesto en riesgo |
| `income_pending` | low | Ingreso próximo |
| `income_overdue` | high | Ingreso vencido |
| `goal_behind_schedule` | high/medium | Meta atrasada |
| `high_spending_category` | medium/low | Categoría de alto gasto |
| `low_savings_rate` | high | Tasa de ahorro < 10% |

**Severidades**:
- `critical` → Requiere acción inmediata
- `high` → Importante
- `medium` → Atención moderada
- `low` → Informativo

---

### 3.9 MonthRolloverService (month-rollover.service.ts) - NUEVO

**Propósito**: Gestión automática de meses.

```typescript
// Verificar/crear mes actual
checkAndRollover(): Promise<RolloverResult>

// Hacer rollover a mes específico
rolloverToNewMonth(year, month): Promise<RolloverResult>
// Returns: { success, previousMonth, newMonth, budgetsCopied, 
//            expensesCopied, recurringGenerated }

// Listar meses del usuario
getUserMonths(): Promise<{ monthId, hasData }[]>

// Archivar mes
archiveMonth(year, month): Promise<void>
```

**Funcionalidades**:
- ✅ Auto-crear mes si no existe
- ✅ Copiar budgets del mes anterior
- ✅ Preparar gastos recurrentes
- ✅ Inicializar financialState

---

### 3.10 ReportService (report.service.ts) - NUEVO

**Propósito**: Generación de reportes y exportación de datos.

```typescript
// Generar reporte
generateReport(options: ReportOptions): Promise<GeneratedReport>
// options: { type, format, year, month, startDate?, endDate? }

// Métodos de exportación rápida
exportTransactionsCSV(year, month): Promise<void>
exportFullReportJSON(year, month): Promise<void>

// Descargar archivo
downloadReport(report: GeneratedReport): void
```

**Tipos de reporte**:
```typescript
'transactions' | 'income' | 'expenses' | 'budgets' | 'goals' | 'full'
```

**Formatos**:
```typescript
'csv' | 'json' | 'pdf'
```

---

### 3.11 OfflineSyncService (offline-sync.service.ts) - NUEVO

**Propósito**: Sincronización offline con cache local.

```typescript
// Cache de datos
cacheTransactions(transactions): Promise<void>
cacheIncome(sources): Promise<void>
cacheExpenses(expenses): Promise<void>
cacheBudgets(budgets): Promise<void>
cacheGoals(goals): Promise<void>

// Obtener datos cacheados
getCachedTransactions(): Promise<any[]>
getCachedIncome(): Promise<any[]>
getCachedExpenses(): Promise<any[]>
getCachedBudgets(): Promise<any[]>
getCachedGoals(): Promise<any[]>

// Sincronización
syncFromFirebase(year, month): Promise<void>
syncPendingChanges(): Promise<{ synced, failed }>

// Obtener con fallback
getDataWithFallback(type, year?, month?): Promise<any[]>

// Estado
getStatus(): SyncStatus
getPendingCount(): Promise<number>

// Limpieza
clearCache(): Promise<void>
```

**Características**:
- ✅ IndexedDB para almacenamiento local
- ✅ Auto-detección online/offline
- ✅ Cola de cambios pendientes
- ✅ Sync automático al recuperar conexión

---

### 3.12 OnboardingService (onboarding.ts)

**Propósito**: Configuración inicial adaptativa según tipo de empleo.

```typescript
// Verificación
isOnboardingComplete(): Promise<boolean>
getOnboardingVersion(): Promise<number>

// Configuración
getQuestionsByEmploymentType(type): OnboardingQuestion[]
getEmploymentTypes(): { value, label, icon }[]

// Guardar respuestas
saveOnboardingResponse(response: OnboardingResponse): Promise<void>

// Perfil
getUserProfile(): Promise<any>
markForReview(): Promise<void>
resetOnboarding(): Promise<void>
```

**Tipos de empleo**:
- `employee` → Empleado dependiente
- `freelancer` → Freelancer
- `business_owner` → Dueño de negocio
- `retired` → Jubilado
- `student` → Estudiante
- `unemployed` → Sin trabajo
- `other` → Otro

---

## 4. MODELO DE DATOS COMPLETO

### 4.1 Documento: profile/data

```typescript
interface UserProfile {
  email: string;
  fullName: string;
  age?: number;
  employmentType?: string;
  monthlyIncome: number;
  currency: string;        // "PEN"
  locale: string;          // "es-PE"
  initialBalance: number;
  onboardingCompleted: boolean;
  onboardingVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 Documento: incomeSources/{sourceId}

```typescript
interface IncomeSource {
  id: string;
  userId: string;
  type: 'salary' | 'freelance' | 'business' | 'afp' | 'rental' | 'dividends' | 'allowance' | 'other';
  name: string;
  amount: number;
  actualAmount?: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  paymentDayOfMonth: number | null;
  firstPaymentDate?: string;
  lastPaymentDate?: string;
  deductions?: {
    afpPercent?: number;
    insurancePercent?: number;
    otherDeductions?: { name: string; percent: number; amount: number }[];
  };
  isActive: boolean;
  isRecurring: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 4.3 Documento: expenses/{expenseId}

```typescript
interface Expense {
  id: string;
  userId: string;
  isPrimordial: boolean;
  category: string;
  subcategory?: string;
  name: string;
  provider?: string;
  description?: string;
  budgetedAmount: number;
  actualAmount: number;
  dueDayOfMonth: number | null;
  paymentDate?: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  isRecurring: boolean;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  isSubscription?: boolean;
  subscriptionPrice?: number;
  subscriptionPeriod?: 'monthly' | 'yearly';
  isVariable?: boolean;
  averageAmount?: number;
  dangerThreshold?: number;
  providerDetails?: {
    accountNumber?: string;
    contractNumber?: string;
    planType?: string;
    contactPhone?: string;
    website?: string;
  };
  debtDetails?: {
    debtType: string;
    creditorName: string;
    interestRate?: number;
    totalDebt?: number;
    remainingPayments?: number;
  };
  tags?: string[];
  metadata?: Record<string, any>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 4.4 Documento: goals/{goalId}

```typescript
interface SavingGoal {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate?: string;
  monthsToGoal: number | null;
  projectedCompletionDate?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  isCompleted: boolean;
  contributions: {
    id: string;
    amount: number;
    date: string;
    note?: string;
  }[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 4.5 Documento: months/{monthId}/financialState

```typescript
interface FinancialState {
  // Ingresos
  income: number;
  incomeBudgeted: number;
  incomeReceived: number;
  incomePending: number;
  initialBalance: number;
  availableNow: number;
  expectedByEndOfMonth: number;
  
  // Gastos
  expenses: number;
  expensesBudgeted: number;
  
  // Balance
  balance: number;
  budgetedBalance: number;
  
  // Ahorro
  savings: number;
  savingsRate: number;
  
  // Score
  financialScore: number;
  healthStatus: 'excellent' | 'good' | 'warning' | 'critical';
  
  // Breakdown 50/30/20
  rule50320: {
    need: number;
    want: number;
    saving: number;
  };
  
  lastUpdated: string;
}
```

### 4.6 Documento: months/{monthId}/budgets/{category}

```typescript
interface Budget {
  category: string;
  categoryName: string;
  isPrimordial: boolean;
  budgetedAmount: number;
  actualAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  status: 'on_track' | 'at_risk' | 'exceeded' | 'unused';
  alertThreshold: number;
  isActive: boolean;
  year: number;
  month: number;
  history: {
    date: string;
    actualAmount: number;
    percentage: number;
  }[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. FLUJO DE DATOS Y OPERACIONES

### 5.1 Flujo de Creación de Transacción

```
1. Usuario crea transacción
       │
       ▼
2. TransactionService.create()
       │
       ▼
3. FirebaseService.createTransaction()
       │
       ▼
4. Determinar monthId de la fecha
       │
       ▼
5. Verificar/crear mes (getOrCreateMonth)
       │
       ▼
6. Crear documento en months/{id}/transactions
       │
       ▼
7. Actualizar financialState (updateFinancialState)
       │
       ▼
   Calcular: income, expenses, balance, savings, savingsRate, score
       │
       ▼
8. Devolver resultado al cliente
```

### 5.2 Flujo de预算 (Budget)

```
1. Usuario define presupuesto por categoría
       │
       ▼
2. BudgetService.createOrUpdate()
       │
       ▼
3. FirebaseService.setBudget()
       │
       ▼
4. Guardar en months/{id}/budgets/{category}
       │
       ▼
5. Calculation automático:
   - percentageUsed = (actual / budgeted) * 100
   - remainingAmount = budgeted - actual
   - status = on_track / at_risk / exceeded
       │
       ▼
6. Generar alertas si at_risk o exceeded
```

### 5.3 Flujo de Alertas

```
1. AlertsService.getAllAlerts(year, month)
       │
       ├──► Budget alerts: leer calculateMonthlyBudgetSummary
       │
       ├──► Expense alerts: leer calculateMonthlyExpenses  
       │
       ├──► Income alerts: leer calculateMonthlyIncome
       │
       └──► Goal alerts: leer goals + financialState
              │
              ▼
       Unir todas las alertas
              │
              ▼
       Ordenar por severidad (critical > high > medium > low)
              │
              ▼
       Devolver Alert[]
```

### 5.4 Flujo de Comparación

```
1. ComparisonService.getMonthComparison(year, month)
       │
       ├──► Obtener financialState actual
       │
       ├──► Obtener financialState mes anterior
       │
       ├──► Calcular diferencias:
       │   - difference = current - previous
       │   - percentageChange = (difference / previous) * 100
       │   - trend = up / down / stable
       │
       ├──► Comparar por categoría
       │
       └──► Comparar health scores
              │
              ▼
       Devolver MonthComparison{}
```

---

## 6. SEGURIDAD Y AUTENTICACIÓN

### 6.1 Autenticación

```
Firebase Authentication
├── Proveedores: Email/Password
├── UID único por usuario
└── Sesiones persistentes
```

### 6.2 Reglas de Firestore (recomendadas)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Solo usuarios autenticados pueden acceder a sus datos
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // El resto de reglas según necesidad...
  }
}
```

### 6.3 Estructura de Datos por Usuario

```
UID del usuario → Colección privada
├── No hay acceso entre usuarios
├── Cada usuario ve solo sus datos
└── Root document: users/{userId}
```

---

## 7. PATRONES DE DISEÑO IMPLEMENTADOS

### 7.1 Patrón Singleton (Servicios)

```typescript
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  // Una sola instancia para toda la app
}
```

### 7.2 Patrón Repository

```typescript
// TransactionService actúa como Repository
class TransactionService {
  getByMonth()   // READ
  create()      // CREATE
  update()      // UPDATE
  delete()      // DELETE
}
```

### 7.3 Patrón Service Layer

```
Componente/Page
       │
       ▼
Service (lógica de negocio)
       │
       ▼
FirebaseService (acceso a datos)
       │
       ▼
Firestore (persistencia)
```

### 7.4 Pre-cálculo (Denormalización)

```
financialState se calcula en cada transacción
├── Se guarda como documento separado
├── Se actualiza automáticamente
└── Evita cálculos en tiempo real en UI
```

### 7.5 Inyección de Dependencias

```typescript
class DashboardComponent {
  private firebase = inject(FirebaseService);
  private transactionService = inject(TransactionService);
  private goalService = inject(GoalService);
}
```

---

## 8. ESTADO DE IMPLEMENTACIÓN Y MÉTRICAS

### 8.1 Servicios Implementados

| # | Servicio | Líneas | Estado |
|---|----------|--------|--------|
| 1 | FirebaseService | ~980 | ✅ 100% |
| 2 | TransactionService | ~86 | ✅ 100% |
| 3 | IncomeService | ~82 | ✅ 100% |
| 4 | ExpenseService | ~204 | ✅ 100% |
| 5 | BudgetService | ~127 | ✅ 100% |
| 6 | GoalService | ~222 | ✅ 100% |
| 7 | ComparisonService | ~213 | ✅ 100% |
| 8 | AlertsService | ~220 | ✅ 100% |
| 9 | MonthRolloverService | ~168 | ✅ 100% |
| 10 | ReportService | ~284 | ✅ 100% |
| 11 | OfflineSyncService | ~310 | ✅ 100% |
| 12 | OnboardingService | ~243 | ✅ 100% |

**Total**: ~2,139 líneas de código en servicios

### 8.2 Colecciones Firestore

| Colección | Documentos | Estado |
|-----------|------------|--------|
| users/{userId}/profile | 1 por usuario | ✅ |
| users/{userId}/incomeSources | N por usuario | ✅ |
| users/{userId}/expenses | N por usuario | ✅ |
| users/{userId}/goals | N por usuario | ✅ |
| users/{userId}/months/{monthId}/transactions | N por mes | ✅ |
| users/{userId}/months/{monthId}/budgets | N por categoría | ✅ |
| users/{userId}/months/{monthId}/financialState | 1 por mes | ✅ |

### 8.3 Funcionalidades Completas

- ✅ Sistema de ingresos múltiples
- ✅ Sistema dual de gastos
- ✅ Presupuestos por categoría
- ✅ Metas de ahorro múltiples
- ✅ Transacciones CRUD
- ✅ Comparativas mensuales
- ✅ Sistema de alertas (8 tipos)
- ✅ Month rollover automático
- ✅ Reportes y exportación
- ✅ Sincronización offline

---

## 9. COMPARACIÓN NoSQL vs RELACIONAL

### 9.1 Diferencias Fundamentales

| Característica | SQL (Relacional) | NoSQL (Firestore) |
|----------------|------------------|-------------------|
| **Estructura** | Tablas con filas y columnas | Colecciones con documentos |
| **ID** | Auto-incremental (1, 2, 3) | UUID automático |
| **Relaciones** | Foreign Keys | Paths de colecciones |
| **Joining** | SELECT con JOIN | No existen |
| **Queries** | SQL muy flexible | Limitadas a colección |
| **Transacciones** | ACID completo | Optimistic, eventual |
| **Escala** | Vertical (servidor único) | Horizontal (sharding) |

### 9.2 Por qué NoSQL para Track Pays?

```
Ventajas NoSQL para este caso:
├── Estructura jerárquica natural para datos financieros
├── Lecturas rápidas por documento único
├── Escalabilidad automática de Firebase
└── Sin overhead de joins complejos
```

### 9.3 Trade-offs

```
Lo que ganamos:
+ Velocidad de lectura
+ Simplicidad de estructura
+ Escalabilidad
+ Modelo de datos flexible

Lo que perdemos:
- Joins complejos
- Consultas transversales
- Integridad referencial estricta
- Transacciones ACID
```

---

## 10. FUTURO Y EXPANSIONES

### 10.1 Posibles Mejoras

| Prioridad | Mejora | Descripción |
|-----------|--------|-------------|
| Alta | UI de Alertas | Mostrar alertas en interfaz |
| Alta | Dashboard Real | Integrar datos reales vs hardcoded |
| Media | Notificaciones Push | Recordatorios de pagos |
| Media | Gráficos | Visualizaciones de datos |
| Baja | ML/Insights | Predicciones de gasto |
| Baja | API REST | Exponer endpoints |

### 10.2 Expansión de Datos

```
Campos adicionales que pueden agregarse:
├── Expense: receiptImage, splitDetails, recurringPattern
├── Goal: linkedBankAccount, autoDeposit, milestones[]
├── Budget: rolloverBehavior, alertSound, color
└── User: notificationPreferences, theme, language
```

### 10.3 Migraciones Futuras

```
Si se necesita cambiar a SQL algún día:
├── Exportar todos los documentos
├── Mapear subcolecciones a tablas
├── Crear tablas de relación
└── Migrar datos con scripts
```

---

## 📊 RESUMEN EJECUTIVO

| Métrica | Valor |
|---------|-------|
| **Servicios implementados** | 12 |
| **Líneas de código** | ~2,139 |
| **Colecciones Firestore** | 7 principales |
| **Funcionalidades** | 100% |
| **Estado** | ✅ COMPLETO |

---

**Documento actualizado**: Mayo 2026  
**Versión**: 2.0  
**Estado del Backend**: 100% ✅  
**Próxima fase**: UI/Front-end

---

*Este documento es parte de la documentación técnica de Track Pays. Para información adicional, consulte:*
- `docs/financial-system-master.md`
- `docs/database-schema.md`
- `docs/quick-reference.md`