# 📁 ANÁLISIS Y REESTRUCTURACIÓN DEL PROYECTO - Track Pays

## Estado: Mayo 2026

---

## 1. PROBLEMAS IDENTIFICADOS

### 1.1 Código Muerto (No usado en ninguna parte)

| Carpeta/Archivo | Estado | Problema |
|-----------------|--------|----------|
| `src/app/features/` | ❌ NO USADO | DashboardFacade duplica funcionalidad |
| `src/app/core/stores/` | ❌ NO USADO | AppState no se usa en ningún lugar |
| `shared/components/pie-chart/` | ❌ NO USADO | Nunca importado |
| `shared/components/bar-chart/` | ❌ NO USADO | Nunca importado |
| `shared/components/progress-bar/` | ❌ NO USADO | Nunca importado |
| `shared/components/fab-button/` | ❌ NO USADO | Nunca importado |
| `shared/components/category-picker/` | ❌ NO USADO | Nunca importado |
| `shared/pipes/currency-sol-pipe/` | ❌ NO USADO | Dashboard usa su propio método |

### 1.2 Tests Vacíos o Inútiles

| Archivo | Estado |
|---------|--------|
| `*.spec.ts` en pages/ | La mayoría vacíos o mínimos |
| `*.spec.ts` en services/ | La mayoría vacíos o mínimos |

### 1.3 Pages Actuales (Solo 4)

| Página | Estado | Backend usado |
|--------|--------|---------------|
| `login/` | ✅ Funcional | Auth |
| `dashboard/` | ⚠️ Parcial | Transaction + Goal (datos hardcoded) |
| `transactions/` | ⚠️ Parcial | Transaction + Category |
| `goal/` | ⚠️ Parcial | Goal (1 meta hardcoded) |

---

## 2. ESTRUCTURA ACTUAL vs ESTRUCTURA ÓPTIMA

### 2.1 Estructura ACTUAL (con problemas)

```
src/app/
├── features/                 ❌ ELIMINAR - No usado
│   └── dashboard/
│       └── services/
│           └── dashboard.facade.ts
├── core/
│   ├── stores/              ❌ ELIMINAR - No usado
│   │   └── app-state.ts
│   ├── services/            ✅ MANTENER
│   ├── models/               ✅ MANTENER
│   └── guards/               ✅ MANTENER
├── pages/                    ✅ MANTENER (las 4 que se usan)
├── shared/
│   ├── components/          ⚠️ ELIMINAR los no usados
│   └── pipes/                ⚠️ ELIMINAR si no se usa
└── app/
    ├── app.routes.ts         ✅ MANTENER
    ├── app.config.ts         ✅ MANTENER
    └── app.ts                ✅ MANTENER
```

### 2.2 Estructure ÓPTIMA (propuesta)

```
src/app/
├── core/                             ✅ BACKEND - Sin cambios
│   ├── services/                    (12 servicios)
│   ├── models/                      (7 modelos)
│   └── guards/                      (auth-guard)
│
├── pages/                           ✅ UI ACTUAL
│   ├── login/                       (login, register)
│   ├── dashboard/                   (main view)
│   ├── transactions/                (list & manage)
│   ├── goal/                        (savings goals)
│   ├── budget/                      (PRESUPESTOS - por crear)
│   ├── alerts/                      (ALERTAS - por crear)
│   └── insights/                    (COMPARATIVAS - por crear)
│
├── shared/                           ✅ SHARED
│   └── pipes/
│       └── format-sol.pipe.ts       (single pipe)
│
└── app/                             ✅ CONFIG
    ├── app.routes.ts
    ├── app.config.ts
    └── app.ts
```

---

## 3. PLAN DE LIMPIEZA

### 3.1 Eliminar (Código Muerto)

```bash
# Eliminar features/ (no usado)
Remove-Item -Recurse src/app/features/

# Eliminar stores/ (no usado)
Remove-Item -Recurse src/app/core/stores/

# Eliminar componentes no usados
Remove-Item -Recurse src/app/shared/components/pie-chart/
Remove-Item -Recurse src/app/shared/components/bar-chart/
Remove-Item -Recurse src/app/shared/components/progress-bar/
Remove-Item -Recurse src/app/shared/components/fab-button/
Remove-Item -Recurse src/app/shared/components/category-picker/

# Eliminar pipes no usados
Remove-Item -Recurse src/app/shared/pipes/
```

### 3.2 Mantener (Estructura limpia)

```
src/app/
├── core/
│   ├── services/
│   │   ├── auth.ts
│   │   ├── firebase.ts
│   │   ├── transaction.ts
│   │   ├── income.ts
│   │   ├── expense.ts
│   │   ├── budget.ts
│   │   ├── goal.ts
│   │   ├── comparison.ts       [NUEVO]
│   │   ├── alerts.ts           [NUEVO]
│   │   ├── month-rollover.service.ts [NUEVO]
│   │   ├── report.service.ts   [NUEVO]
│   │   └── offline-sync.service.ts [NUEVO]
│   ├── models/
│   │   ├── transaction.model.ts
│   │   ├── income.model.ts
│   │   ├── expense.model.ts
│   │   ├── budget.model.ts
│   │   ├── goal.model.ts
│   │   ├── onboarding.model.ts
│   │   └── category.model.ts
│   └── guards/
│       └── auth-guard.ts
│
├── pages/
│   ├── login/
│   ├── dashboard/
│   ├── transactions/
│   ├── goal/
│   (las 4 pages actuales)
│
├── shared/
│   (vacío por ahora - sin componentes usados)
│
└── app/
    ├── app.routes.ts
    ├── app.config.ts
    └── app.ts
```

---

## 4. PÁGINAS PARA FRONTEND (FUTURO)

Según el análisis de frontend y la visión del producto, las páginas necesarias son:

| Página | Propósito | Servicios a usar |
|--------|-----------|------------------|
| **Dashboard** | "¿Cómo estoy?" en 10 seg | Todos los servicios |
| **Transactions** | Lista de transacciones | Transaction, Category |
| **Budgets** | Presupuesto por categoría | BudgetService |
| **Goals** | Metas de ahorro | GoalService |
| **Alerts** | Centro de alertas | AlertsService |
| **Insights** | Comparativas y tendencias | ComparisonService |
| **Settings** | Perfil y configuración | Onboarding, Profile |

---

## 5. ACTUALIZACIÓN DE DOCUMENTACIÓN

Tras la reorganización, actualizar:

1. **docs/project-structure.md** - Nueva estructura del proyecto
2. **docs/backend-analysis-and-methodology.md** - Sin referencias a código muerto
3. **docs/frontend-analysis.md** - Estructura de pages actualizada

---

## 6. RESUMEN DE CAMBIOS

| Acción | Cantidad |
|--------|----------|
| Carpetas eliminadas | 8 |
| Archivos eliminados | ~50 |
| Servicios mantenidos | 12 |
| Modelos mantenidos | 7 |
| Pages activas | 4 (+ 3 por crear) |

---

**Nota**: Esta reorganización prepara el proyecto para el desarrollo frontend eficiente, eliminando confusión y código innecesario.