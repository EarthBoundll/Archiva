# Referencia Rapida - Estructura NoSQL (Firestore)

## Estructura de Colecciones (No Relacional)

```
track-pays (Firestore)
│
└── users/{userId}/
    │
    ├── profile/data
    │   └── (datos del usuario: email, edad, empleo, moneda)
    │
    ├── incomeSources/{sourceId}
    │   └── (fuentes de ingreso con recurrencia inteligente)
    │       └── 1 usuario → N fuentes
    │
    ├── incomeHistory/{entryId}
    │   └── (log permanente de movimientos: transfer/deletion/reactivation)
    │       └── 1 usuario → N entries (coleccion plana)
    │
    ├── expenses/{expenseId}
    │   └── (gastos: primordial/no primordial)
    │       └── 1 usuario → N gastos
    │
    ├── goals/{goalId}
    │   └── (metas de ahorro)
    │       └── 1 usuario → N metas
    │
    └── months/{monthId}/          ← Formato: "2026-05"
        │
        ├── transactions/{txId}     ← 1 mes → N transacciones
        │
        ├── budgets/{category}     ← 1 mes → 1 por categoria
        │
        └── financialState         ← 1 mes → 1 documento
```

---

## Campos por Colección

### profile/data
- email, fullName, age, employmentType
- monthlyIncome, currency (PEN), locale (es-PE)
- initialBalance
- onboardingCompleted, onboardingVersion

### incomeSources
- 8 categorias (IncomeCategory): active, passive, eventual, digital, transfer, state, business, other
- 28 tipos (IncomeType): salary, fees, commissions, overtime, rental, interest, dividends, royalties, gratification, cts, bonus, settlement, content, affiliates, digital_products, crypto, family, pension_alimony, subsidies, state_pension, business_sales, business_services, business_investment_return, prize, refund, unique_income, unexpected_event, other
- name, amount, currency (PEN)
- recurrence (RecurrenceRule): { frequency, startDate, weeklyDays?, biweeklyMode?, biweeklyDates?, monthlyRule?, annualMonth?, annualDay?, endDate? }
- nextOccurrences (proximas 6 fechas calculadas)
- paymentStatus: { status: scheduled|upcoming|overdue|received|pending, nextDate, daysUntil, isLate }
- lastReceivedDate, actualAmount
- alertBeforeDays (default 3), autoCreateTransaction
- isActive, deductions (AFP/seguros), notes

### incomeHistory
- sourceId, sourceName
- type: transfer | deletion | reactivation
- amount, date, time, category
- description (editable por usuario)
- Coleccion plana (no por mes), ordenada por date+time desc

### expenses
- isPrimordial: true | false
- category: housing | utilities | transport | health | debt | groceries | education | ...
- subcategory, name, provider
- budgetedAmount, actualAmount
- dueDayOfMonth
- status: pending | partial | paid | overdue | cancelled
- isRecurring, frequency
- isSubscription, isVariable

### goals
- name, description, category
- targetAmount, currentAmount
- monthlyContribution
- monthsToGoal, projectedCompletionDate
- priority: high | medium | low
- status: active | completed | paused | cancelled
- contributions[]

### months/{monthId}
- id (YYYY-MM), year, month, status

### transactions
- type: income | expense
- amount (+ ingreso, - gasto)
- description, date, category
- ruleType: need | want | saving | income

### budgets
- category, categoryName, isPrimordial
- budgetedAmount, actualAmount, remainingAmount
- percentageUsed, status: on_track | at_risk | exceeded | unused
- alertThreshold (default: 80)
- history[]

### financialState
- income, incomeBudgeted, expenses
- balance, savings, savingsRate
- financialScore (0-100)
- healthStatus: excellent | good | warning | critical
- rule50320: { need, want, saving }

---

## Jerarquía de Acceso (NoSQL)

```
users/{userId}/                    ← Coleccion raiz
  └── incomeSources/               ← Subcoleccion
  └── incomeHistory/               ← Subcoleccion (log permanente)
  └── expenses/                   ← Subcoleccion
  └── goals/                      ← Subcoleccion
  └── months/{monthId}/           ← Subcoleccion
       └── transactions/           ← Sub-subcoleccion
       └── budgets/               ← Sub-subcoleccion
       └── financialState         ← Documento (no subcoleccion)
```

**Nota**: En NoSQL NO hay "relaciones" como en SQL. 
Las "relaciones" son solo jerarquia de acceso a subcolecciones.

---

## Ejemplo de Datos Reales

```
users/CFWogdbBvUTBLE5qSKLtB1l1wxT2/
├── profile/data
│   ├── email: "alonsopicho@gmail.com"
│   ├── currency: "PEN"
│   └── monthlyIncome: 1200
│
├── incomeSources/
│   ├── "sueldo"
│   │   ├── category: "active"
│   │   ├── type: "salary"
│   │   ├── name: "Sueldo Empresa ABC"
│   │   ├── amount: 2500
│   │   ├── recurrence: {
│   │   │     frequency: "monthly",
│   │   │     startDate: "2026-01-15",
│   │   │     monthlyRule: { kind: "day", day: 15 }
│   │   │   }
│   │   ├── nextOccurrences: ["2026-05-15","2026-06-15","2026-07-15","2026-08-15","2026-09-15","2026-10-15"]
│   │   ├── paymentStatus: { status: "upcoming", nextDate: "2026-05-15", daysUntil: 2, isLate: false }
│   │   ├── isActive: true
│   │   └── alertBeforeDays: 3
│   │
│   └── "freelance"
│       ├── category: "active"
│       ├── type: "fees"
│       ├── name: "Freelance Diseño"
│       ├── amount: 800
│       ├── recurrence: { frequency: "variable", startDate: "2026-05-01" }
│       ├── isActive: true
│       └── lastReceivedDate: "2026-05-10"
│
├── incomeHistory/
│   ├── "entry1"
│   │   ├── sourceId: "sueldo"
│   │   ├── sourceName: "Sueldo Empresa ABC"
│   │   ├── type: "transfer"
│   │   ├── amount: 2500
│   │   ├── date: "2026-05-15"
│   │   ├── time: "10:30"
│   │   ├── category: "active"
│   │   └── description: ""
│   │
│   └── "entry2"
│       ├── sourceId: "freelance_old"
│       ├── sourceName: "Freelance Web"
│       ├── type: "deletion"
│       ├── amount: 0
│       ├── date: "2026-05-10"
│       ├── time: "15:00"
│       ├── category: "active"
│       └── description: "Cliente finalizó contrato"
│
├── expenses/
│   ├── "alquiler" (category: housing, isPrimordial: true, budgetedAmount: 1200)
│   ├── "netflix" (category: streaming, isPrimordial: false)
│   └── ...
│
├── goals/
│   └── "data" (name: "Fondo de Emergencia", targetAmount: 10000, currentAmount: 2500)
│
└── months/
    └── "2026-05"/
        ├── transactions/
        │   ├── "tx1": { amount: 2500, type: "income" }
        │   ├── "tx2": { amount: -1200, type: "expense" }
        │   └── ...
        ├── budgets/
        │   ├── "housing": { budgetedAmount: 1200, actualAmount: 1200, status: "on_track" }
        │   ├── "utilities": { budgetedAmount: 350, actualAmount: 245, status: "on_track" }
        │   └── ...
        └── financialState
            ├── income: 2900
            ├── expenses: 1885
            ├── balance: 1015
            ├── savingsRate: 35
            └── financialScore: 85
```

---

**Referencia rapida para desarrollo y debugging**