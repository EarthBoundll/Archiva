# Arquitectura Frontend V3 - Track Pays
## Análisis Completo de Pages, Módulos y Componentes

---

## 1. ESTRUCTURA DE PÁGINAS PROPUESTA

### Pages a crear/modificar

| Page | Ruta | Descripción | Estado |
|------|------|-------------|--------|
| **Login** | `/login` | Autenticación con dinámicas de contraseña | ⬜ Por crear |
| **Onboarding** | `/onboarding/*` | Flow de 4 pasos para nuevos usuarios | ⬜ Por crear |
| **Dashboard** | `/dashboard` | Homepage con grid asimétrico de widgets | 🔄 Rediseñar |
| **Budgets** | `/budgets` | Gestión de presupuestos por categoría | ⬜ Por crear |
| **Transactions** | `/transactions` | Lista de movimientos (ya existe) | ✅ Actualizar |
| **Alerts** | `/alerts` | Notificaciones y alertas de gasto | ⬜ Por crear |
| **Insights** | `/insights` | Análisis y gráficos financieros | ⬜ Por crear |
| **Goals** | `/goals` | Metas de ahorro (ya existe) | ✅ Actualizar |
| **Settings** | `/settings` | Configuración de cuenta | ⬜ Por crear |

### Rutas y Guards

```typescript
// app.routes.ts
export const routes: Route[] = [
  { path: 'login', component: LoginComponent },
  { path: 'onboarding', component: OnboardingComponent, children: [
    { path: 'step1', component: OnboardingStep1Component },
    { path: 'step2', component: OnboardingStep2Component },
    { path: 'step3', component: OnboardingStep3Component },
    { path: 'step4', component: OnboardingStep4Component },
  ]},
  { 
    path: '', 
    canActivate: [AuthGuard], 
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'budgets', component: BudgetsComponent },
      { path: 'transactions', component: TransactionsComponent },
      { path: 'alerts', component: AlertsComponent },
      { path: 'insights', component: InsightsComponent },
      { path: 'goals', component: GoalsComponent },
      { path: 'settings', component: SettingsComponent },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
```

---

## 2. MÓDULOS Y COMPONENTES A CREAR

### 2.1 Core Layout Module

Componentes de estructura que se reutilizan en todas las páginas:

```
src/app/core/layout/
├── layout.component.ts          # Shell principal (sidebar + content)
├── sidebar/
│   ├── sidebar.component.ts     # Navegación lateral
│   ├── sidebar.scss
│   └── sidebar-item/
│       └── sidebar-item.component.ts
├── topbar/
│   ├── topbar.component.ts     # Header con user menu
│   └── topbar.scss
├── bottom-nav/
│   ├── bottom-nav.component.ts # Nav inferior móvil
│   └── bottom-nav.scss
└── main-content/
    ├── main-content.component.ts
    └── main-content.scss
```

### 2.2 Shared Components Module

Componentes UI reutilizables:

```
src/app/shared/components/
├── buttons/
│   ├── btn-primary/
│   ├── btn-secondary/
│   ├── btn-icon/
│   └── btn-fab/
├── cards/
│   ├── card/
│   ├── stat-card/
│   ├── chart-card/
│   └── metric-card/
├── forms/
│   ├── input-field/
│   ├── select-field/
│   ├── toggle-switch/
│   └── password-input/     # Password con eye toggle + validación
├── modals/
│   ├── modal/
│   └── confirm-dialog/
├── lists/
│   ├── transaction-list-item/
│   ├── category-list-item/
│   └── goal-list-item/
├── charts/
│   ├── bar-chart/
│   ├── line-chart/
│   ├── pie-chart/
│   └── donut-chart/
└── ui/
    ├── badge/
    ├── progress-bar/
    ├── skeleton-loader/
    └── empty-state/
```

### 2.3 Feature Modules

Por página/feature:

```
src/app/features/
├── auth/                    # Login + Register
│   ├── login/
│   │   ├── login.component.ts
│   │   ├── login.html
│   │   ├── login.scss
│   │   └── login.service.ts
│   └── components/
│       ├── password-strength/    # Indicador de fuerza password
│       └── eye-toggle/          # Mostrar/ocultar password
│
├── onboarding/              # 4 pasos
│   ├── onboarding.component.ts  # Router outlet para steps
│   ├── steps/
│   │   ├── welcome/         # Step 1: Bienvenida
│   │   ├── profile/         # Step 2: Nombre, moneda
│   │   ├── income/         # Step 3: Ingresos mensuales
│   │   └── goals/          # Step 4: Primera meta
│   └── onboarding.guard.ts
│
├── dashboard/               # Grid asimétrico
│   ├── dashboard.component.ts
│   ├── widgets/
│   │   ├── balance-widget/
│   │   ├── quick-stats-widget/
│   │   ├── budget-progress-widget/
│   │   ├── recent-transactions-widget/
│   │   ├── goal-progress-widget/
│   │   └── spending-chart-widget/
│   └── dashboard.scss
│
├── budgets/
│   ├── budgets.component.ts
│   ├── budget-card/
│   ├── category-budget/
│   └── add-budget-modal/
│
├── alerts/
│   ├── alerts.component.ts
│   ├── alert-item/
│   ├── alert-settings/
│   └── alerts.service.ts
│
├── insights/
│   ├── insights.component.ts
│   ├── charts/
│   │   ├── monthly-comparison/
│   │   ├── category-breakdown/
│   │   ├── savings-trend/
│   │   └── forecast/
│   └── insights.service.ts
│
└── settings/
    ├── settings.component.ts
    ├── profile-section/
    ├── notifications-section/
    └── data-section/
```

---

## 3. ANÁLISIS DE DISEÑO - LO QUE NO NOS GUSTA

### Problemas del diseño actual:
1. ❌ **Centralizado** - Todo centrado,浪费 espacio horizontal
2. ❌ **Cards alargados** - Cuadros muy largos verticalmente
3. ❌ **Monótono** - Mismo tamaño de cards siempre
4. ❌ **Sin jerarquía** - Todo parece igual de importante

### Solución: Grid Asimétrico + Sidebar

```
┌─────────────────────────────────────────────────────────────┐
│  SIDEBAR (220px)  │          MAIN CONTENT                  │
│                   │                                         │
│  🏠 Dashboard     │  ┌─────────┐  ┌─────────────────────┐   │
│  💰 Budgets       │  │ Balance │  │   Quick Stats       │   │
│  📊 Insights       │  │ Widget  │  │   (2 cols)          │   │
│  🔔 Alerts        │  └─────────┘  └─────────────────────┘   │
│  🎯 Goals         │                                         │
│  ⚙️ Settings      │  ┌──────────────────────────────────┐   │
│                   │  │     Budget Progress (wide)      │   │
│                   │  │                                  │   │
│  ─────────────    │  └──────────────────────────────────┘   │
│  User Profile     │                                         │
│                   │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│                   │  │ Goal 1  │ │ Goal 2  │ │ Alerts  │    │
│                   │  │ (square)│ │(square) │ │(square) │    │
│                   │  └─────────┘ └─────────┘ └─────────┘    │
│                   │                                         │
└─────────────────────────────────────────────────────────────┘
```

### Estilo Premium Tech:

- **Background**: `#0E1212` (no más centered containers)
- **Sidebar**: `#0D1B16` fijo a la izquierda
- **Cards**: Grid asimétrico, no todos del mismo tamaño
- **Widgets**: Diferentes anchos (1 col, 2 col, 3 col)
- **Bottom Nav**: Solo en móvil, iconos + labels cortos

---

## 4. LOGIN - DINÁMICAS DE CONTRASEÑA

### Requisitos:
1. **Eye toggle** - Mostrar/ocultar password
2. **Password strength indicator** - Barra visual de fuerza
3. **Validación en tiempo real** - 
   - Mínimo 8 caracteres
   - Al menos 1 número
   - Al menos 1 mayúscula
4. **Animaciones** - Transiciones suaves
5. **Botón social** - Google (Firebase auth)

### Componentes necesarios:
- `password-input.component` - Input con toggle
- `password-strength.component` - Indicador visual
- `login.component` - Formulario con validación reactiva

---

## 5. ONBOARDING - FLOW DE 4 PASOS

### Step 1: Welcome
- Título: "Bienvenido a Track Pays"
- Subtítulo: "Tu asistente financiero personal"
- Mascota (chimpancé con lentes) grande
- Botón: "Empezar"

### Step 2: Profile
- Input: Nombre completo
- Selector: Moneda (S/, $, €, etc.)
- Input: Apodo (opcional)
- Botón: "Continuar"

### Step 3: Income
- Input: Ingreso mensual (selector de monto rápido o manual)
- Opciones rápidas: S/1000, S/2000, S/3000, S/5000, custom
- Este valor sirve para calcular 50/30/20 inicial
- Botón: "Continuar"

### Step 4: Goals
- Input: Nombre de primera meta
- Input: Monto objetivo
- Selector: Plazo (3, 6, 12, 24 meses)
- Botón: "Comenzar" → Guarda todo → Redirect a dashboard

### Guard para Onboarding:
- Si usuario no ha completado onboarding → redirect a `/onboarding/step1`
- Si ya completó → puede acceder a dashboard

---

## 6. DASHBOARD - GRID ASIMÉTRICO

### Layout propuesto (CSS Grid):

```scss
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
  
  // Widget widths:
  // 4 cols = 33%
  // 6 cols = 50%  
  // 8 cols = 66%
  // 12 cols = 100%
}

.widget-balance { grid-column: span 4; }  // Cuadrado pequeño
.widget-stats   { grid-column: span 8; }  // Rectangle horizontal
.widget-budget  { grid-column: span 12; } // Full width
.widget-goals   { grid-column: span 4; }  // 3 widgets en fila
.widget-alerts  { grid-column: span 4; }
.widget-chart   { grid-column: span 4; }
```

### Widgets del Dashboard:
1. **Balance Widget** (4 cols) - Balance actual grande
2. **Quick Stats** (8 cols) - Ingresos/Gastos/ saving
3. **Budget Progress** (12 cols) - Barras 50/30/20 completas
4. **Recent Transactions** (8 cols) - Últimos 5 movimientos
5. **Goal Progress** (4 cols) - Mini goal card
6. **Spending Chart** (4 cols) - Mini pie chart

---

## 7. PRESUPUESTO Y ESFUERZO

### Componentes a crear desde cero:
- Layout (sidebar, topbar, bottom-nav): ~10 componentes
- Login + Password dynamics: ~5 componentes
- Onboarding (4 steps): ~8 componentes
- Dashboard con widgets: ~10 componentes
- Budgets page: ~6 componentes
- Alerts page: ~5 componentes
- Insights page: ~6 componentes

**Total**: ~50 componentes aproximadamente

### Orden de prioridad:
1. **Login** - Puerta de entrada, primera impresión
2. **Onboarding** - Experiencia de usuario nuevo
3. **Layout** - Base de toda la app
4. **Dashboard** - Homepage, lo más usado
5. **Budgets** - Feature core
6. **Alerts** - Feature core
7. **Insights** - Feature nice-to-have

---

## 8. IMPLEMENTACIÓN RECOMENDADA

### Fase 1: Autenticación (1-2 días)
1. Crear login con password dynamics
2. Crear onboarding guard + service

### Fase 2: Layout Base (1-2 días)
1. Sidebar component
2. Topbar component
3. Main content wrapper
4. Bottom nav (responsive)

### Fase 3: Dashboard (2-3 días)
1. Grid system
2. Widgets individuales
3. Responsive (mobile = 1 col)

### Fase 4: Pages adicionales (3-4 días)
1. Budgets
2. Alerts
3. Insights
4. Settings

---

## 9. COLORES Y ESTILO (RECORDAR)

Del documento de identidad:
- ✅ Primary: `#166B46`
- ✅ Dark: `#0D1B16`
- ✅ Background: `#0E1212`
- ✅ White: `#F5F7F5`
- ✅ Accent: `#2FA46A`
- ✅ Gold: `#D4AF37` (usar poco)
- ❌ NO emojis
- ✅ SVG icons
- ✅ Poppins + Inter fonts
- ✅ Premium, calm, tech

---

**Documento creado**: Mayo 2026
**Próximo paso**: Empezar implementación fase por fase