# App Architecture — Track Pays

> **⚠️ ESTADO: PARCIALMENTE DESACTUALIZADO**
> 
> Este documento describe la arquitectura general pero contiene referencias a Supabase.
> Para la versión actual, ver:
> - `backend-analysis-and-methodology.md` - Estado actual del backend
> - `financial-system-master.md` - Sistema financiero completo
> - `updated-roadmap.md` - Roadmap vigente
>
> ---
> **Última actualización**: Mayo 2026

## Visión General

La arquitectura de Track Pays se estructura como un **sistema de dominios interconectados**, no como una colección de páginas independientes. Cada dominio tiene responsabilidades claras, dependencias definidas, y comunica con otros dominios a través de interfaces bien establecidas.

La arquitectura refleja la filosofía del producto: **claridad sobre complejidad, conexión sobre aislamiento, y sistema sobre features**.

---

## Mapa de Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION SHELL                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Router    │  │   Auth     │  │   Theme     │  │  Analytics  │     │
│  │   System    │  │   System   │  │   System    │  │   Tracker   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│   CORE DOMAIN │         │  FEATURE DOMAINS        │  SHARED DOMAIN│
│  (Foundations)│         │  (Business Logic)       │  (Reusable)   │
└───────────────┘         └───────────────┘         └───────────────┘
        │                           │                           │
   ┌────┴────┐                ┌────┴────┐                ┌────┴────┐
   │         │                │         │                │         │
   ▼         ▼                ▼         ▼                ▼         ▼
┌──────┐ ┌──────┐      ┌─────────┐ ┌────────┐ ┌─────────┐ ┌─────────┐
│Engine│ │Services│      │Dashboard│ │Transac-│ │  Goals  │ │  Auth   │
│Layer │ │  Layer │      │ Feature │ │ tions  │ │ Feature │ │ Feature │
└──────┘ └──────┘      └─────────┘ └────────┘ └─────────┘ └─────────┘
```

---

## Integración con Firestore

> **Nota**: La arquitectura de datos en Firestore está documentada en `firestore-architecture.md`. Esta define la estructura completa de datos, incluyendo:
> - Months como unidad organizativa primaria
> - MonthlyFinancialState como estado central
> - Sistema de analytics e insights
> - Budgeting real
> - Arquitectura escalable para el futuro

---

## Dominio 1: Core Domain (Fundamentos)

El Core Domain contiene la infraestructura fundamental que hace funcionar la aplicación. Es la base sobre la que se construyen todos los features.

### 1.1 Financial Engine

**Responsabilidad**: Procesar, calcular y transformar datos financieros brutos en información contextualizada.

**Componentes internos**:

- `CalculationService`: Operaciones matemáticas (totales, promedios, proyecciones)
- `ComparisonService`: Comparaciones temporales (mes actual vs anterior, tendencias)
- `ProjectionService`: Proyecciones futuras (estimación de meta, proyecciones de gasto)
- `NormalizationService`: Estandarización de datos (formatos de moneda, fechas)

**API pública del Engine**:
```typescript
interface FinancialEngine {
  calculateMonthSummary(transactions: Transaction[]): MonthSummary;
  calculateTrend(transactions: Transaction[], period: Period): Trend;
  projectGoalTimeline(goal: SavingGoal, contribution: number): Projection;
  calculateRule503020(income: number, transactions: Transaction[]): RuleBreakdown;
  calculateCategoryBreakdown(transactions: Transaction[]): CategoryBreakdown[];
}
```

**Dependencias**:

- Transaction System (datos de entrada)
- Goals System (para proyecciones)
- No tiene dependencias de UI

**Posición jerárquica**: Es el servicio más fundamental. Todos los features dependen de él indirectamente.

---

### 1.2 Analytics System

**Responsabilidad**: Recopilar, agregar y proporcionar métricas de uso y comportamiento del usuario.

**Componentes internos**:

- `UsageTracker`: Seguimiento de sesiones, duración, frecuencia
- `FeatureUsage`: Qué features se usan más
- `EngagementMetrics`: Metrics de engagement (sesiones por semana, acciones por sesión)
- `UserJourney`: Tracking de user flow

**API pública**:
```typescript
interface AnalyticsSystem {
  trackEvent(event: AnalyticsEvent): void;
  getUserEngagement(): EngagementReport;
  getFeatureUsage(): FeatureUsageReport;
  getSessionMetrics(): SessionMetrics;
}
```

**Nota**: Esta instrumentation es diferente a los analytics financieros. Los analytics financieros son datos del usuario; el Analytics System es datos de uso de la app.

---

### 1.3 Notification System

**Responsabilidad**: Gestionar notificaciones, toasts, y mensajes contextuales al usuario.

**Componentes internos**:

- `ToastManager`: Notificaciones temporales (éxito, error, info)
- `AlertManager`: Alertas que requieren acción
- `ReminderScheduler`: Recordatorios programados (meta alcanzada, presupuesto excedido)
- `FeedbackDispatcher`: Entrega de feedback contextual

**API pública**:
```typescript
interface NotificationSystem {
  showToast(message: string, type: ToastType): void;
  showAlert(config: AlertConfig): Promise<AlertAction>;
  scheduleReminder(reminder: ReminderConfig): void;
  dispatchFeedback(context: FinancialContext): void;
}
```

---

### 1.4 Auth System

**Responsabilidad**: Gestionar autenticación, autorización, y estado del usuario.

**Componentes internos**:

- `AuthProvider`: Conexión con Firebase Auth
- `SessionManager`: Gestión de sesión activa
- `UserProfileSync`: Sincronización de perfil con backend
- `PermissionGuard`: Control de acceso a rutas y features

**API pública**:
```typescript
interface AuthSystem {
  getCurrentUser(): User | null;
  isAuthenticated(): boolean;
  hasPermission(permission: Permission): boolean;
  getUserProfile(): UserProfile;
}
```

**Dependencias**: Ninguna (es foundational)

---

### 1.5 Theme System

**Responsabilidad**: Gestionar themes, colores, tipografía, y preferencias visuales del usuario.

**Componentes internos**:

- `ThemeProvider`: Aplicación de theme (light/dark)
- `PreferenceManager`: Preferencias del usuario (font size, density)
- `StyleTokenProvider`: Tokens de diseño para componentes

**API pública**:
```typescript
interface ThemeSystem {
  getCurrentTheme(): Theme;
  setTheme(theme: 'light' | 'dark' | 'system'): void;
  getDensity(): Density;
  setDensity(density: 'compact' | 'comfortable' | 'spacious'): void;
}
```

---

## Dominio 2: Feature Domains (Lógica de Negocio)

Los Feature Domains contienen la lógica específica de cada área funcional del producto. Cada feature es un dominio de negocio autocontenido que se comunica con el Core Domain.

### 2.1 Dashboard Feature

**Responsabilidad**: Proporcionar una vista consolidada del estado financiero actual del usuario.

**Pregunta que responde**: "¿Cómo estoy este mes?"

**Sub-sistemas internos**:

- `BalanceCalculator`: Calcula balance, ingresos, gastos
- `Rule503020Calculator`: Procesa la regla 50/30/20
- `GoalProgressTracker`: Muestra progreso hacia metas
- `CategorySpendingAnalyzer`: Analiza gastos por categoría
- `RecentTransactionLister`: Lista últimas transacciones

**Dependencias**:

- Transaction System (datos)
- Goals System (progreso de meta)
- Financial Engine (cálculos)
- Category System (nombres, icons)

**API del Feature**:
```typescript
interface DashboardFeature {
  getMonthOverview(): Promise<DashboardData>;
  getRule503020Status(): Promise<Rule503020Status>;
  getGoalProgress(): Promise<GoalSummary>;
  getTopCategories(): Promise<CategorySpending[]>;
  getRecentTransactions(limit: number): Promise<Transaction[]>;
}
```

---

### 2.2 Transactions Feature

**Responsabilidad**: Gestionar el registro, edición, eliminación y visualización de transacciones.

**Pregunta que responde**: "¿Qué pasó exactamente?"

**Sub-sistemas internos**:

- `TransactionRepository`: CRUD de transacciones
- `FilterEngine`: Filtrado por fecha, tipo, categoría
- `GroupingService`: Agrupación por fecha
- `EditHandler`: Gestión de ediciones
- `DeleteHandler`: Gestión de eliminaciones con soft-delete option

**Dependencias**:

- Transaction System (datos)
- Category System (categorización)
- Financial Engine (totales)

**API del Feature**:
```typescript
interface TransactionsFeature {
  getTransactions(filter: TransactionFilter): Promise<Transaction[]>;
  createTransaction(data: TransactionInput): Promise<Transaction>;
  updateTransaction(id: string, data: Partial<TransactionInput>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  getGroupedTransactions(filter: TransactionFilter): Promise<GroupedTransactions>;
}
```

---

### 2.3 Goals Feature

**Responsabilidad**: Gestionar metas de ahorro, proyecciones, y seguimiento de progreso.

**Pregunta que responde**: "¿Voy hacia mi meta?"

**Sub-sistemas internos**:

- `GoalRepository`: CRUD de metas
- `MilestoneCalculator`: Cálculo de hitos intermedios
- `TimelineProjector`: Proyección de timeline
- `ScenarioSimulator`: Simulación de escenarios (qué pasa si...)
- `ProgressTracker`: Seguimiento de progreso

**Dependencias**:

- Transaction System (para encontrar depósitos a meta)
- Financial Engine (proyecciones)
- No depende directamente de UI

**API del Feature**:
```typescript
interface GoalsFeature {
  getCurrentGoal(): Promise<SavingGoal | null>;
  updateGoalProgress(amount: number): Promise<SavingGoal>;
  updateTargetAmount(amount: number): Promise<SavingGoal>;
  updateMonthlyContribution(amount: number): Promise<SavingGoal>;
  getMilestones(): Promise<Milestone[]>;
  simulateScenarios(scenarios: ScenarioInput[]): Promise<ScenarioResult[]>;
}
```

---

### 2.4 Analytics Feature

**Responsabilidad**: Proporcionar análisis profundo de patrones financieros.

**Pregunta que responde**: "¿Por qué estoy gastando así?"

**Sub-sistemas internos**:

- `TrendAnalyzer`: Análisis de tendencias temporales
- `CategoryAnalyzer`: Análisis de patrones por categoría
- `AnomalyDetector`: Detección de gastos anómalos
- `PatternRecognizer`:识别 patrones de comportamiento
- `ComparisonEngine`: Comparaciones multi-período

**Dependiencias**:

- Transaction System (datos)
- Financial Engine (cálculos)

**API del Feature**:
```typescript
interface AnalyticsFeature {
  getSpendingTrends(period: Period): Promise<TrendAnalysis>;
  getCategoryAnalysis(categoryId?: string): Promise<CategoryAnalysis>;
  getAnomalies(): Promise<Anomaly[]>;
  getPatterns(): Promise<BehavioralPattern[]>;
  getComparisons(): Promise<ComparisonReport>;
}
```

---

### 2.5 Auth Feature (Login/Register)

**Responsabilidad**: Gestionar el flujo de autenticación del usuario.

**Componentes internos**:

- `LoginFlow`: Proceso de login
- `RegistrationFlow`: Proceso de registro
- `PasswordRecoveryFlow`: Recuperación de contraseña
- `EmailVerification`: Verificación de email
- `ProfileSetup`: Configuración inicial de perfil

**Dependencias**:

- Auth System (core)
- Category System (seed de categorías al registrar)
- Goals System (seed de meta inicial)

**API del Feature**:
```typescript
interface AuthFeature {
  login(email: string, password: string): Promise<AuthResult>;
  register(email: string, password: string, profile: UserProfileInput): Promise<AuthResult>;
  logout(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
}
```

---

### 2.6 Quick Entry Feature

**Responsabilidad**: Permitir registro rápido de transacciones desde cualquier punto de la app.

**Pregunta que responde**: "¿Cómo agrego un gasto ahora?"

**Componentes internos**:

- `QuickEntryForm`: Formulario minimalista
- `NumpadInterface`: Interfaz de entrada numérica
- `CategoryQuickPicker`: Selector rápido de categoría
- `RecentCategory记忆`: Remember last used category

**Dependencias**:

- Transaction System
- Category System

**API del Feature**:
```typescript
interface QuickEntryFeature {
  open(): void;
  close(): void;
  isOpen(): boolean;
  saveTransaction(data: QuickEntryInput): Promise<Transaction>;
}
```

---

## Dominio 3: Shared Domain (Reutilizable)

El Shared Domain contiene componentes, utilidades y servicios que son usados por múltiples features. No contiene lógica de negocio específica.

### 3.1 Design System Components

**Responsabilidad**: Componentes UI reutilizables que implementan los principios de diseño.

**Componentes base**:

- `Button`: Buttons primarios, secondary, ghost
- `Input`: Text inputs, number inputs, date inputs
- `Select`: Dropdowns, selects
- `Card`: Contenedores de contenido
- `Modal`: Ventanas modales
- `Toast`: Notificaciones
- `Skeleton`: Loading states
- `EmptyState`: Estados vacío
- `Loading`: Indicadores de carga
- `Badge`: Labels y tags

**Componentes financieros especializados**:

- `AmountDisplay`: Formato de moneda con color según contexto
- `ProgressBar`: Barras de progreso con estados
- `TrendIndicator`: Indicadores de tendencia (up/down/neutral)
- `CategoryIcon`: Icono de categoría con fallback

---

### 3.2 Pipes and Utilities

**Pipes reutilizables**:

- `CurrencyFormatPipe`: Formato de soles
- `DateFormatPipe`: Formato de fecha localized
- `RelativeDatePipe`: "hace 2 días", "hoy"
- `PercentagePipe`: Formato de porcentaje
- `TruncatePipe`: Truncamiento con tooltip

**Utilidades**:

- `DateUtils`: Funciones de fecha
- `NumberUtils`: Funciones de número
- `StringUtils`: Funciones de string
- `ValidationUtils`: Validadores reutilizables

---

### 3.3 Chart Components

**Componentes de gráficos**:

- `PieChart`: Gráfico de categoría (gastos por categoría)
- `BarChart`: Gráfico de tendencia (gastos por mes)
- `LineChart`: Gráfico de evolución (balance histórico)
- `DonutChart`: Gráfico de regla 50/30/20

**Características**:

- Configurables con tema de la app
- Responsive
- Animaciones subtle
- Tooltips informativos

---

## Flujo de Datos Entre Sistemas

### Flujo 1: Usuario ve el Dashboard

```
1. Router navega a /dashboard
2. Dashboard Feature carga datos
3. Transaction System obtiene transacciones del mes
4. Category System obtiene categorías del usuario
5. Goals System obtiene meta actual
6. Financial Engine procesa y calcula:
   - Totales (balance, income, expenses)
   - Rule 50/30/20 breakdown
   - Category breakdown
   - Progreso de meta
7. Dashboard Feature compila DashboardData
8. Dashboard Component renderiza con datos
9. Analytics System registra vista
```

### Flujo 2: Usuario registra transacción con Quick Entry

```
1. Usuario toca FAB → Quick Entry Feature abre modal
2. Quick Entry captura monto, categoría, descripción, fecha
3. Quick Entry llama a Transaction System.create()
4. Transaction System guarda en Firebase
5. Notification System muestra toast de éxito
6. Financial Engine recalcula datos del mes
7. Dashboard/Transactions actualizan si están visibles
8. Analytics System registra acción de registro
```

### Flujo 3: Usuario revisa Analytics

```
1. Router navega a /analytics
2. Analytics Feature inicia análisis
3. Transaction System obtiene transacciones históricas (últimos 6 meses)
4. Financial Engine procesa:
   - Tendencias por categoría
   - Comparaciones mensuales
   - Detección de anomalías
   - Patrones de comportamiento
5. Analytics Feature compila análisis
6. Analytics Component renderiza charts y métricas
7. Analytics System registra vista
```

---

## Dependencias entre Módulos

### Matriz de Dependencias

| De \ Hacia | Auth | Trans | Cat | Goals | Dashboard | Analytics | Financial Engine | Design System |
|------------|------|-------|-----|-------|-----------|-----------|------------------|---------------|
| **Auth Feature** | - | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| **Transaction System** | ✓ | - | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ |
| **Category System** | ✓ | ✓ | - | ✗ | ✓ | ✓ | ✗ | ✗ |
| **Goals System** | ✓ | ✓ | ✗ | - | ✓ | ✗ | ✓ | ✗ |
| **Dashboard Feature** | ✓ | ✓ | ✓ | ✓ | - | ✗ | ✓ | ✓ |
| **Transactions Feature** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Analytics Feature** | ✓ | ✓ | ✓ | ✗ | ✗ | - | ✓ | ✓ |
| **Quick Entry Feature** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |

**Leyenda**: ✓ = Dependencia directa | ✗ = No depende directamente

---

## Estrategia de Desacoplamiento

### Principio de Dependencias Unidireccionales

Las dependencias siempre fluyen hacia abajo en la jerarquía:

```
FEATURES ──► SYSTEMS ──► CORE
(Alto nivel)    (Medio)    (Bajo nivel)
```

Los features no se comunican entre sí directamente. Si el Dashboard necesita datos que normalmente provee Goals, lo hace a través del Financial Engine.

### Interfaces y Contratos

Cada sistema expone una interfaz pública clara. Los cambios internos no rompen clientes:

```typescript
// Ejemplo: Transaction System
export interface TransactionSystem {
  getByMonth(year: number, month: number): Promise<Transaction[]>;
  // Los detalles de implementación (Firebase, SQL, etc) están encapsulados
}

// Un cambio de Firebase a Firestore no afecta Dashboard
```

### Inyección de Dependencias

Angular DI asegura que las dependencias se inyecten correctamente:

```typescript
// Correcto: Depender de interfaces, no de implementaciones
constructor(
  private transactionRepo: TransactionRepository,
  private financialEngine: FinancialEngine
) {}
```

---

## Integración con Firebase (Pending Migration)

### Estructura de Firestore Proyectada

```
/users/{userId}
├── profile
│   ├── fullName
│   ├── email
│   ├── monthlyIncome
│   ├── createdAt
│   └── preferences
│       ├── theme
│       └── currency
├── transactions/{transactionId}
│   ├── amount
│   ├── description
│   ├── date
│   ├── categoryId
│   ├── type (income/expense)
│   └── createdAt
├── categories/{categoryId}
│   ├── name
│   ├── icon
│   ├── ruleType (need/want/saving)
│   └── budgetLimit
├── goals/{goalId}
│   ├── name
│   ├── targetAmount
│   ├── currentAmount
│   ├── monthlyContribution
│   └── targetDate
└── analytics/
    ├── lastCalculated
    └── cachedAggregations
```

---

## Resumen de Arquitectura

| Dominio | Tipo | Responsabilidad Principal |
|---------|------|---------------------------|
| **Financial Engine** | Core | Cálculos y procesamiento de datos financieros |
| **Auth System** | Core | Autenticación y gestión de sesión |
| **Theme System** | Core | Presentación y theming |
| **Analytics System** | Core | Métricas de uso |
| **Notification System** | Core | Feedback al usuario |
| **Dashboard Feature** | Feature | Vista consolidada del mes |
| **Transactions Feature** | Feature | Gestión de transacciones |
| **Goals Feature** | Feature | Seguimiento de metas |
| **Analytics Feature** | Feature | Análisis profundo |
| **Quick Entry Feature** | Feature | Registro rápido |
| **Design System** | Shared | Componentes UI reutilizables |
| **Charts** | Shared | Visualizaciones financieras |
| **Pipes/Utils** | Shared | Funciones reutilizables |

La arquitectura está diseñada para:

1. **Escalabilidad**: Nuevos features se agregan como dominios nuevos
2. **Mantenibilidad**: Los cambios en un sistema no rompen otros
3. **Testabilidad**: Cada sistema tiene responsabilidad única y testeable
4. **Reemplazabilidad**: Firebase puede cambiarse por otro backend sin afectar features