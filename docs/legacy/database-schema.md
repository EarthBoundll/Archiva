# Estructura de Datos NoSQL - Track Pays
## Base de datos Firestore (NoSQL - Document Store)

---

## DIAGRAMA GENERAL

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FIRESTORE: track-pays                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  users/{userId} ─────────────────────────────────────────────────────────────  │
│       │                                                                           │
│       ├── profile                                                                  │
│       │    └── data { age, employmentType, monthlyIncome, currency, locale,      │
│       │               onboardingCompleted, initialBalance, ... }                │
│       │                                                                           │
│       ├── incomeSources/{sourceId} ──────────────────────────────────────────   │
│       │    { category, type, name, amount, recurrence, nextOccurrences,         │
│       │      paymentStatus, isActive, actualAmount, lastReceivedDate,           │
│       │      alertBeforeDays, autoCreateTransaction, deductions, notes, ... }   │
│       │                                                                           │
│       ├── incomeHistory/{entryId} ───────────────────────────────────────────   │
│       │    { sourceId, sourceName, type, amount, date, time,                    │
│       │      category, description }                                           │
│       │                                                                           │
│       ├── expenses/{expenseId} ──────────────────────────────────────────────   │
│       │    { isPrimordial, category, subcategory, name, provider,                │
│       │      budgetedAmount, actualAmount, dueDayOfMonth, status,               │
│       │      isRecurring, frequency, isSubscription, isVariable, ... }          │
│       │                                                                           │
│       ├── goals/{goalId} ────────────────────────────────────────────────────   │
│       │    { name, category, targetAmount, currentAmount, monthlyContribution,  │
│       │      priority, status, monthsToGoal, projectedCompletionDate,           │
│       │      contributions[], ... }                                            │
│       │                                                                           │
│       ├── categories/{categoryId} ──────────────────────────────────────────   │
│       │    OBSOLETO (no se usa)                                              │
│       │                                                                           │
│       └── months/{monthId} ──────────────────────────────────────────────────   │
│            │                                                                       │
│            ├── transactions/{transactionId}                                      │
│            │    { amount, description, date, type, category, ruleType,          │
│            │      deletedAt, ... }                                              │
│            │                                                                       │
│            ├── budgets/{category}                                                │
│            │    { categoryName, isPrimordial, budgetedAmount, actualAmount,     │
│            │      remainingAmount, percentageUsed, status, alertThreshold,       │
│            │      history[], ... }                                               │
│            │                                                                       │
│            └── financialState                                                    │
│                 { income, incomeBudgeted, expenses, balance, savings,           │
│                   savingsRate, financialScore, healthStatus, rule50320,         │
│                   lastUpdated }                                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ NoSQL vs Relacional

| Característica | SQL (Relacional) | NoSQL (Firestore) |
|----------------|------------------|-------------------|
| Estructura | Tablas | Colecciones |
| Registros | Filas | Documentos |
| Primary Key | ID auto-incremental | ID automático |
| Relaciones | Foreign Keys | Referencias o embebido |
| Joins | SELECT con JOIN | No existen |
| Queries | SQL flexible | Limitadas por colección |

**En Firestore:**
- No hay "relaciones" como tal
- Se accede a subcolecciones directamente
- Las "relaciones" son conceptuales (jerarquía)
- No hay joins - cada query es a una colección específica

---

## 📋 COLECCIONES Y SUS CAMPOS

### 1. users/{userId}/profile/data
| Campo | Tipo | Descripción |
|-------|------|-------------|
| email | string | Email del usuario |
| fullName | string | Nombre completo |
| age | number | Edad |
| employmentType | string | Tipo de empleo |
| monthlyIncome | number | Ingreso mensual objetivo |
| currency | string | Moneda (PEN) |
| locale | string | Locale (es-PE) |
| initialBalance | number | Balance inicial |
| onboardingCompleted | boolean | Si completó onboarding |
| onboardingVersion | number | Versión del onboarding |
| createdAt | string | Fecha de creación |
| updatedAt | string | Fecha de actualización |

---

### 2. users/{userId}/incomeSources/{sourceId}

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | string | ID de la fuente |
| userId | string | UID del usuario |
| category | IncomeCategory | active/passive/eventual/digital/transfer/state/business/other |
| type | IncomeType | salary/fees/commissions/overtime/rental/... (28 tipos) |
| name | string | Nombre (ej: "Sueldo Empresa") |
| description | string? | Descripcion opcional |
| amount | number | Monto presupuestado |
| actualAmount | number? | Monto recibido realmente (se setea en markAsReceived) |
| currency | string | Moneda (default: "PEN") |
| recurrence | RecurrenceRule | { frequency, startDate, weeklyDays?, biweeklyMode?, biweeklyDates?, monthlyRule?, annualMonth?, annualDay?, endDate? } |
| nextOccurrences | string[] | Proximas 6 fechas calculadas ["2026-05-15", "2026-06-15", ...] |
| lastReceivedDate | string? | Ultima fecha de ingreso recibido (YYYY-MM-DD) |
| paymentStatus | PaymentStatus | { status, nextDate, daysUntil, isLate } |
| alertBeforeDays | number? | Dias antes para alertar (min 1, default 3) |
| autoCreateTransaction | boolean? | Crear transaccion al recibir |
| deductions | object? | { afpPercent?, insurancePercent?, fifthCategoryPercent?, otherDeductions? } |
| isActive | boolean | Si esta activa |
| notes | string? | Notas adicionales |
| createdAt | string | Fecha de creacion |
| updatedAt | string | Fecha de actualizacion |

**RecurrenceRule (sub-objeto):**
```
{
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semi_annual' | 'annual' | 'variable',
  startDate: string (YYYY-MM-DD),
  weeklyDays?: number[],             // [1=Lun, 2=Mar, ..., 0=Dom]
  biweeklyMode?: 'two_dates' | 'every_15',
  biweeklyDates?: [number, number],  // ej: [15, 30]
  monthlyRule?: { kind: 'day', day: number }
              | { kind: 'last_day' }
              | { kind: 'first_weekday', weekday: number },
  annualMonth?: number,              // 0-11
  annualDay?: number,                // 1-31
  endDate?: string | null
}
```

**PaymentStatus (sub-objeto):**
```
{
  status: 'scheduled' | 'upcoming' | 'overdue' | 'received' | 'pending',
  nextDate: string | null,
  daysUntil: number | null,
  isLate: boolean
}
```

**IncomeCategory (enum):** `'active' | 'passive' | 'eventual' | 'digital' | 'transfer' | 'state' | 'business' | 'other'`

**IncomeType (28 valores):**
- **active:** salary, fees, commissions, overtime
- **passive:** rental, interest, dividends, royalties
- **eventual:** gratification, cts, bonus, settlement
- **digital:** content, affiliates, digital_products, crypto
- **transfer:** family, pension_alimony
- **state:** subsidies, state_pension
- **business:** business_sales, business_services, business_investment_return
- **other:** prize, refund, unique_income, unexpected_event, other

**Relacion**: Un usuario puede tener MULTIPLES incomeSources

---

### 3. users/{userId}/incomeHistory/{entryId}

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | string | ID del entry |
| sourceId | string | ID de la fuente de ingreso relacionada |
| sourceName | string | Nombre de la fuente al momento del evento |
| type | string | transfer/deletion/reactivation |
| amount | number | Monto involucrado |
| date | string | Fecha local (YYYY-MM-DD) |
| time | string | Hora local (HH:mm) |
| category | string | Categoria al momento del evento |
| description | string | Nota editable por el usuario |

**Relacion**: Un usuario puede tener MULTIPLES entries en su historial. La coleccion es plana (no por mes) y se ordena por fecha+tiempo descendente desde el cliente.

---

### 4. users/{userId}/expenses/{expenseId}

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| id | string | ID del gasto |
| userId | string | UID del usuario |
| isPrimordial | boolean | true=esencial, false=no esencial |
| category | string | Categoría (housing/utilities/streaming/etc) |
| subcategory | string | Subcategoría (alquiler/luz/netflix) |
| name | string | Nombre del gasto |
| provider | string | Proveedor |
| budgetedAmount | number | Monto presupuestado |
| actualAmount | number | Monto real pagado |
| dueDayOfMonth | number | Día de vencimiento |
| status | string | pending/partial/paid/overdue/cancelled |
| isRecurring | boolean | Si es recurrente |
| frequency | string | weekly/biweekly/monthly/quarterly/yearly |
| isSubscription | boolean | Si es suscripción |
| subscriptionPrice | number | Precio de suscripción |
| isVariable | boolean | Si el monto varía (luz/agua) |
| dangerThreshold | number | % que activa alerta |
| tags | string[] | Tags personalizados |
| metadata | object | Metadatos adicionales |
| createdAt | string | Fecha de creación |
| updatedAt | string | Fecha de actualización |

**Relación**: Un usuario puede tener MÚLTIPLES expenses

---

### 5. users/{userId}/goals/{goalId}
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | ID de la meta |
| userId | string | UID del usuario |
| name | string | Nombre de la meta |
| description | string | Descripción |
| category | string | emergency/travel/vehicle/house/education/etc |
| targetAmount | number | Monto objetivo |
| currentAmount | number | Monto actual ahorrado |
| monthlyContribution | number | Aporte mensual |
| targetDate | string | Fecha objetivo |
| monthsToGoal | number | Meses hasta la meta |
| projectedCompletionDate | string | Fecha proyectada |
| priority | string | high/medium/low |
| status | string | active/completed/paused/cancelled |
| isCompleted | boolean | Si está completada |
| contributions | object[] | Historial de contribuciones |
| tags | string[] | Tags |
| createdAt | string | Fecha de creación |
| updatedAt | string | Fecha de actualización |

**Relación**: Un usuario puede tener MÚLTIPLES goals

---

### 6. users/{userId}/months/{monthId}
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | YYYY-MM (ej: 2026-05) |
| year | number | Año |
| month | number | Mes (1-12) |
| status | string | active/archived |
| createdAt | string | Fecha de creación |
| updatedAt | string | Fecha de actualización |

**Relación**: Un usuario tiene UN documento por CADA mes

---

### 7. users/{userId}/months/{monthId}/transactions/{transactionId}
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | ID de la transacción |
| userId | string | UID del usuario |
| type | string | income/expense |
| amount | number | Monto (positivo=ingreso, negativo=gasto) |
| description | string | Descripción |
| date | string | Fecha de la transacción |
| category | string | Categoría |
| ruleType | string | need/want/saving/income (50/30/20) |
| deletedAt | string | Si fue eliminada (soft delete) |
| createdAt | string | Fecha de creación |
| updatedAt | string | Fecha de actualización |

**Relación**: Un mes puede tener MÚLTIPLES transactions

---

### 8. users/{userId}/months/{monthId}/budgets/{category}
| Campo | Tipo | Descripción |
|-------|------|-------------|
| category | string | Categoría del presupuesto |
| userId | string | UID del usuario |
| categoryName | string | Nombre para mostrar |
| isPrimordial | boolean | Si es primordial |
| budgetedAmount | number | Monto presupuestado |
| actualAmount | number | Monto gastado |
| remainingAmount | number | Monto restante |
| percentageUsed | number | Porcentaje usado |
| status | string | on_track/at_risk/exceeded/unused |
| alertThreshold | number | Umbral de alerta (default: 80) |
| isActive | boolean | Si está activo |
| year | number | Año |
| month | number | Mes |
| history | object[] | Historial de cambios |
| createdAt | string | Fecha de creación |
| updatedAt | string | Fecha de actualización |

**Relación**: Un mes tiene UN presupuesto por CADA categoría

---

### 9. users/{userId}/months/{monthId}/financialState
| Campo | Tipo | Descripción |
|-------|------|-------------|
| income | number | Ingresos reales del mes |
| incomeBudgeted | number | Ingresos presupuestados |
| incomeReceived | number | Ingresos recibidos |
| incomePending | number | Ingresos pendientes |
| initialBalance | number | Balance inicial |
| availableNow | number | Disponible ahora |
| expectedByEndOfMonth | number | Esperado a fin de mes |
| expenses | number | Gastos reales |
| expensesBudgeted | number | Gastos presupuestados |
| balance | number | Balance real |
| budgetedBalance | number | Balance presupuestado |
| savings | number | Ahorro real |
| savingsRate | number | Tasa de ahorro % |
| financialScore | number | Puntuación financiera (0-100) |
| healthStatus | string | excellent/good/warning/critical |
| rule50320 | object | Breakdown 50/30/20 |
| lastUpdated | string | Fecha de última actualización |

**Relación**: UN documento por mes (pre-calculado)

---

## 🔗 JERARQUÍA (NoSQL - No hay relaciones reales)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         ESTRUCTURA JERARQUICA                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   userId (root)                                                            │
│       │                                                                     │
│       ├──► profile (documento)                                             │
│       │                                                                     │
│       ├──► incomeSources (subcoleccion)                                    │
│       │      └── documentos individuales                                   │
│       │                                                                     │
│       ├──► incomeHistory (subcoleccion)                                    │
│       │      └── documentos individuales (log permanente)                 │
│       │                                                                     │
│       ├──► expenses (subcoleccion)                                         │
│       │      └── documentos individuales                                   │
│       │                                                                     │
│       ├──► goals (subcoleccion)                                           │
│       │      └── documentos individuales                                   │
│       │                                                                     │
│       └──► months (subcoleccion)                                           │
│              └── {monthId} (documento mes)                                 │
│                   │                                                        │
│                   ├──► transactions (sub-subcoleccion)                    │
│                   ├──► budgets (sub-subcoleccion)                          │
│                   └──► financialState (documento)                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 ESTRUCTURA DE COLECCIONES (NoSQL)

```
users/{userId}/
├── profile/data                 ← 1 documento
├── incomeSources/              ← N documentos (coleccion)
├── incomeHistory/              ← N documentos (log permanente, plana)
├── expenses/                   ← N documentos (coleccion)
├── goals/                      ← N documentos (coleccion)
└── months/{monthId}/           ← N documentos (coleccion)
    ├── transactions/           ← N documentos
    ├── budgets/                ← N documentos (uno por categoria)
    └── financialState          ← 1 documento
```

**Nota**: En NoSQL no existe "cardinalidad". 
La "relación" es solo la ruta de acceso: `users/{uid}/months/2026-05/transactions`

---

## 🔄 FLUJO DE DATOS

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Onboard    │ ───► │   Income     │ ───► │  Financial   │
│   Service    │      │   Sources    │      │   State      │
└──────────────┘      └──────────────┘      └──────┬───────┘
                                                   │
                                                   ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Goals      │ ◄─── │  Expenses &  │ ◄─── │   Budgets    │
│   Service    │      │ Transactions │      │   Service    │
└──────────────┘      └──────┬───────┘      └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Reports    │
                    │   Service    │
                    └──────────────┘
```

---

## 📁 SERVICIOS Y SUS COLECCIONES

| Servicio | Coleccion Principal | Operaciones |
|----------|---------------------|-------------|
| AuthService | - | Autenticacion |
| FirebaseService | TODAS | CRUD completo |
| TransactionService | months/{id}/transactions | CRUD + calculos |
| IncomeService | incomeSources, incomeHistory | CRUD + mensual + smart recurrence + markAsReceived |
| ExpenseService | expenses | CRUD + monthly |
| BudgetService | months/{id}/budgets | CRUD + summary |
| GoalService | goals | CRUD + contribuciones |
| ComparisonService | financialState | Lectura |
| AlertsService | expenses/budgets/goals/income | Lectura |
| ReportService | Todas | Lectura + export |
| OfflineSyncService | IndexedDB | Cache + sync |

---

## 🎯 ÍNDICES Y CONSULTAS COMUNES

```javascript
// Consultas frecuentes
users/{uid}/incomeSources        where isActive == true
users/{uid}/incomeHistory        todas (orden client-side por date+time desc)
users/{uid}/expenses            where status in [pending, partial]
users/{uid}/goals               where status == active orderBy priority
users/{uid}/months/{id}/transactions  orderBy date desc
users/{uid}/months/{id}/budgets       orderBy isPrimordial desc
```

---

**Ultima actualizacion**: Mayo 2026  
**Total colecciones**: 9 principales + subcolecciones
**Total documentos por usuario**: Hasta ~100+ (transacciones, expenses, goals, budgets, incomeSources, incomeHistory)