# Income Page — Issues Log

Registro de issues identificados y resueltos en la página de Income.

**Fecha de auditoría:** Julio 2026  
**Archivos auditados:** `income.ts`, `income.html`, `income.scss`, `income.service.ts`

---

## Issue 1: `now` congelado al inicio

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/pages/income/income.ts`  
**Líneas afectadas:** 95-96, 222

### Problema

`now = new Date()` se asignaba una vez al instanciar el componente. `currentMonth` se derivaba de ese valor estático. Si el usuario tenía la página abierta cuando cambiaba de mes, el label del mes y los datos cargados quedaban desactualizados.

### Solución

- `now` convertido de propiedad estática a `signal<Date>`
- `currentMonth` convertido a `computed` que lee `this.now()`
- `loadData()` hace `this.now.set(new Date())` al inicio para refrescar

### Cambios

```typescript
// ANTES:
now = new Date();
currentMonth = this.now.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

// DESPUÉS:
now = signal(new Date());
currentMonth = computed(() => this.now().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }));
```

```typescript
// En loadData():
// ANTES:
const now = this.now;

// DESPUÉS:
this.now.set(new Date());
const now = this.now();
```

---

## Issue 2: Sin búsqueda por nombre

**Estado:** ✅ Resuelto  
**Archivos:** `income.ts`, `income.html`, `income.scss`, `lucide-icons.ts`

### Problema

Solo existía filtro por categoría (pills). No había forma de buscar una fuente de ingreso por nombre. Con 15+ fuentes, encontrar una específica requería escanear toda la lista manualmente.

### Solución

- Agregado icono `search` al registro de Lucide icons
- Agregado signal `searchQuery` para guardar el texto de búsqueda
- Agregados computeds `searchedSources` y `searchedHistorySources` que filtran por nombre
- Agregado input de búsqueda con icono lupa y botón de limpiar
- El template usa los computed filtrados en vez de los originales

### Archivos modificados

| Archivo | Cambios |
|---|---|
| `src/app/core/utils/lucide-icons.ts` | +1 icono `"search"` |
| `src/app/pages/income/income.ts` | +1 signal `searchQuery`, +2 computeds |
| `src/app/pages/income/income.html` | +1 bloque search bar, 8 reemplazos en template |
| `src/app/pages/income/income.scss` | +~55 líneas: `.search-bar` y `.search-clear` |

### Funcionalidad

- Input de búsqueda con icono lupa entre los pills y el contenido
- Filtra fuentes activas e historial por nombre (case-insensitive)
- Botón X para limpiar búsqueda
- Empty state muestra "para [búsqueda]" cuando no hay resultados
- Focus ring verde consistente con el design system
- Tabs muestran el conteo filtrado

---

## Issue 3: Catch-up solo muestra primer source

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/pages/income/income.ts`, `income.html`, `income.scss`

### Problema

Al cargar, el modal de catch-up solo se abría para `missedSources[0]` (la primera fuente con pagos no confirmados). Si el usuario hacía "Omitir" o confirmaba, las demás fuentes se ignoraban hasta la próxima carga de página.

### Solución

- Agregado signal `catchUpQueue` para manejar la cola de fuentes pendientes
- Agregado signal `catchUpConfirmedCount` para contar confirmaciones
- Agregado computed `showCatchUpProgress` para el badge "X de Y"
- `loadData()` guarda todos los missed sources en la cola
- `confirmCatchUp()` saca el primero de la cola y abre el siguiente
- `skipCatchUp()` saca el primero y abre el siguiente (o cierra si está vacía)
- Badge "X de Y" en el título del modal muestra progreso
- Toast resumen al terminar la cola

### Flujo final

```
loadData() detecta 3 fuentes con missed
  → catchUpQueue = [FuenteA, FuenteB, FuenteC]
  → Abre modal para FuenteA ("1 de 3")

Usuario confirma FuenteA
  → catchUpQueue = [FuenteB, FuenteC], confirmedCount = 1
  → Abre modal para FuenteB ("2 de 3")

Usuario omite FuenteB
  → catchUpQueue = [FuenteC], confirmedCount = 1
  → Abre modal para FuenteC ("3 de 3")

Usuario confirma FuenteC
  → catchUpQueue = [], confirmedCount = 2
  → loadData() + toast: "2 de 3 pagos confirmados"
```

---

## Issue 4: updateDescription sin debounce

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/pages/income/income.ts`

### Problema

Cada tecla en el input de descripción del historial disparaba `updateDescription()` que ejecutaba `firebaseService.updateIncomeHistory()` — un `setDoc` con merge a Firestore. Escribir "Pago de enero" (16 caracteres) generaba **16 escrituras a Firestore**.

### Solución

- Importar `Subject`, `debounceTime`, `distinctUntilChanged` de RxJS
- Crear `descriptionSubject` que recibe las entradas
- Suscripción en `ngOnInit()` con `debounceTime(500)` — espera 500ms después de la última tecla
- `distinctUntilChanged` evita escrituras si el texto no cambió
- `ngOnDestroy()` completa el Subject para limpiar la suscripción

### Cambios

```typescript
// NUEVO: Subject para debounce
private descriptionSubject = new Subject<{ entry: IncomeHistoryEntry; description: string }>();

// En ngOnInit():
this.descriptionSubject.pipe(
  debounceTime(500),
  distinctUntilChanged((prev, curr) => prev.description === curr.description)
).subscribe(({ entry, description }) => {
  this.saveDescription(entry, description);
});

// updateDescription() ahora solo emite:
updateDescription(entry: IncomeHistoryEntry, description: string) {
  this.descriptionSubject.next({ entry, description });
}

// saveDescription() es el que realmente escribe a Firestore:
private async saveDescription(entry: IncomeHistoryEntry, description: string) {
  const userId = this.authService.getUserId();
  if (!userId) return;
  try {
    await this.firebaseService.updateIncomeHistory(userId, entry.id, { description });
  } catch (e: any) {
    console.error('Error updating history description:', e);
  }
}
```

---

## Issue 5: `confirm()` y `alert()` nativos

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/pages/income/income.ts`

### Problema

| Línea | Llamada | Problema |
|---|---|---|
| 508 | `alert('Error al guardar: ' + e.message)` | Alert nativo del navegador, rompe design system |
| 515 | `confirm('¿Eliminar...?')` en `deleteSource()` | Confirm nativo + método es dead code (template usa `openDeleteAlert()`) |

### Solución

- **`alert()` línea 508:** Reemplazado con `this.showErrorToast()` — usa el sistema de toast existente
- **`deleteSource()` líneas 514-522:** Eliminado completamente — es dead code, el template llama `openDeleteAlert()` → `confirmDelete()`

### Cambios

```typescript
// ANTES (línea 508):
alert('Error al guardar: ' + e.message);

// DESPUÉS:
this.showErrorToast('Error al guardar: ' + (e.message || 'Error desconocido'));

// ELIMINADO: método deleteSource() completo (era dead code)
```

---

## Issue 6: Doble enriquecimiento por confirmación

**Estado:** ✅ Resuelto  
**Archivos:** `src/app/core/services/income.ts`, `src/app/pages/income/income.ts`

### Problema

En `loadData()`, `incomeService.getAll()` enriquece N fuentes (1ra vez), y luego `incomeService.getMonthlyIncome()` internamente llama `getActive()` → `getAll()` que enriquece las mismas N fuentes de nuevo (2da vez). Cada enriquecimiento ejecuta `generateOccurrences()` + `calculatePaymentStatus()` para cada fuente.

### Solución

- `getMonthlyIncome()` ahora acepta un parámetro opcional `preloadedSources`
- Si se pasan sources, los usa directamente en vez de llamar `getActive()` → `getAll()` → `enrich()`
- `loadData()` ahora primero obtiene los sources, luego los pasa a `getMonthlyIncome()`
- **Resultado:** 1 pasada de enriquecimiento en vez de 2

### Cambios

```typescript
// income.service.ts — ANTES:
async getMonthlyIncome(year: number, month: number): Promise<MonthlyIncome> {
  ...
  const sources = await this.getActive();  // ← llama getAll() internamente
  ...
}

// income.service.ts — DESPUÉS:
async getMonthlyIncome(year: number, month: number, preloadedSources?: IncomeSource[]): Promise<MonthlyIncome> {
  ...
  const sources = preloadedSources ?? (await this.getActive());  // ← usa los pre-cargados si existen
  ...
}

// income.ts (componente) — ANTES:
const [sources, monthly, txs] = await Promise.all([
  this.incomeService.getAll(),
  this.incomeService.getMonthlyIncome(now.getFullYear(), now.getMonth() + 1),
  this.transactionService.getByMonth(now.getFullYear(), now.getMonth() + 1)
]);

// income.ts (componente) — DESPUÉS:
const sources = await this.incomeService.getAll();
const [monthly, txs] = await Promise.all([
  this.incomeService.getMonthlyIncome(now.getFullYear(), now.getMonth() + 1, sources),
  this.transactionService.getByMonth(now.getFullYear(), now.getMonth() + 1)
]);
```

---

## Issue 7: Sin sort explícito en historial de movimientos

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/pages/income/income.ts`

### Problema

`filteredHistory()` solo filtraba por categoría sin re-ordenar. Aunque Firebase ya ordenaba por fecha descendente, no había garantía de que el orden se mantuviera después del filtro.

### Solución

- Agregado `.sort()` explícito al final de `filteredHistory()` computed
- Ordena por `date` descendente, luego por `time` descendente
- Garantiza orden correcto sin importar el orden de Firebase

### Cambios

```typescript
// ANTES:
filteredHistory = computed(() => {
  const cat = this.selectedCategory();
  const history = this.incomeHistory();
  if (cat === 'all') return history;
  return history.filter(entry => entry.category === cat);
});

// DESPUÉS:
filteredHistory = computed(() => {
  const cat = this.selectedCategory();
  const history = this.incomeHistory();
  const filtered = cat === 'all' ? history : history.filter(entry => entry.category === cat);
  return filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));
});
```

---

## Resumen de issues resueltos

| # | Issue | Estado | Archivos modificados |
|---|---|---|---|
| 1 | `now` congelado al inicio | ✅ | `income.ts` |
| 2 | Sin búsqueda por nombre | ✅ | `income.ts`, `income.html`, `income.scss`, `lucide-icons.ts` |
| 3 | Catch-up solo muestra primer source | ✅ | `income.ts`, `income.html`, `income.scss` |
| 4 | updateDescription sin debounce | ✅ | `income.ts` |
| 5 | `confirm()` y `alert()` nativos | ✅ | `income.ts` |
| 6 | Doble enriquecimiento por confirmación | ✅ | `income.ts`, `income.service.ts` |
| 7 | Sin sort explícito en historial | ✅ | `income.ts` |
| 8 | startDate no incluido en ocurrencias | ✅ | `income.model.ts` |
| 9 | annualMonth comment incorrecto (1-indexed vs 0-indexed) | ✅ | `income.model.ts` |
| 10 | UTC date shift en generateOccurrences() | ✅ | `income.model.ts`, `income.ts`, `income.service.ts`, `dashboard.ts`, `goal.model.ts` |
| 11 | Botón de confirmar no desaparece después de marcar recibido | ✅ | `income.model.ts`, `income.service.ts` |
| 12 | `autoCreateTransaction` nunca se verificaba | ✅ | `income.service.ts` |
| 13 | `deductions` no se usaba en cálculos | ✅ | `income.service.ts` |
| 14 | `markAsReceived()` writes sin error handling | ✅ | `income.service.ts` |
| 15 | `openAddModal()` no reseteaba `editingQuick` | ✅ | `income.ts` |
| 16 | `getFrequencyLabel` faltaban 3 casos | ✅ | `income.ts` |
| 17 | Falta `OnDestroy` en implements | ✅ | `income.ts` |
| 18 | `loadData()` sin catch block | ✅ | `income.ts` |
| 19 | Errores silenciosos en delete/reopen/toggle | ✅ | `income.ts` |

---

## Issue 8: startDate no se incluye como primera ocurrencia

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/core/models/income.model.ts`  
**Líneas afectadas:** 334-355

### Problema

`generateOccurrences()` empezaba el cursor en `startDate` pero llamaba `nextOccurrence()` que siempre avanzaba la fecha. El `startDate` (la primera fecha de pago del usuario) nunca se incluía en el array de ocurrencias.

### Ejemplo

```
Usuario crea ingreso quincenal con startDate = 15 julio 2026
Fechas generadas: [29 jul, 13 ago, 27 ago, ...]
El 15 de julio NUNCA apareció
```

### Solución

- Si `startDate >= today`, se incluye como primera ocurrencia
- Se crea helper `localIsoDate()` para formato local (no UTC)

```typescript
if (startDate >= today) {
  results.push(localIsoDate(startDate));
  cursor = new Date(startDate);
  cursor.setDate(cursor.getDate() + 1);
}
```

---

## Issue 9: annualMonth comment incorrecto

**Estado:** ✅ Resuelto  
**Archivo:** `src/app/core/models/income.model.ts`  
**Líneas afectadas:** 53

### Problema

El comentario decía `2 = febrero` (1-indexed), pero el código y el formulario usan 0-indexed (0=enero, 1=febrero).

### Solución

Comentario corregido a: `0 = enero, 1 = febrero, ... 11 = diciembre`

---

## Issue 10: UTC date shift en toISOString()

**Estado:** ✅ Resuelto  
**Archivos:** `income.model.ts`, `income.ts`, `income.service.ts`, `dashboard.ts`, `goal.model.ts`

### Problema

`toISOString()` usa UTC. En Perú (UTC-5), si la fecha local es 10 julio 23:30, UTC la convierte a 11 julio 04:30 → el ISO string sería `"2026-07-11"` en vez de `"2026-07-10"`.

### Solución

Reemplazado `toISOString().split('T')[0]` con formato local:
```typescript
`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
```

Archivos corregidos:
- `income.model.ts`: `localIsoDate()` helper + `generateOccurrences()`
- `income.ts`: `localToday()` helper + form defaults
- `income.service.ts`: `localToday()` helper + migration fallback
- `dashboard.ts`: `localToday()` helper + quickDate defaults
- `goal.model.ts`: `calculateProjectedDate()`

---

## Issue 11: Botón de confirmar no desaparece después de marcar recibido

**Estado:** ✅ Resuelto  
**Archivos:** `income.model.ts`, `income.service.ts`

### Problema

Después de confirmar un pago, el botón de confirmar seguía apareciendo. Si el usuario lo presionaba otra vez, se generaba otra transacción duplicada.

### Causa raíz

En `markAsReceived()`, el código avanzaba `startDate` solo +1 día después del pago:

```
Pago: 15 julio → startDate avanza a: 16 julio
generateOccurrences() genera: [16 jul, 16 ago, ...]
calculatePaymentStatus() ve: 16 jul = "mañana" → status: 'upcoming'
Botón: SIGUE APARECIENDO ❌
```

El check de `lastReceivedDate >= chosenDate` nunca funcionaba porque `chosenDate` siempre era >= `lastReceivedDate + 1`.

### Solución

Usar `nextOccurrence()` para obtener la **siguiente ocurrencia real** después del pago, en vez de +1 día:

```
Pago: 15 julio → nextOccurrence() calcula: 15 agosto
startDate avanza a: 15 agosto
generateOccurrences() genera: [15 ago, 15 sep, ...]
calculatePaymentStatus() ve: 15 agosto > hoy → status: 'scheduled'
Botón: DESAPARECE ✅
```

### Cambios

```typescript
// ANTES:
paid.setDate(paid.getDate() + 1);
updatedRecurrence.startDate = `${paidYear}-${paidMonth}-${paidDay}`;

// DESPUÉS:
const nextAfterPaid = nextOccurrence(updatedRecurrence, paid);
if (nextAfterPaid) {
  updatedRecurrence.startDate = `${y}-${m}-${d}`;
}
```

También se exportó `nextOccurrence()` del modelo para poder usarlo en el service.

---

## Resumen de issues adicionales resueltos (Alta prioridad)

| # | Issue | Estado | Archivos modificados |
|---|---|---|---|
| 12 | `autoCreateTransaction` nunca se verificaba | ✅ | `income.service.ts` |
| 13 | `deductions` no se usaba en cálculos de MonthlyIncome | ✅ | `income.service.ts` |
| 14 | `markAsReceived()` — 3 writes sin error handling individual | ✅ | `income.service.ts` |
| 15 | `openAddModal()` no reseteaba `editingQuick` | ✅ | `income.ts` |
| 16 | `getFrequencyLabel` faltaban 3 casos | ✅ | `income.ts` |
| 17 | Falta `OnDestroy` en implements | ✅ | `income.ts` |
| 18 | `loadData()` sin catch block | ✅ | `income.ts` |
| 19 | Errores silenciosos en delete/reopen/toggle | ✅ | `income.ts` |

---

## Issue 12: `autoCreateTransaction` — flag muerto

**Estado:** ✅ Resuelto  
**Archivo:** `income.service.ts:264-265`

### Problema

El checkbox "Crear transacción automática al recibir" se guardaba en Firebase pero `markAsReceived()` siempre creaba la transacción sin verificar el flag.

### Solución

```typescript
// ANTES:
if (actualAmount && actualAmount > 0) {

// DESPUÉS:
if (source.autoCreateTransaction && actualAmount && actualAmount > 0) {
```

---

## Issue 13: `deductions` — no se usaba en cálculos

**Estado:** ✅ Resuelto  
**Archivo:** `income.service.ts:125-147`

### Problema

Los descuentos (AFP, seguro, quinta categoría) se guardaban en onboarding pero `getMonthlyIncome()` reportaba montos brutos. Un usuario con AFP 13% y seguro 4% veía un ingreso inflado ~17%.

### Solución

Se agrega cálculo de deducciones en el loop de `getMonthlyIncome()`:

```typescript
let deductionsTotal = 0;
if (source.deductions) {
  if (source.deductions.afpPercent) deductionsTotal += budgeted * (source.deductions.afpPercent / 100);
  if (source.deductions.insurancePercent) deductionsTotal += budgeted * (source.deductions.insurancePercent / 100);
  // ... other deductions
}
const netBudgeted = Math.max(0, budgeted - deductionsTotal);
```

---

## Issue 14: `markAsReceived()` — writes sin error handling

**Estado:** ✅ Resuelto  
**Archivo:** `income.service.ts:255-295`

### Problema

Si el write 1 (source) succeed pero write 2 (transaction) falla, el ingreso aparece como recibido pero el saldo no se actualiza. Los 3 writes no tenían try/catch individual.

### Solución

- Write 1 (source update): crítico, se propaga el error
- Write 2 (transaction): non-critical, catch con console.error
- Write 3 (history): non-critical, catch con console.error
- Fix adicional: `actualAmount || null` → `actualAmount ?? null` para preservar `0`

---

## Issue 15: `openAddModal()` — no reseteaba `editingQuick`

**Estado:** ✅ Resuelto  
**Archivo:** `income.ts:372`

### Problema

Si editabas un income rápido y luego abrías "Agregar", el form de recurrencia se ocultaba porque `editingQuick` quedaba en `true` de la sesión anterior.

### Solución

```typescript
openAddModal(category?) {
  this.editingSource.set(null);
  this.editingQuick.set(false);  // ← AGREGADO
  ...
}
```

---

## Issue 16: `getFrequencyLabel` — 3 casos faltantes

**Estado:** ✅ Resuelto  
**Archivo:** `income.ts:923-935`

### Problema

`bimonthly`, `quarterly`, `semi_annual` caían al default "Mensual" — incorrecto.

### Solución

Agregados los 3 casos:
```typescript
case 'bimonthly': return 'Bimestral';
case 'quarterly': return 'Trimestral';
case 'semi_annual': return 'Semestral';
```

---

## Issue 17: Falta `OnDestroy` en implements

**Estado:** ✅ Resuelto  
**Archivo:** `income.ts:40`

### Solución

```typescript
// ANTES:
export class IncomeComponent implements OnInit {

// DESPUÉS:
export class IncomeComponent implements OnInit, OnDestroy {
```

---

## Issue 18: `loadData()` — sin catch block

**Estado:** ✅ Resuelto  
**Archivo:** `income.ts:319-322`

### Problema

Si Firebase fallaba, el usuario veía una página en blanco sin error.

### Solución

Agregado catch con toast:
```typescript
} catch (e) {
  console.error('Error loading income data:', e);
  this.showErrorToast('Error al cargar datos. Verifica tu conexión.');
} finally {
```

---

## Issue 19: Errores silenciosos en delete/reopen/toggle

**Estado:** ✅ Resuelto  
**Archivo:** `income.ts` (3 métodos)

### Problema

`confirmDelete`, `proceedReopen`, `toggleActive` solo hacían `console.error()` sin mostrar toast al usuario.

### Solución

Agregado `showErrorToast()` en los catch blocks de los 3 métodos.
