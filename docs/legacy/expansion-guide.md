# Guía de Expansión del Sistema - Track Pays

## Visión

El sistema financiero de Track Pays está diseñado para ser **extensible**. No necesitas romper el código existente para agregar nuevas categorías,功能 o detalles.

---

## Cómo Agregar Nuevas Categorías

### 1. Agregar nueva categoría de gasto

**Paso 1**: Agregar al tipo en `expense.model.ts`

```typescript
// Para gastos primordiales
export type ExtendedPrimordialCategory = 
  | PrimordialCategory
  | 'nueva_categoria_primordial';  // Agregar aquí

// Para gastos no primordiales
export type ExtendedNonPrimordialCategory = 
  | NonPrimordialCategory
  | 'nueva_categoria_no_primordial';  // Agregar aquí
```

**Paso 2**: Agregar a las constantes

```typescript
export const PRIMORDIAL_CATEGORIES: Record<ExtendedPrimordialCategory, { name: string; icon: string }> = {
  // ... existentes ...
  nueva_categoria_primordial: { name: 'Nombre Mostrado', icon: '🏷️' }
};
```

**Paso 3**: Listo - el resto del sistema lo detectará automáticamente ✅

---

## Cómo Agregar Subcategorías Detalladas

### Ejemplo: Servicios

```typescript
// En el modelo ya existe subcategory
const expense = {
  category: 'utilities',
  subcategory: 'internet',
  provider: 'Movistar',
  
  // Para más detalle, usar serviceDetails
  serviceDetails: {
    serviceType: 'Fibra óptica',
    planType: '100 Mbps',
    billingCycle: 'Mensual',
    contactPhone: '0800-0000',
    website: 'https://movistar.com.pe'
  }
};
```

### Ejemplo: Deudas Detalladas

```typescript
const expense = {
  category: 'debt',
  subcategory: 'tarjeta',
  provider: 'BCP',
  
  // Para deudas, usar debtDetails
  debtDetails: {
    debtType: 'credit_card',
    creditorName: 'Banco de Crédito del Perú',
    interestRate: 45.5,  // Tasa anual
    totalDebt: 5000,
    remainingPayments: 12,
    isConsolidated: false
  }
};
```

---

## Cómo Agregar Metadatos Personalizados

Si necesitas guardar información adicional que no está en el modelo:

```typescript
const expense = {
  name: 'Gasto personalizado',
  
  // Usar metadata para cualquier campo adicional
  metadata: {
    customField1: 'valor',
    customField2: 123,
    anything: { nested: 'object' }
  },
  
  // Usar tags para organización
  tags: ['etiqueta1', 'etiqueta2', 'prioridad-alta']
};
```

---

## Estructura de Colecciones Firestore para Expansión

```
users/{userId}/
├── expenses/                    ← Gastos base
│   └── {expenseId}/
│       ├── name, category, subcategory...
│       ├── providerDetails{}    ← Extensible
│       ├── debtDetails{}       ← Extensible
│       ├── serviceDetails{}    ← Extensible
│       ├── metadata{}          ← Extensible
│       └── tags[]              ← Extensible
│
├── expenseHistory/              ← Historial para análisis
│   └── {expenseId}/
│       └── {month}/
│
└── expenseInsights/             ← Insights por gasto
    └── {expenseId}/
```

---

## Reglas de Compatibilidad

### ✅ PUEDES hacer sin romper:
- Agregar nuevas categorías a los tipos
- Agregar campos opcionales a metadata
- Agregar nuevos campos a providerDetails, debtDetails, serviceDetails
- Agregar tags
- Crear nuevas colecciones

### ❌ NO debes hacer:
- Eliminar categorías existentes (usar `deprecado` en su lugar)
- Cambiar el tipo de campos existentes
- Renombrar campos (usar alias en su lugar)
- Eliminar campos (usar `optional` en su lugar)

---

## Planes de Expansión Futura (No implementados aún)

| Área | Detalle | Estado |
|------|---------|--------|
| **Deudas detalladas** | Agregar prestamista, tasa interés, cuotas | Listo para implementar |
| **Servicios细** | Proveedor, plan, contrato, lecturas | Listo para implementar |
| **Vivienda细** | Alquiler vs hipoteca, condominio, mantenimiento | Listo para implementar |
| **Transport细** | Vehículo propio vs público, combustible, mantenimiento | Listo para implementar |
| **Salud细** | EPS, SIS, seguros privados, medicamentos | Listo para implementar |
| **Educación细** | Colegio, universidad, cursos, materiales | Listo para implementar |
| **Custom categories** | Categorías creadas por usuario | Pendiente |
| **Receipt OCR** | Foto → dato automático | Pendiente (Fase 3) |
| **Open Banking** | Importar de banco | Pendiente (Fase 4) |

---

## Cómo consultar categorías disponibles

```typescript
import { 
  PRIMORDIAL_CATEGORIES, 
  NON_PRIMORDIAL_CATEGORIES,
  getAllExpenseCategories 
} from '../models/expense.model';

// Todas las categorías
const all = getAllExpenseCategories();

// Solo primordiales
const primordial = PRIMORDIAL_CATEGORIES;

// Solo no primordiales
const nonPrimordial = NON_PRIMORDIAL_CATEGORIES;
```

---

## Resumen

| Para agregar... | Dónde modificar | Resultado |
|-----------------|-----------------|-----------|
| Nueva categoría | `expense.model.ts` tipos | Automático en UI |
| Subcategoría | Al crear expense | Disponible |
| Detalle de proveedor | `providerDetails` | Disponible |
| Detalle de deuda | `debtDetails` | Disponible |
| Detalle de servicio | `serviceDetails` | Disponible |
| Datos personalizados | `metadata` | Disponible |
| Organización | `tags` | Disponible |

**El sistema está diseñado para crecer sin romper.** ✅