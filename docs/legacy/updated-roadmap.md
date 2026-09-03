# Roadmap Actualizado - Track Pays
## v2.0 - Mayo 2026

---

## Estado de Avance (Mayo 2026)

| Fase | Estado | Completado |
|------|--------|------------|
| Fase 1: Foundation | ✅ COMPLETO | 100% |
| Fase 2.1: Onboarding | ✅ COMPLETO | 100% |
| Fase 2.2: Ingresos | ✅ COMPLETO | 100% |
| Fase 2.3: Gastos Dual | ✅ COMPLETO | 100% |
| Fase 2.4: Flujo Caja | ✅ COMPLETO | 100% |
| Fase 2.5: Alertas | ✅ COMPLETO | 100% (backend) |
| Fase 2.6: Goals | ✅ COMPLETO | 100% |
| Fase 3: Analytics | ✅ COMPLETO | 100% |
| Fase 4: Reportes/Export | ✅ COMPLETO | 100% |
| Fase 5: Offline Sync | ✅ COMPLETO | 100% |
| **BACKEND** | **✅ COMPLETO** | **100%** |
| **Income UI** (smart recurrence, history log, filtros) | **✅ COMPLETO** | **~90%** |
| **Dashboard UI** (Chart.js, glassmorphism, carrusel) | **✅ COMPLETO** | **~90%** |
| Expenses UI | 🔄 PENDIENTE | 0% |

---

## Detalle de Avance

### ✅ FASE 1: Foundation (COMPLETO)
- [x] Firebase migration
- [x] Core architecture
- [x] Dashboard con Chart.js, glassmorphism, carrusel de balance, mini sparklines
- [x] Basic auth

### ✅ FASE 2: Sistema Financiero

#### 2.1 Onboarding + Perfil (COMPLETO)
- [x] Onboarding de 4-6 pasos
- [x] Edad (15+)
- [x] Ingresos (múltiples fuentes)
- [x] Restricciones por edad (15-17, 18-23, 24+)
- [x] Perfil de usuario en Firestore

#### 2.2 Ingresos (COMPLETO)
- [x] 8 categorias de ingreso (active, passive, eventual, digital, transfer, state, business, other)
- [x] 28 tipos de ingreso (salary, fees, commissions, rental, dividends, etc.)
- [x] Smart Recurrence Engine: 8 frecuencias (weekly a variable)
- [x] Edge cases: clampDay, leap year, lastDayOfMonth, first weekday
- [x] generateOccurrences() calcula 6 proximas fechas
- [x] calculatePaymentStatus() con overdue/upcoming/scheduled/received/pending
- [x] detectPattern() reconoce frecuencia desde historial
- [x] predictFutureIncome() proyeccion a 3 meses
- [x] Backward compatibility: old paymentSchedule migra automaticamente
- [x] Income History (log permanente): transfer, deletion, reactivation
- [x] Propiedades computadas: activeSources, historySources, filteredHistory
- [x] Amount validation: solo numeros, error message
- [x] Processing signal: previene doble click
- [x] Categoria "Otros" → auto-recibido, solo historial
- [x] Modal confirmacion (verde), eliminacion (rojo), editar (ambar), reactivar (ambar)
- [x] Filter pills por categoria
- [x] Tabs: Fuentes Activas / Historial
- [x] Dashboard integration: actualIncome vs configuredIncome

#### 2.3 Gastos Dual (COMPLETO)
- [x] Sistema dual (primordial vs no primordial)
- [x] Estados: pending, partial, paid, overdue, cancelled
- [x] Fechas de vencimiento
- [x] Presupuesto vs real
- [x] Sistema extensible (providerDetails, debtDetails, serviceDetails, metadata)

#### 2.4 Flujo de Caja (COMPLETO)
- [x] Dashboard de flujo de caja
- [x] Ingresos presupuestados vs reales
- [x] Gastos presupuestados vs reales
- [x] Disponible ahora vs esperado
- [x] Comparativa: presupuesto vs actual

#### 2.5 Alertas (COMPLETO) ✅
- [x] Alerta: Presupuesto excedido
- [x] Alerta: Pago vencido
- [x] Alerta: Cambio de precio
- [x] Alertas centralizadas (8 tipos)
- [ ] Alertas activas en UI (pendiente)

#### 2.6 Goals (COMPLETO) ✅
- [x] Goals múltiples (prioridad, categorías, contribuciones)
- [x] Proyección de fecha (calculada automáticamente)
- [x] Historial de contribuciones por goal

#### 2.7 Comparativas (COMPLETO) ✅
- [x] Comparativa mes vs mes anterior
- [x] Tendencias de últimos N meses
- [x] Comparativa por categoría

#### 2.8 Month Rollover (COMPLETO) ✅
- [x] Auto-crear mes nuevo
- [x] Copiar budgets al mes siguiente
- [x] Gestión de gastos recurrentes

#### 2.9 Reportes/Export (COMPLETO) ✅
- [x] Exportar a CSV
- [x] Exportar a JSON
- [x] Reporte completo

#### 2.10 Offline Sync (COMPLETO) ✅
- [x] Cache local con IndexedDB
- [x] Sincronización automática
- [x] Cola de cambios pendientes

---

## Pendiente de Implementar

### Alta Prioridad
1. **Gastos UI upgrade** - Smart recurrence, Chart.js, history log, glassmorphism
2. **Budgets por categoria** - Presupuesto vs real en UI
3. **Alertas activas en UI** - mostrar alertas al usuario

### Media Prioridad
4. **Testing unitario**
5. **Recordatorios** - notificaciones de vencimiento

### Baja Prioridad
6. **Analytics persistidos** - guardar analytics por mes
7. **Insights automaticos** - sugerencias personalizadas
8. **Deteccion de transacciones recurrentes**
9. **OCR de recibos** (Fase 3)
10. **Open Banking** (Fase 4)

---

## Proximos Pasos Inmediatos

```
PROXIMO SPRINT:
├── Gastos UI upgrade (smart recurrence, Chart.js, glassmorphism)
├── Budgets por categoria (presupuesto vs real)
└── Alertas activas en UI

SIGUIENTE:
├── Testing unitario
├── Recordatorios
└── Analytics persistidos
```

---

## Documentación de Referencia

| Documento | Descripción |
|-----------|-------------|
| `financial-system-master.md` | Sistema completo (v2.0) |
| `expansion-guide.md` | Como expandir sin romper |
| `backend-analysis-and-methodology.md` | Analisis + metodologia |
| `database-schema.md` | Schema Firestore actualizado |
| `quick-reference.md` | Referencia rapida con incomeHistory |

---

**Ultima actualizacion**: Mayo 2026  
**Progreso**: ~85% del sistema completo (UI Income + Dashboard terminados)

---

## Registro de Milestones

| # | Milestone | Estado | Fecha |
|---|-----------|--------|-------|
| 001 | Firebase Migration | ✅ COMPLETO | - |
| 002 | Arquitectura Escalable | ✅ COMPLETO | - |
| 003 | Theme Light | ✅ COMPLETO | - |
| 004 | Sistema Financiero Completo | ✅ COMPLETO | Mayo 2026 |
| 005 | Goals Multiples | ✅ COMPLETO | Mayo 2026 |
| 006 | Income UI + Smart Recurrence | ✅ COMPLETO | Mayo 2026 |
| 007 | Dashboard UI (Chart.js + Glassmorphism) | ✅ COMPLETO | Mayo 2026 |