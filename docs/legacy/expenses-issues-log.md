# Expenses Page — Issues Log

Registro de issues identificados y resueltos en la página de Expenses.

**Fecha de auditoría:** Julio 2026  
**Archivos auditados:** `expenses.ts`, `expenses.html`, `expenses.scss`, `expense.ts` (service), `expense.model.ts`

---

## Issue 1: Metadata no se guarda en edición

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/pages/expenses/expenses.ts`  
**Líneas afectadas:** 1870-1882

### Problema

En `saveExpense()`, el path de edición nunca enviaba `metadata` en el payload. Aunque `openEditModal()` cargaba los metadata en el form (línea 1807), y el HTML los renderiza (líneas 479-513), al guardar se descartaban.

### Solución

- Agregado `metadata: metadata || undefined` al payload de edición
- Agregado `as any` al type cast para permitir el campo

### Cambios

```typescript
// ANTES (línea 1871-1882):
if (editing) {
  await this.expenseService.update(editing.id, {
    name: this.formName,
    budgetedAmount: amount,
    // ... otros campos ...
    // ← no hay metadata aquí
  });
}

// DESPUÉS:
if (editing) {
  await this.expenseService.update(editing.id, {
    name: this.formName,
    budgetedAmount: amount,
    // ... otros campos ...
    metadata: metadata || undefined  // NUEVO
  } as any);
}
```

---

## Issue 2: Sin botones de editar/eliminar en UI

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/pages/expenses/expenses.html`  
**Líneas afectadas:** 78-88 (pending grid), 143-158 (category grid)

### Problema

Los métodos `openEditExpense()`, `openDeleteAlert()`, y `canDeleteExpense()` existían en el componente TS pero NUNCA se llamaban desde el HTML. No había botones de editar/eliminar en las filas de gastos.

### Solución

- Agregado botón de editar (ícono lápiz) en cada `compact-row`
- Agregado botón de eliminar (ícono trash) condicional con `canDeleteExpense()`
- Ambos botones solo aparecen para gastos no pagados
- Agregados en 2 secciones: pending grid (top) y category grid (main)

### Cambios

```html
<!-- ANTES: solo botón de pagado -->
<button class="btn-icon success btn-tiny" (click)="openConfirmPaid(exp)">
  <app-icon name="check" [size]="12"></app-icon>
</button>

<!-- DESPUÉS: pagado + editar + eliminar -->
<button class="btn-icon success btn-tiny" (click)="openConfirmPaid(exp)">
  <app-icon name="check" [size]="12"></app-icon>
</button>
<button class="btn-icon btn-tiny" (click)="openEditExpense(exp)" title="Editar">
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  </svg>
</button>
@if (canDeleteExpense(exp)) {
  <button class="btn-icon danger btn-tiny" (click)="openDeleteAlert(exp)" title="Eliminar">
    <app-icon name="trash-2" [size]="12"></app-icon>
  </button>
}
```

---

## Issue 3: Sin renovación automática

**Estado:** ✅ Resuelto  
**Archivos:** `src/app/core/services/expense.ts`, `src/app/pages/expenses/expenses.ts`

### Problema

Los gastos recurrentes nunca se renuevan al siguiente mes. Si pagaste Netflix en enero, en febrero sigue mostrándose como "pagado" en vez de crear un nuevo registro pendiente.

### Solución

- Nuevo método `renewRecurringExpenses()` en el service que:
  - Busca gastos recurrentes pagados del mes anterior
  - Para cada uno, crea un nuevo registro para el mes actual con `status: 'pending'`
  - Copia metadata del mes anterior
  - Evita duplicados (verifica si ya existe un renew en el mes actual)
- `loadData()` ejecuta la renovación después de cargar gastos activos

### Cambios

```typescript
// expense.ts — NUEVO método:
async renewRecurringExpenses(paidExpenses: Expense[]): Promise<void> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const exp of paidExpenses) {
    if (!exp.isRecurring || exp.frequency !== 'monthly') continue;
    // Verificar si ya fue renovado este mes
    const existing = await this.firebase.getExpenses(userId);
    const alreadyRenewed = existing.some(e =>
      e.name === exp.name && e.startDate?.startsWith(currentMonth) && e.isActive
    );
    if (alreadyRenewed) continue;

    // Crear nuevo registro para el mes actual
    await this.firebase.createExpense(userId, {
      ...exp,
      startDate: `${currentMonth}-01`,
      dueDate: `${currentMonth}-${String(exp.dueDayOfMonth).padStart(2, '0')}`,
      status: 'pending',
      actualAmount: 0,
      paymentDate: undefined,
      metadata: exp.metadata ? { ...exp.metadata } : undefined
    });
  }
}
```

```typescript
// expenses.ts — loadData() ejecuta renovación:
const paidExpenses = await this.expenseService.getAll();
const lastMonthPaid = paidExpenses.filter(e =>
  e.status === 'paid' && e.isRecurring && e.frequency === 'monthly'
);
if (lastMonthPaid.length > 0) {
  await this.expenseService.renewRecurringExpenses(lastMonthPaid);
  const refreshed = await this.expenseService.getActive();
  this.allExpenses.set(refreshed);
}
```

---

## Issue 4: isActive no se actualiza en pagados

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/core/services/expense.ts`

### Problema

Cuando se marcaba un gasto como pagado, `isActive` no se actualizaba. La query `getActiveExpenses()` traía gastos pagados innecesariamente.

### Solución

- `markAsPaid()` ahora también ejecuta `updateExpense({ isActive: false })`
- Los gastos pagados desaparecen de la lista de activos

### Cambios

```typescript
// ANTES:
async markAsPaid(expenseId: string, amount: number): Promise<void> {
  await this.firebase.markExpensePaid(userId, expenseId, amount);
}

// DESPUÉS:
async markAsPaid(expenseId: string, amount: number): Promise<void> {
  await this.firebase.markExpensePaid(userId, expenseId, amount);
  await this.firebase.updateExpense(userId, expenseId, { isActive: false } as any);
}
```

---

## Issue 5: Historial de pagos filtrado por categoría

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/pages/expenses/expenses.ts`  
**Líneas afectadas:** 1222-1235

### Problema

`paidHistory` computed filtraba por `selectedCategory()`, mostrando solo pagos de la categoría activa. El usuario esperaba ver TODO el historial de pagos, sin importar la categoría seleccionada.

### Solución

Eliminado el filtro de categoría de `paidHistory`. Ahora muestra todos los gastos pagados, agrupados por categoría, sin depender de la selección actual.

### Cambios

```typescript
// ANTES:
paidHistory = computed(() => {
  const cat = this.selectedCategory();
  let paid = this.allExpenses().filter(e => e.status === 'paid');
  if (cat) paid = paid.filter(e => e.category === cat);
  // ...
});

// DESPUÉS:
paidHistory = computed(() => {
  const paid = this.allExpenses().filter(e => e.status === 'paid');
  // ...
});
```

---

## Issue 6: Renovación no maneja gastos no pagados

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/core/services/expense.ts`  
**Líneas afectadas:** 78-131

### Problema

Si un gasto recurrente no se pagaba (ej: Netflix de enero), la renovación lo ignoraba porque solo procesaba gastos con `status === 'paid'`. El gasto viejo quedaba como "pendiente" indefinidamente, y nunca se creaba uno nuevo para el mes siguiente.

### Solución

- `renewRecurringExpenses()` ahora recibe **todos** los gastos recurrentes (no solo pagados)
- Si un gasto recurrente tiene `status !== 'paid'` y su `startDate` es de un mes anterior, se marca como `overdue`
- Se crea un **nuevo** gasto para el mes actual
- `loadData()` ahora pasa `recurringExpenses` en lugar de `lastMonthPaid`

### Ejemplo

```
📅 ENERO:
Netflix enero — S/ 30 — Pendiente ⏳

📅 FEBRERO (después del fix):
Netflix enero  — S/ 30 — Atrasado 🔴   ← el viejo
Netflix febrero — S/ 30 — Pendiente ⏳  ← el nuevo
```

### Cambios

```typescript
// ANTES:
const lastMonthPaid = paidExpenses.filter(e =>
  e.status === 'paid' && e.isRecurring && e.frequency === 'monthly'
);
if (lastMonthPaid.length > 0) {
  await this.expenseService.renewRecurringExpenses(lastMonthPaid);
}

// DESPUÉS:
const recurringExpenses = allExpenses.filter(e => e.isRecurring && e.frequency === 'monthly');
if (recurringExpenses.length > 0) {
  await this.expenseService.renewRecurringExpenses(recurringExpenses);
}
```

---

## Issue 7: tabHistory es código muerto

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/pages/expenses/expenses.ts`  
**Líneas afectadas:** 1135-1163

### Problema

`tabHistory` era un computed completo que agrupaba transacciones por fecha, pero **nunca se usaba en el HTML**. Código muerto que ocupaba espacio y mantenimiento innecesario.

### Solución

Eliminado el computed `tabHistory` completamente.

---

## Issue 8: now congelado al inicio

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/pages/expenses/expenses.ts`  
**Líneas afectadas:** 1302-1303

### Problema

`now = new Date()` se asignaba una sola vez al instanciar el componente. Si el usuario dejaba la página abierta de un mes a otro, el componente seguía mostrando el mes anterior (mismo bug que Income).

### Solución

Mismo fix que Income:
- `now` es ahora un `signal(new Date())`
- `currentMonth` es un `computed()` que lee `this.now()`
- `loadData()` ejecuta `this.now.set(new Date())` al inicio

### Cambios

```typescript
// ANTES:
now = new Date();
currentMonth = this.now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

// DESPUÉS:
now = signal(new Date());
currentMonth = computed(() => this.now().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }));

// En loadData():
this.now.set(new Date());
```

---

## Issue 9: Sin alertas de gasto variable

**Estado:** ✅ Resuelto  
**Archivos:** `firebase.ts`, `expenses.ts`, `expenses.html`, `expenses.scss`, `expense.model.ts`

### Problema

`dangerThreshold` estaba definido en el modelo pero nunca se usaba. El tipo `variable_spike` existía en `MonthlyExpenseSummary.alerts` pero nunca se generaba. No había campo en el formulario para configurar el umbral.

### Solución (Opción B — alerta al pagar)

Tres partes:

#### 1. Generación de alerta en `calculateMonthlyExpenses()` (firebase.ts)

```typescript
// Variable spike
if (e.isVariable && e.dangerThreshold && e.budgetedAmount && e.actualAmount) {
  const limit = e.budgetedAmount * (1 + e.dangerThreshold / 100);
  if (e.actualAmount > limit) {
    alerts.push({
      type: 'variable_spike',
      expenseId: e.id,
      message: `${e.name}: S/ ${e.actualAmount} supera umbral de S/ ${limit.toFixed(2)} (${e.dangerThreshold}%)`
    });
  }
}
```

#### 2. Alerta inmediata al pagar (expenses.ts)

En `confirmMarkPaid()`, después de `markAsPaid()`:

```typescript
if (expense.isVariable && expense.dangerThreshold && expense.budgetedAmount) {
  const limit = expense.budgetedAmount * (1 + expense.dangerThreshold / 100);
  if (amount > limit) {
    this.showWarningToast(`⚠️ ${expense.name}: S/ ${amount} supera umbral de S/ ${limit.toFixed(2)} (${expense.dangerThreshold}%)`);
  }
}
```

#### 3. Campo en el formulario (expenses.html)

Visible solo cuando el tipo es "Variable":

```html
@if (formType() === 'variable') {
  <div class="form-group">
    <label>Umbral de alerta (%)</label>
    <input type="number" [ngModel]="formDangerThreshold" placeholder="ej: 50" min="10" max="200">
    <small>Alerta si el gasto supera este % sobre el presupuesto</small>
  </div>
}
```

#### 4. Toast notification

- Agregado `showToast`, `toastMessage`, `toastType` signals
- Agregados métodos `showSuccessToast()`, `showWarningToast()`, `showErrorToast()`, `closeToast()`
- HTML del toast con iconos y estilos

### Ejemplo

```
Luz: S/ 100 presupuestado, umbral: 60%
Pagas S/ 180 → 180 > 100 * 1.60 = 160 → ¡ALERTA! 🚨
Toast: "⚠️ Luz: S/ 180 supera umbral de S/ 160.00 (60%)"
```

---

## Issues pendientes

| # | Issue | Prioridad | Estado |
|---|---|---|---|
| — | Todos resueltos | — | ✅ |
