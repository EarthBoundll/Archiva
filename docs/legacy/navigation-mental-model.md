# Navigation Mental Model — Track Pays

## Introducción

La navegación en Track Pays no se diseñó desde una perspectiva técnica (rutas, URLs, componentes), sino desde una perspectiva **mental y emocional**. La pregunta fundamental es: ¿qué necesita saber el usuario financiero en cada momento de su experiencia?

Este documento define el modelo mental de navegación que guía todas las decisiones de UX relacionadas con cómo el usuario se mueve por la aplicación.

---

## El Modelo Mental del Usuario Financiero

### La pregunta central

Cada usuario financiero, conscientemente o no, opera con un mental model que responde a esta pregunta:

> **"¿Dónde estoy, hacia dónde voy, y qué debo hacer ahora?"**

Track Pays traduce esta pregunta en una estructura de navegación que responde a las variaciones de esta pregunta:

| Contexto | Pregunta Mental | Navegación Principal |
|----------|-----------------|----------------------|
| Inicio de sesión | "¿Entro a mi espacio?" | Login → Dashboard |
| Revisión rápida | "¿Cómo estoy este mes?" | Dashboard |
| Búsqueda de detalle | "¿Qué pasó exactamente?" | Transacciones |
| Análisis profundo | "¿Por qué estoy gastando así?" | Analytics (futuro) |
| Planeación | "¿Voy hacia mi meta?" | Goals |
| Acción inmediata | "¿Cómo agrego un gasto?" | Quick Entry (desde cualquier lado) |

---

## Arquitectura de Navegación por Intención

### Nivel 1: Navegación Principal (Barra de Navegación)

La barra de navegación principal representa las **intenciones principales** del usuario. No son "páginas" — son **estados mentales**.

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAVEGACIÓN PRINCIPAL                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   💰 Dashboard    │   📋 Transacciones    │    🎯 Metas        │
│                                                                  │
│   "¿Cómo estoy?"  │   "¿Qué pasó?"        │   "¿Voy bien?"    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Las 3 secciones principales**:

1. **Dashboard** — El estado "estoy bien" o "hay problema"
   - Intención: Revisión rápida, confirmación de status
   - Frecuencia: Alta (varias veces por semana)
   - Profundidad: Superficial (resumen)

2. **Transacciones** — El estado "quiero ver qué pasó"
   - Intención: Investigación de detalles
   - Frecuencia: Media (1-3x por semana)
   - Profundidad: Detallada (historial completo)

3. **Metas** — El estado "estoy ahorrando para algo"
   - Intención: Confirmación de progreso
   - Frecuencia: Baja (1x por semana o menos)
   - Profundidad: Mediana (stats + configuración)

### Nivel 2: Navegación Secundaria (Acciones Rápidas)

La navegación secundaria representa **acciones que el usuario toma desde cualquier punto** sin cambiar su contexto principal.

```
┌─────────────────────────────────────────────────────────────────┐
│                    NAVEGACIÓN SECUNDARIA                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   [+] Quick Entry         │    Buscar        │    Ajustes      │
│   (desde cualquier lado)  │    (buscar tx)   │    (perfil)     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Funciones secundarias**:

- **Quick Entry**: Agregar transacción sin salir del contexto actual
- **Buscar**: Encontrar transacciones específicas
- **Ajustes**: Configuración de perfil, preferencias

### Nivel 3: Navegación Contextual (Dentro de Features)

La navegación contextual permite moverse **dentro de un feature** sin perder el contexto.

```
┌─────────────────────────────────────────────────────────────────┐
│                   NAVEGACIÓN CONTEXTUAL                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Dashboard → Ver todas las transacciones → Transacciones      │
│   Dashboard → Ver detalles de meta → Goals                     │
│   Transacciones → Ver movimiento específico → Detail modal    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo Psicológico por Sección

### Flujo 1: El Usuario Entra al Dashboard

**Estado emocional esperado**: Neutral o ligeramente ansioso ("¿cómo estará mi plata?")

**Journey**:

```
1. Llega al Dashboard
   → Ve el Balance prominently
   → Decisión inmediata: "Estoy bien" o "Tengo problema"

2. Si "estoy bien":
   → Puede sentirse Conforme
   → Quizás revisa la regla 50/30/20 (curiosidad)
   → Quizás revisa la meta (motivación)
   → Cierra la app

3. Si "tengo problema":
   → Puede sentir leve preocupación
   → Quiere entender el problema
   → Puede ir a Transacciones a investigar
   → O usar Quick Entry para ajustar

4. Quick Entry está siempre disponible:
   → Si necesita registrar algo inmediatamente
   → No tiene que navegar a otra página
```

**Principio UX**: El Dashboard debe permitir una **evaluación en menos de 10 segundos**. Si el usuario necesita más tiempo, algo está mal.

---

### Flujo 2: El Usuario Explora Transacciones

**Estado emocional**:Curiosidad / Investigación ("¿en qué gasté?")

**Journey**:

```
1. Llega a Transacciones
   → Ve el filtro de mes activo
   → Ve resumen del período

2. Explora la lista:
   → Agrupada por fecha (natural para el cerebro)
   → Cada item muestra: qué, cuándo, cuánto

3. Puede interactuar con cada transacción:
   → Editar (si equivocó algo)
   → Eliminar (si fue un error)
   → Ver detalle (si quiere más contexto)

4. Puede cambiar el filtro:
   → Cambiar de mes
   → Filtrar por tipo (ingreso/gasto)
   → Ver todos los tipos

5. Si necesita agregar algo:
   → Quick Entry sigue disponible
```

**Principio UX**: Las transacciones son **información histórica**. El usuario no debería necesitar más que 3 taps para encontrar lo que busca.

---

### Flujo 3: El Usuario Revisa sus Metas

**Estado emocional**: Motivación / Compromiso ("¿estoy ahorrando bien?")

**Journey**:

```
1. Llega a Goals
   → Ve el progreso prominently
   → Ve los meses restantes
   → Ve la fecha estimada

2. Explora los detalles:
   → Hitos alcanzados
   → Escenarios (qué pasa si cambio mi aporte)
   → Stats del mes

3. Si quiere ajustar:
   → Editar aporte mensual
   → Editar meta total
   → Ver impacto de los cambios

4. Conexión con Dashboard:
   → Desde Dashboard puede ver un resumen de la meta
   → Un tap para ver detalles completos en Goals
```

**Principio UX**: Las metas son **motivacionales**. La interfaz debe comunicar progreso, no presión.

---

## Navegación y Emotion Flow

### Mapa de Emociones por Sección

```
                    ┌─────────────────────────────────┐
                    │           LOGIN                  │
                    │   Emoción: Esperanza / Anxiety  │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │         DASHBOARD               │
                    │   Emoción: Confirmación / Alerta │
                    │   Tiempo: < 10 segundos          │
                    └────────────┬────────────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
           ▼                     ▼                     ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │TRANSACCIONES│      │    GOALS     │      │QUICK ENTRY   │
    │Curiosidad   │      │Motivación   │      │Acción       │
    │Investigación│      │Compromiso   │      │Inmediatez   │
    └─────────────┘      └─────────────┘      └─────────────┘
```

### Reglas de Transición Emocional

1. **Login → Dashboard**: De esperanza → a confirmación clara
   - El usuario viene con expectativa, debe salir con claridad

2. **Dashboard → Transacciones**: De resumen → a detalle
   - El usuario vio que hay algo que investigar, ahora investiga

3. **Dashboard → Goals**: De status → a compromiso
   - El usuario confirmó que está bien, ahora ve hacia dónde va

4. ** Cualquier lugar → Quick Entry**: De contexto → a acción
   - El usuario tiene algo que registrar, lo hace inmediatamente

---

## Jerarquía de Navegación

### Priority Matrix

| Posición | Elemento | Prioridad | Razón |
|----------|----------|-----------|-------|
| 1 | Balance del mes | Critical | Responde la pregunta principal |
| 2 | Quick Entry | Critical | Acción más frecuente |
| 3 | Ingresos/Gastos | High | Soporte al balance |
| 4 | Regla 50/30/20 | High | Contexto de salud financiera |
| 5 | Meta de ahorro | Medium | Motivación a largo plazo |
| 6 | Transacciones recientes | Medium | Detalle rápido |
| 7 | Transacciones completo | Low | Solo cuando necesita investigar |
| 8 | Analytics | Low | Solo para usuarios power |

### Reglas de Prioridad en UI

- **Priority 1-3**: Siempre visibles en la vista principal
- **Priority 4-5**: Visibles con scroll, una sección
- **Priority 6-7**: Accesibles con navegación, no en Dashboard
- **Priority 8**: Feature futuro, no disponible aún

---

## Navegación en Diferentes Contextos

### Contexto 1: Usuario Primerizo (Día 1-7)

```
Usuario nuevo → Login → Dashboard vacío → Quick Entry
                                              │
                    ┌─────────────────────────┼────────────┐
                    │                         │            │
                    ▼                         ▼            ▼
              Transacciones              Goals       Configuración
              (empezar a agregar)    (configurar)   (nombre, income)
```

**Navegación para nuevos**: Priorizar el registro de primera transacción y la configuración de income.

### Contexto 2: Usuario Regular (Semana 2+)

```
Dashboard → Balance → Quick Entry (si necesita)
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   Transacciones   Goals       analytics
   (revisar)      (revisar)    (explorar - si tiene tiempo)
```

**Navegación para regulares**: El flujo es revisión rápida + acción ocasional.

### Contexto 3: Usuario con Problema (Gastos excesivos)

```
Dashboard → Ve alerta de gasto → Transacciones (investigar)
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              Ver patrones      Editar presupuesto   Goals
              en Analytics      (si disponible)    (reducir gasto)
```

**Navegación para problemas**: El flujo guía de la identificación a la acción.

---

## Quick Entry: El Centro de la Navegación

### Por qué Quick Entry es Central

El Quick Entry no es solo "un feature más" — es el **punto de acción más frecuente** y debe estar disponible desde cualquier lugar.

**Accesibilidad**:

- Visible como FAB en todas las páginas principales
-Keyboard shortcut en desktop (Ctrl/Cmd + N)
- Un tap para abrir, máximo 5 segundos para registrar

**Flujo**:

```
1. Usuario toca [+] en cualquier lugar
   → Modal con numpad abre
   → Monto es lo primero que ingresa
   → Luego opcional: categoría, descripción, fecha
2. Usuario toca "Guardar"
   → Transacción guardada
   → Modal cierra
   → Feedback: "Gasto registrado. Ahora llevas X%..."
3. Usuario vuelve a lo que estaba haciendo
   → No perdió su lugar
```

**Principio UX**: Quick Entry es **sincrónico** con el flujo del usuario. No interrumpe, complementa.

---

## Navegación Desktop vs Mobile

### Desktop

```
┌─────────────────────────────────────────────────────────────────┐
│  SIDEBAR                          │   MAIN CONTENT              │
│  ─────────────────                │   ─────────────────────    │
│  [Logo]                           │   Dashboard / Transactions │
│                                   │   / Goals / Analytics      │
│  Dashboard ────────────────────►  │                            │
│  Transacciones ────────────────►  │                            │
│  Goals ────────────────────────►  │                            │
│  Analytics ────────────────────►  │                            │
│                                   │                            │
│  [User Avatar]                    │                            │
│  [Logout]                         │                            │
└─────────────────────────────────────────────────────────────────┘
```

- Sidebar permanente
- Quick Entry en header (botón, no FAB)
- Más espacio para información

### Mobile

```
┌─────────────────────────────────────────────────────────────────┐
│  TOP BAR: Logo + Ajustes                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MAIN CONTENT                                                   │
│  (Dashboard / Transactions / Goals / Analytics)                │
│                                                                 │
│                                                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  BOTTOM NAV: DASHBOARD │ TRANSACTIONS │ GOALS │ [+ QUICK]      │
└─────────────────────────────────────────────────────────────────┘
```

- Bottom navigation con tabs
- Quick Entry en el centro de los tabs (destacado)
- Una mano puede hacer todo

---

## Casos Edge y Navegación

### Edge 1: Sin transacciones aún

```
Dashboard: Muestra mensaje friendly + CTA para primer registro
           "Aún no hay movimientos. Registra tu primer gasto."
           [Agregar transacción] → Quick Entry
```

### Edge 2: Meta no configurada

```
Goals: Muestra mensaje + CTA para configurar
       "Configura tu primera meta de ahorro."
       [Crear meta] → Form de meta
```

### Edge 3: Error de conexión

```
Transacciones: Muestra error friendly + opción de reintentar
               "No pudimos cargar tus transacciones."
               [Reintentar] / [Ver última versión guardada]
```

### Edge 4: Sesión expirada

```
Cualquier página: Redirect a Login con mensaje
                 "Tu sesión expiró. Ingresa de nuevo."
                 Login → Volver a donde estaba (si es posible)
```

---

## Implementación de la Navegación

### Route Structure (Técnica)

```typescript
// La estructura de rutas refleja la estructura mental
const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Nivel de autenticación
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login')
  },

  // Nivel protegido
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard'),
    canActivate: [authGuard]
  },
  {
    path: 'transactions',
    loadComponent: () => import('./features/transactions'),
    canActivate: [authGuard]
  },
  {
    path: 'goals',
    loadComponent: () => import('./features/goals'),
    canActivate: [authGuard]
  },

  // Fallback
  { path: '**', redirectTo: 'dashboard' }
];
```

### Navigation State (Señales)

```typescript
// Sistema de tracking de navegación
@Injectable({ providedIn: 'root' })
export class NavigationState {
  private _currentRoute = signal<string>('dashboard');
  private _previousRoute = signal<string>('');
  private _history = signal<string[]>([]);

  navigate(route: string): void {
    this._previousRoute.set(this._currentRoute());
    this._currentRoute.set(route);
    this._history.update(h => [...h, route]);
  }

  goBack(): string | null {
    const history = this._history();
    if (history.length < 2) return null;
    const previous = history[history.length - 2];
    this._currentRoute.set(previous);
    return previous;
  }
}
```

---

## Resumen Ejecutivo

El modelo mental de navegación de Track Pays se basa en:

1. **Intención sobre estructura**: Cada sección responde a una pregunta mental del usuario
2. **Jerarquía clara**: Dashboard (resumen) → Transacciones (detalle) → Goals (compromiso)
3. **Quick Entry central**: La acción más frecuente disponible desde cualquier lugar
4. **Flujo emocional**: Las transiciones entre secciones siguen estados emocionales lógicos
5. **Context-switching mínimo**: El usuario nunca pierde su lugar al tomar acciones secundarias
6. **Adaptación responsive**: Desktop usa sidebar, mobile usa bottom tabs

La navegación no es un mapa técnico — es un **mapa cognitivo** que permite al usuario responder sus preguntas financieras sin fricción.