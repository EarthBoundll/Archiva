# Sistema Financiero Completo - Track Pays
## Documento Maestro v2.0 (Actualizado Mayo 2026)

---

## 1. Visión General

Track Pays es un **sistema operativo financiero personal** que proporciona:
- Vista completa de ingresos y gastos
- Flujo de caja mensual con proyecciones
- Alertas inteligentes de salud financiera
- Comparativas históricas con metas personalizadas
- Onboarding adaptativo según situación laboral

---

## 2. Estado de Implementación

| Sistema | Implementado | Estado |
|---------|--------------|--------|
| Months Structure | ✅ | COMPLETO |
| financialState pre-calculado | ✅ | COMPLETO |
| Ingresos con recurrencia inteligente (Smart Recurrence Engine) | ✅ | COMPLETO |
| Income History (log permanente de movimientos) | ✅ | COMPLETO |
| Gastos dual (primordial/no primordial) | ✅ | COMPLETO |
| Estados de pago | ✅ | COMPLETO |
| Flujo de caja | ✅ | COMPLETO |
| Onboarding adaptativo | ✅ | COMPLETO (backend) |
| Sistema extensible | ✅ | COMPLETO |
| Goals multiples | ✅ | COMPLETO |
| Transaction CRUD (create/read/update/delete) | ✅ | COMPLETO |
| Alertas centralizadas (AlertService) | ✅ | COMPLETO |
| Comparativas mensuales (ComparisonService) | ✅ | COMPLETO |
| Month Rollover automatico | ✅ | COMPLETO |
| Reportes/Export (ReportService) | ✅ | COMPLETO |
| Offline sync (OfflineSyncService) | ✅ | COMPLETO |
| **Dashboard UI (Chart.js, glassmorphism, carrusel)** | **✅** | **COMPLETO (~90%)** |
| **Income Page UI (8 categorias, 28 tipos, filtros, historial)** | **✅** | **COMPLETO (~90%)** |

---

## 3. Estructura Firestore Actual

```
users/{userId}/
├── profile/                          ✅ Onboarding data aqui
│   └── (age, employmentType, answers, initialBalance, etc.)
│
├── incomeSources/                    ✅ IMPLEMENTADO (Smart Recurrence)
│   └── {sourceId}/
│       ├── category, type, name, amount, currency
│       ├── recurrence                ← RecurrenceRule (8 frecuencias)
│       ├── nextOccurrences           ← 6 fechas calculadas
│       ├── paymentStatus             ← { status, nextDate, daysUntil, isLate }
│       ├── lastReceivedDate, actualAmount
│       ├── alertBeforeDays, autoCreateTransaction
│       ├── deductions                ← AFP, seguros
│       ├── isActive, notes
│       └── createdAt, updatedAt
│
├── incomeHistory/                    ✅ IMPLEMENTADO (log permanente)
│   └── {entryId}/
│       ├── sourceId, sourceName
│       ├── type: transfer/deletion/reactivation
│       ├── amount, date, time, category
│       └── description               ← editable por usuario
│
├── expenses/                         ✅ IMPLEMENTADO (Sistema Dual)
│   └── {expenseId}/
│       ├── isPrimordial              ← Clasificacion principal
│       ├── category                  ← Primordial/NonPrimordial
│       ├── subcategory               ← (luz, agua, netflix)
│       ├── provider, debtDetails     ← Extensible
│       ├── serviceDetails            ← Extensible
│       ├── budgetedAmount            ← Presupuesto
│       ├── actualAmount              ← Real
│       ├── dueDayOfMonth             ← Fecha vencimiento
│       ├── status                    ← pending/partial/paid/overdue
│       ├── metadata                  ← Extensible
│       └── tags                      ← Organizacion
│
├── months/{year-month}/              ✅ IMPLEMENTADO
│   ├── transactions/                 ← Transacciones del mes
│   └── financialState/               ← Estado pre-calculado
│       ├── income, incomeBudgeted, incomeReceived, incomePending
│       ├── initialBalance, availableNow, expectedByEndOfMonth
│       ├── expenses, expensesBudgeted
│       ├── balance, budgetedBalance
│       ├── savings, savingsRate
│       ├── financialScore, healthStatus
│       └── rule50320 breakdown
│
├── categories/                       ✅ Basico
└── goals/                            ✅ Multiples metas
```

---

## 4. Sistemas Implementados

### 4.1 Ingresos (COMPLETO - Smart Recurrence Engine)

```
SISTEMA DE 8 CATEGORIAS + 28 TIPOS:
├── Activos: salary, fees, commissions, overtime
├── Pasivos: rental, interest, dividends, royalties
├── Eventuales: gratification, cts, bonus, settlement
├── Digitales: content, affiliates, digital_products, crypto
├── Transferencias: family, pension_alimony
├── Estado: subsidies, state_pension
├── Negocio: business_sales, business_services, business_investment_return
└── Otros: prize, refund, unique_income, unexpected_event, other

SMART RECURRENCE ENGINE (8 frecuencias):
├── weekly       → semana con dia configurable (Lun-Dom)
├── biweekly     → dos modos: two_dates (dias fijos) o every_15 (cada 15 dias)
├── monthly      → 3 reglas: day (dia fijo), last_day, first_weekday
├── bimonthly    → cada 2 meses
├── quarterly    → cada 3 meses
├── semi_annual  → cada 6 meses
├── annual       → mes + dia configurable
└── variable     → puntual/unico, va directo a historial

EDGE CASES CUBIERTOS:
├── clampDay()       → Feb 30 → Feb 28/29
├── isLeapYear()     → Feb 29 solo en bisiesto
├── lastDayOfMonth() → ultimo dia valido
├── firstWeekdayOfMonth() → primer Lun, primer Vie, etc.
├── generateOccurrences() → genera 6 fechas, arranca desde hoy si startDate paso
├── calculatePaymentStatus() → overdue/upcoming/scheduled/received/pending
├── safety counter en bucle → max 100 iteraciones
└── detectPattern()  → detecta frecuencia desde historial de fechas

PERMANENT HISTORY LOG (incomeHistory):
├── type: transfer (verde) → cuando se marca como recibido
├── type: deletion (rojo)  → cuando se elimina fuente
├── type: reactivation (ambar) → cuando se reactiva desde historial
├── description editable inline
└── coleccion plana (no por mes), ordenada por date+time desc

DASHBOARD INTEGRATION:
├── actualIncome = suma de transacciones reales (ingresos positivos)
├── configuredIncome = suma de montos de fuentes activas
├── monthlyReceived = de transacciones, no de source.actualAmount
├── Chart.js: balance chart (linea diaria), comparacion income vs expenses (barra)
├── Mini sparklines: income, expenses, savings (6 meses de historial)
└── Income popups rotator cada 5s: alertas de pagos proximos/atrasados/tips

UI FEATURES:
├── Filter pills por categoria (8 categorias + "Todos")
├── Tabs: Fuentes Activas | Historial
├── Categoria "Otros" → auto-recibido, solo historial, sin tab Fuentes Activas
├── Modal confirmacion personalizado (verde) para marcar recibido
├── Modal eliminacion (rojo) con advertencia "No se puede deshacer"
├── Modal editar (ambar) avisando que ya fue recibido
├── Modal reactivar (ambar) desde entries de deletion
├── Processing signal bloquea doble click en todas las acciones
├── Amount validation: solo numeros, error "No es un monto valido"
├── Glassmorphism: rgba(255,255,255,0.08), backdrop-filter blur(16px)
└── OnPush change detection con computed signals

EJEMPLO:
{
  "category": "active",
  "type": "salary",
  "name": "Sueldo Empresa ABC",
  "amount": 2500,
  "recurrence": {
    "frequency": "monthly",
    "startDate": "2026-01-15",
    "monthlyRule": { "kind": "day", "day": 15 }
  },
  "nextOccurrences": ["2026-05-15", "2026-06-15", "2026-07-15"],
  "paymentStatus": { "status": "upcoming", "nextDate": "2026-05-15", "daysUntil": 2, "isLate": false },
  "alertBeforeDays": 3,
  "isActive": true
}

INGRESO CONFIGURADO: S/ 2,500 (suma de fuentes activas)
INGRESO REAL: S/ 2,500 (suma de transacciones income del mes)
```

### 4.2 Gastos (COMPLETO - Sistema Dual)

```
CLASIFICACIÓN:
├── GASTOS PRIMORDIALES (esenciales)
│   ├── 🏠 Vivienda (alquiler/hipoteca)
│   ├── 💡 Servicios (luz, agua, internet, gas)
│   ├── 🚌 Transporte
│   ├── 🏥 Salud (EPS, seguros)
│   ├── 🏦 Deudas
│   ├── 🛒 Supermercado
│   └── 📚 Educación
│
└── GASTOS NO PRIMORDIALES (opcionales)
    ├── 🍔 Comida fuera
    ├── 🎬 Entretenimiento
    ├── 📺 Streaming
    ├── 🐕 Mascotas
    ├── 👕 Ropa
    └── ✈️ Viajes

ESTADOS DE PAGO:
├── pending    ← Por pagar
├── partial   ← Pagado parcialmente
├── paid      ← Pagado completo
├── overdue   ← Vencido
└── cancelled ← Cancelado

CAMPOS EXTENSIBLES:
├── providerDetails    ← Proveedor, contrato, plan
├── debtDetails       ← Tipo deuda, acreedor, tasa interés
├── serviceDetails    ← Tipo servicio, lecturas, consumo
├── metadata          ← Cualquier campo adicional
└── tags              ← Organización
```

### 4.3 Flujo de Caja (COMPLETO)

```
CÁLCULOS INCLUIDOS:
├── Ingreso presupuestado (total esperado)
├── Ingreso recibido hasta ahora
├── Ingreso pendiente
├── Balance inicial
├── Disponible ahora (inicial + recibido - gastos)
├── Balance presupuestado (esperado al final)
├── Balance real (disponible ahora - gastos)
└── Savings rate (% ahorrado)
```

### 4.4 Onboarding Adaptativo (COMPLETO - BACKEND)

```
SEGÚN TIPO DE EMPLEO:
├── employee        → Salary, deducciones, beneficios
├── freelancer      → Ingreso promedio, clientes, frecuencia
├── business_owner  → Ingresos del negocio, ganancias
├── retired         → Pensión, AFP
├── student         → Mesada, beca, trabajo parcial
├── unemployed      → Ahorros, apoyo familiar
└── other           → Otro tipo de ingreso

PREGUNTAS COMUNES:
├── Edad
├── Metas financieras
├── Inversiones actuales
└── Prioridad financiera
```

---

## 5. Próximos Pasos (Roadmap)

### Alta Prioridad:
1. Budgets por categoria (presupuesto vs real)
2. Gastos UI upgrade (smart recurrence, Chart.js, history log similar a income)

### Media Prioridad:
3. Alertas activas en UI (rotator similar a income popups)
4. Calendario de pagos proximos
5. Recordatorios de vencimiento

### Baja Prioridad:
6. Analytics persistidos
7. Insights automaticos
8. Deteccion de transacciones recurrentes
9. OCR de recibos
10. Open Banking

---

## 6. Cómo Expandir el Sistema

**El sistema es extensible** - ver `docs/expansion-guide.md` para:
- Agregar nuevas categorías sin romper
- Agregar detalles a proveedores/deudas/servicios
- Agregar metadatos personalizados

---

## 7. Modelos de Datos

### Modelos principales:
- `Transaction` - Transacciones financieras
- `IncomeSource` - Fuentes de ingreso con recurrencia inteligente (RecurrenceRule, 8 frecuencias)
- `RecurrenceRule` - Motor de recurrencia: frequency, startDate, weeklyDays, biweeklyMode, monthlyRule, annualMonth/Day
- `IncomeCategory` - 8 categorias: active, passive, eventual, digital, transfer, state, business, other
- `IncomeType` - 28 tipos: salary, fees, commissions, rental, dividends, etc.
- `IncomeHistoryEntry` - Log permanente: transfer/deletion/reactivation con date+time
- `MonthlyIncome` - Agregacion mensual: byCategory, predictions, totals
- `Expense` - Gastos con clasificacion dual
- `SavingGoal` - Metas de ahorro
- `OnboardingResponse` - Respuestas de onboarding

### Servicios principales:
- `FirebaseService` - Conexion Firestore
- `TransactionService` - Transacciones (CRUD completo)
- `IncomeService` - Ingresos con smart recurrence, CRUD + markAsReceived + incomeHistory
- `ExpenseService` - Sistema dual de gastos
- `BudgetService` - Presupuestos por categoria
- `GoalService` - Metas de ahorro multiples
- `ComparisonService` - Comparativas mensuales
- `AlertsService` - Alertas centralizadas
- `MonthRolloverService` - Gestion automatica de meses
- `ReportService` - Exportacion de datos
- `OfflineSyncService` - Sincronizacion offline
- `OnboardingService` - Onboarding adaptativo
- `AuthService` - Autenticacion

---

## 8. Servicios Backend Agregados (v2.1)

### 8.1 ComparisonService
**Ubicación**: `src/app/core/services/comparison.ts`

Servicio para comparar datos financieros entre meses.

```typescript
// Obtener comparación mes actual vs anterior
const comparison = await comparisonService.getMonthComparison(2026, 5);
// Returns: { currentMonth, previousMonth, income, expenses, balance, savings, byCategory, healthComparison }

// Obtener tendencia de últimos 3 meses
const trend = await comparisonService.getTrendSummary(2026, 5, 3);
// Returns: { months[], averageIncome, averageExpenses, averageSavings, incomeTrend, expenseTrend }
```

### 8.2 AlertsService
**Ubicación**: `src/app/core/services/alerts.ts`

Servicio centralizado de alertas financieras.

```typescript
// Obtener todas las alertas del mes
const alerts = await alertsService.getAllAlerts(2026, 5);
// Returns: Alert[] con type, severity, title, message

// Resumen de alertas por severidad
const summary = await alertsService.getAlertSummary(2026, 5);
// Returns: { total, critical, high, medium, low }
```

**Tipos de alertas**:
- `overdue_expense` - Gasto vencido
- `budget_exceeded` - Presupuesto excedido
- `budget_at_risk` - Presupuesto en riesgo
- `income_pending` - Ingreso pendiente
- `income_overdue` - Ingreso vencido
- `goal_behind_schedule` - Meta atrasada
- `high_spending_category` - Categoría de alto gasto
- `low_savings_rate` - Tasa de ahorro baja

### 8.3 MonthRolloverService
**Ubicación**: `src/app/core/services/month-rollover.service.ts`

Servicio para gestión automática de meses.

```typescript
// Verificar/crear mes actual
const result = await rolloverService.checkAndRollover();

// Hacer rollover a un mes específico
const rollover = await rolloverService.rolloverToNewMonth(2026, 6);
// Returns: { success, previousMonth, newMonth, budgetsCopied, expensesCopied, recurringGenerated }

// Obtener todos los meses del usuario
const months = await rolloverService.getUserMonths();
```

### 8.4 TransactionService (Actualizado)
**Ubicación**: `src/app/core/services/transaction.ts`

CRUD completo de transacciones.

```typescript
// Create
const tx = await transactionService.create(payload);

// Read
const txs = await transactionService.getByMonth(2026, 5);

// Update
const updated = await transactionService.update(id, payload);

// Delete
await transactionService.delete(id);
```

### 8.5 ReportService
**Ubicación**: `src/app/core/services/report.service.ts`

Servicio de reportes y exportación de datos.

```typescript
// Generar reporte de transacciones
const report = await reportService.generateReport({
  type: 'transactions',
  format: 'csv',
  year: 2026,
  month: 5
});

// Exportar a CSV
await reportService.exportTransactionsCSV(2026, 5);

// Exportar reporte completo JSON
await reportService.exportFullReportJSON(2026, 5);

// Descargar archivo
reportService.downloadReport(report);
```

**Tipos de reporte**: `transactions`, `income`, `expenses`, `budgets`, `goals`, `full`
**Formatos**: `csv`, `json`, `pdf`

### 8.6 OfflineSyncService
**Ubicación**: `src/app/core/services/offline-sync.service.ts`

Servicio de sincronización offline con IndexedDB.

```typescript
// Sincronizar desde Firebase al cache local
await offlineService.syncFromFirebase(2026, 5);

// Obtener datos (usa cache si está disponible, fallback a Firebase)
const transactions = await offlineService.getDataWithFallback('transactions', 2026, 5);

// Estado de sincronización
const status = offlineService.getStatus();
// Returns: { lastSynced, pendingChanges, isOnline, isSyncing }

// Sincronizar cambios pendientes
const result = await offlineService.syncPendingChanges();
// Returns: { synced: number, failed: number }

// Limpiar cache
await offlineService.clearCache();
```

**Características**:
- Cache local con IndexedDB
- Sincronización automática cuando vuelve a estar online
- Cola de cambios pendientes para offline
- Fallback a Firebase cuando hay conexión

---

**Ultima actualizacion**: Mayo 2026  
**Estado**: 100% del sistema completo implementado (incluyendo UI de Dashboard e Income) ✅