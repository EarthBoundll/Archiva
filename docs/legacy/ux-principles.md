# UX Principles — Track Pays

## Introducción

Estos principios guían cada decisión de diseño en Track Pays. No son guidelines de UI — son la **filosofía de experiencia** que define cómo el producto se siente, cómo comunica, y cómo hace sentir al usuario.

Los principios están organizados en tres categorías:

1. **Principios Fundamentales** — La esencia de la experiencia
2. **Principios de Interfaz** — Cómo se ve y se comporta
3. **Principios de Interacción** — Cómo se usa

---

## Principios Fundamentales

### PF-01: Claridad Extrema

**La regla**: Cada pantalla, componente y mensaje debe comunicar una idea principal que el usuario pueda comprender en menos de 3 segundos.

**Aplicación práctica**:

- El dashboard muestra un máximo de 5 métricas principales
- Los gráficos tienen un máximo de 4 categorías visibles
- Los headers de sección responden una pregunta específica
- El texto de ayuda existe solo cuando es necesario

**Por qué importa**: La overload de información genera ansiedad y parálisis. La claridad genera confianza y acción.

**Ejemplo correcto**:
> "Gastaste S/ 1,200 en necesidades. Está dentro de tu presupuesto del 50%."

**Ejemplo incorrecto**:
> "Tus transacciones de este mes muestran un total de gastos por S/ 2,340 distribuido en 12 categorías con un promedio diario de S/ 78..."

---

### PF-02: Jerarquía Visual Intencional

**La regla**: El usuario debe saber dónde mirar primero. Siempre hay un punto focal claro.

**Aplicación práctica**:

- El balance principal siempre es el elemento más grande
- Los colores de atención (rojo/warning) se usan con moderación extrema
- El whitespace no es espacio vacío — es jerarquía
- Los headers usan siempre el mismo nivel de prominence

**Jerarquía en el dashboard**:

```
PRIMARY:     Balance del mes (lo primero que se ve)
SECONDARY:   Ingresos / Gastos (soporte al primary)
TERTIARY:    Regla 50/30/20 (análisis contextual)
QUATERNARY:  Últimos movimientos (detalle si quiere)
```

**Por qué importa**: Sin jerarquía, todo parece igual de importante. El usuario no sabe qué prestar atención.

---

### PF-03: Densidad Inteligente

**La regla**: La cantidad de información debe ser proporcional al contexto y la intención del usuario.

**Aplicación práctica**:

- **Dashboard**: Baja densidad — solo lo esencial
- **Transacciones**: Densidad media — suficiente para entender
- **Analytics**: Alta densidad — para el usuario que busca profundidad

**La regla del 80/20**: El 80% del valor debe ser accesible con el 20% del esfuerzo visual. El 20% restante está disponible pero no es necesario.

**Por qué importa**: Diferentes usuarios necesitan diferentes niveles de detalle. La densidad debe ser adaptativa, no estática.

---

### PF-04: Reducción de Ansiedad

**La regla**: La interfaz nunca debe generar ansiedad financiera. Los datos negativos se comunican con claridad pero sin alarmismo.

**Aplicación práctica**:

- **Colores**: El rojo se usa solo para advertencias críticas, no para gastos normales
- **Tono**: "Gastaste más de lo habitual" en lugar de "¡Alerta! ¡Gastas demaisado!"
- **Priorización**: Los problemas no son urgentes por defecto
- **Contexto**: Un número solo se comunica como "negativo" cuando tiene comparación

**La regla del color**:
- 🟢 Verde: Progreso, buenos resultados, metas alcanzadas
- 🔵 Azul: Información neutra, contexto
- 🟡 Amarillo: Atención, posibles problemas (no críticos)
- 🔴 Rojo: Solo para errores críticos o advertencias que requieren acción inmediata

**Por qué importa**: La ansiedad financiera es el reason principal por el que los usuarios abandonan apps de finanzas. Track Pays debe ser un espacio de calma.

---

### PF-05: Feedback Contextual

**La regla**: Cada acción del usuario genera una respuesta que proporciona contexto, no solo confirmación.

**Aplicación práctica**:

- **Registro de gasto**: "Gasto registrado. Ahora llevas 65% de tu presupuesto de necesidades."
- **Edición**: "Cambio guardado. Este mes vas S/ 150 bajo tu promedio."
- **Meta actualizada**: "Meta ajustada. Con S/ 240/mes llegarás en 8 meses."

**El ciclo de feedback**:
```
ACCIÓN → CONFIRMACIÓN → CONTEXTO → SUGERENCIA (si aplica)
```

**Por qué importa**: La confirmación sin contexto no genera aprendizaje. El contexto transforma datos en comprensión.

---

### PF-06: UX Basada en Hábitos Financieros

**La regla**: La experiencia se adapta al patrón de uso del usuario, no al revés.

**Aplicación práctica**:

- El usuario que registra gastos diario ve analytics de corto plazo
- El usuario que revisa semanalmente ve tendencias semanales
- El usuario que solo ingresa al dashboard ve resumen siempre actualizado
- La frecuencia de uso determina la complejidadvisible

**Niveles de usuario**:

- **Nivel 1 - Observador** (usa <1x/semana): Solo ve dashboard resumido
- **Nivel 2 - Participante** (usa 1-3x/semana): Ve dashboard + transacciones
- **Nivel 3 - Analista** (usa 4+x/semana): Acceso completo a analytics

**Por qué importa**: No todos los usuarios quieren lo mismo. La experiencia debe calibrate a su nivel de engagement.

---

### PF-07: UX Emocional

**La regla**: La interfaz debe generar una respuesta emocional específica: calma + control.

**Aplicación práctica**:

- **Visual**: Colores suaves, espaciado generoso, tipografía limpia
- **Interacción**: Transiciones suaves, no hay abrupt jumps
- **Tono**: Mensajes positivos, nunca accusatorios
- **Celebración**: Logros menores se reconocen (primera transacción, primera semana, primer mes)

**La emoción objetivo**:
> "Abro Track Pays y me siento más seguro sobre mis finanzas que antes."

**Por qué importa**: Las emociones determinan la retención. Una app que genera buena sensación se usa más.

---

### PF-08: Accesibilidad como Fundamento

**La regla**: La accesibilidad no es un feature opcional — es un requisito fundamental. Todo usuario debe poder usar la app.

**Aplicación práctica**:

- **Contraste**: Todas las combinaciones de color cumplen WCAG AA
- **Tipografía**: Mínimo 14px para texto, escala legible
- **Interacción**: Todos los elementos son reachable por teclado
- **Labels**: Todos los inputs tienen labels claros
- **Errores**: Los mensajes de error son específicos y accionables

**Por qué importa**: La accesibilidad beneficia a todos los usuarios, no solo a usuarios con necesidades especiales. Es diseño de calidad.

---

### PF-09: Consistencia Visual y de Comportamiento

**La regla**: Lo que parece igual debe comportarse igual. Lo que se ve diferente debe comportarse diferente.

**Aplicación práctica**:

- **Componentes**: Un button primario siempre se ve y comporta igual
- **Navegación**: Los patrones de navegación son consistentes en todas las pantallas
- **Formularios**: La validación y el feedback siguen el mismo patrón
- **Estados**: Loading, error, success, empty tienen patrones consistentes

**La regla de recognición**: El usuario debe poder predecir cómo funcionará un componente nuevo basándose en su experiencia previa.

**Por qué importa**: La inconsistencia genera friction y cognición load. La consistencia genera confianza.

---

## Principios de Interfaz

### PI-01: Reglas Visuales

**Tipografía**:

- **Familia**: Inter (primaria), sistema (fallback)
- **Tamaños**: 12px (caption), 14px (body), 16px (body-lg), 20px (h3), 24px (h2), 32px (h1)
- **Pesos**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Line height**: 1.4 para body, 1.2 para headers

**Espaciado (sistema de 4px)**:

- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- xxl: 48px

**Bordes y radios**:

- Radius pequeño: 4px (inputs, buttons pequeños)
- Radius medio: 8px (cards, modals)
- Radius grande: 12px (secciones)
- Sin radius: 0px (elementos inline)

**Sombras**:

- sm: `0 1px 2px rgba(0,0,0,0.05)` (elements sutiles)
- md: `0 4px 6px rgba(0,0,0,0.07)` (cards elevated)
- lg: `0 10px 15px rgba(0,0,0,0.1)` (modals, dropdowns)

---

### PI-02: Reglas de Color

**Paleta de colores**:

```
Primary:      #2563EB (azul confiança)
Secondary:    #64748B (gris neutro)
Success:      #10B981 (verde positivo)
Warning:      #F59E0B (amarillo atención)
Error:        #EF4444 (rojo crítico)
Background:   #FFFFFF (blanco) / #0F172A (dark)
Surface:      #F8FAFC (superficie) / #1E293B (dark-surface)
Text Primary: #1E293B (texto principal) / #F1F5F9 (dark)
Text Muted:   #64748B (texto secundario)
```

**Uso por contexto**:

- **Datos positivos** (balance, ahorro): Success green
- **Datos negativos** (gastos excesivos): Warning yellow, no rojo默认
- **Gastos normales**: Neutral, no coloreados
- **Errores del sistema**: Error red
- **Interacción**: Primary blue para actions principales

---

### PI-03: Composición de Layout

**Regla del 60-30-10**:

- 60% del espacio: Contenido principal (balance, métricas)
- 30% del espacio: Contexto (gráficos, análisis)
- 10% del espacio: Detalle (acciones, navegación)

**Regla del grid**:

- Máximo 4 columnas en desktop
- Mobile: Single column con secciones stacking
- Tablet: 2 columnas para dashboards secondary

**Densidad por sección**:

```
Dashboard:
├── Balance: alto (60%)
├── Regla 30/20: medio (20%)
└── Quick stats: bajo (20%)

Transactions:
├── Filtros: bajo (10%)
├── Resumen: medio (15%)
└── Lista: alto (75%)

Goals:
├── Progreso: alto (40%)
├── Stats: medio (30%)
└── Detalles: bajo (30%)
```

---

### PI-04: Densidad Visual

**Definición de densidades**:

- **Compact**: Más información, menos whitespace. Solo para listas largas de transacciones.
- **Comfortable**: Balance entre información y espacio. Para la mayoría de las secciones.
- **Spacious**: Menos información, más espacio. Para estados empty, mensajes de error, y dashboards resumidos.

**Regla de aplicación**:

- Listas y tablas: Compact o Comfortable
- Dashboard: Comfortable a Spacious
- Estados vacío: Spacious
- Forms: Comfortable
- Modales: Spacious

---

### PI-05: Estados Visuales

**Cada componente debe tener estados claros**:

| Estado | Definición | Visual |
|--------|------------|--------|
| Default | Estado normal | Colores estándar |
| Hover | Usuario pasa mouse | Subtle change, no dramatic |
| Focus | Elemento seleccionado | Anillo azul visible |
| Active | Clickado/presionado | Slightly darker |
| Disabled | No interactivo | Opacity 50%, no clickable |
| Loading | Procesando | Spinner o skeleton |
| Error | Problema | Border rojo + mensaje |
| Success | Operación exitosa | Check o feedback sutil |

---

## Principios de Interacción

### PI-06: Reglas de Motion

**Principios de animación**:

- **Duración**: 150-300ms para micro-interacciones, 300-500ms para transiciones mayores
- **Easing**: Ease-out para entrada, ease-in para salida, ease-in-out para cambios
- **No motion sin propósito**: La animación debe comunicar algo, no solodecorate

**Tipos de motion**:

- **Transiciones de página**: Fade + slight slide (300ms)
- **Aparición de modales**: Fade + scale up (200ms)
- **Actualización de datos**: No transition, instant update
- **Loading**: Skeleton en lugar de spinner para contenido
- **Feedback de acción**: Micro-interaction en el button mismo

**La regla 100ms**: Cualquier interacción debe dar feedback en menos de 100ms. Si no es posible, usar loading state.

---

### PI-07: Patrones UX Recomendados

**Para entrada de datos**:

- Quick Entry para transacciones rápidas (numpad)
- Forms con labels claros y validación inline
- Cantidad mínima de campos requeridos
- Defaults smart (fecha actual, última categoría usada)

**Para navegación**:

- Sidebar o tab bar para secciones principales
- Breadcrumbs para navegación profunda
- Back button consistente
- No más de 3 niveles de profundidad

**Para feedback**:

- Toast notifications para confirmaciones sutiles
- Modals solo para acciones importantes
- Inline errors junto al campo, no al inicio del form
- Success inline cuando es posible

**Para empty states**:

- Siempre mostrar algo informativo, no solo "vacio"
- Explicar qué hacer para generar contenido
- Incluir CTAs claros

---

### PI-08: Patrones UX Prohibidos

**Lo que NUNCA se hace**:

- ❌ Mostrar alert( de browser para errores
- ❌ Usar loading en toda la pantalla (usar skeleton)
- ❌ Confirmation request para acciones reversibles
- ❌ Campos requeridos sin asterisk o label
- ❌ Password sin toggle de visibilidad
- ❌ Redirect automatico sin feedback
- ❌ Datos largos sin truncate con tooltip
- ❌ Número sin formato (S/ 1000 vs S/ 1,000.00)
- ❌fechas sin formato humano (16/05/2026 vs 16 de mayo)
- ❌ Gráficos sin labels claros

**Anti-patterns específicos de finanzas**:

- ❌ Mostrar deuda en rojo por defecto (puede ser neutral)
- ❌ Comparar con "el mes pasado" sin contexto (estacionalidad)
- ❌ Scoring negativo sin explicación (nunca negatives scores)
- ❌ Mostrar todas las categorías si hay más de 6 (group as "otros")

---

### PI-09: UX del Quick Entry

**El flujo ideal**:

1. Usuario toca FAB (+) → Modal abre con numpad
2. Usuario ingresa monto → Se muestra en tiempo real
3. Usuario optionally selecciona categoría y añade descripción
4. Usuario toca "Guardar" → Transacción registrada + feedback contextual
5. Modal cierra automáticamente

**Reglas del Quick Entry**:

- Debe tomar menos de 5 segundos hacer un registro
- No requiere categoría por defecto
- Debe funcionar sin keyboard (mobile)
- Debe ser accesible desde cualquier pantalla
- El monto inicial debe estar en 0, no vacío

---

### PI-10: Responsive Behavior

**Reglas de responsividad**:

- Mobile: Layout stack vertical, navigation bottom tabs
- Tablet: Layout puede ser 2-column para secciones secundarias
- Desktop: Full dashboard view con sidebar navegación

**Breakpoints**:

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

**La regla mobile-first no aplica aquí**: Track Pays prioriza desktop-first para la experiencia premium, con adaptation para mobile. La experiencia primary es desktop.

---

## Checklist de Implementación

### Antes de shippear cualquier feature, verificar:

- [ ] ¿La pantalla responde una pregunta clara?
- [ ] ¿Hay un punto focal claro (jerarquía)?
- [ ] ¿Los colores comunican el mensaje correcto?
- [ ] ¿El usuario sabe qué hacer a continuación?
- [ ] ¿El feedback es contextual, no solo confirmación?
- [ ] ¿La animación tiene propósito?
- [ ] ¿Los estados vacío son informativos?
- [ ] ¿Los errores son accionables?
- [ ] ¿La accesibilidad está considerada?
- [ ] ¿El diseño es consistente con el resto de la app?

---

## Resumen

Los principios UX de Track Pays priorizan:

1. **Claridad** sobre cantidad
2. **Contexto** sobre datos
3. **Calma** sobre información
4. **Dirección** sobre análisis
5. **Consistencia** sobre variedad
6. **Feedback** sobre confirmación
7. **Emoción** sobre función

Estos principios no son negociables. Cualquier feature, componente o interacción debe alinearse con estos principios. Si hay conflicto entre un principio y una feature, el principio gana.