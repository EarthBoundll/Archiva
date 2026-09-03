<div align="center">

# 🗄️ ARCHIVA

### Sistema Inteligente de Gestión Documental Empresarial

**Cada documento, en su sitio y a tiempo.**

![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=flat&logo=angular)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel)

</div>

---

## Qué es ARCHIVA

ARCHIVA es una plataforma web para la gestión documental de empresas: registra documentos, controla su estado y su vencimiento, gestiona sus versiones, tramita solicitudes de revisión, ejecuta flujos de aprobación por etapas y administra la capacidad de almacenamiento por categoría.

No es un repositorio de archivos. Es un sistema de **control**: responde en todo momento qué documentos hay, en qué estado están, quién debe aprobarlos, cuáles vencen y cuánto espacio ocupan.

---

## Módulos

### Documentos
- **12 categorías documentales**: contratos, facturas, órdenes de compra, memorandos, oficios, informes, resoluciones, convenios, manuales, políticas, procedimientos y otros
- **28 tipos documentales** agrupados por categoría
- **8 estados**: borrador, en revisión, pendiente de aprobación, aprobado, observado, rechazado, archivado y vencido
- **Codificación normalizada** `CAT-ÁREA-CORRELATIVO`
- **Control de versiones** con historial completo e identificación de la versión vigente
- **Control de vencimiento** con ciclo de renovación configurable en 8 frecuencias
- **Cálculo automático** de las próximas 6 fechas de renovación
- **Alerta anticipada** configurable por documento

### Solicitudes de Revisión
- **Sistema dual**: solicitudes prioritarias frente a solicitudes ordinarias
- **7 tipos prioritarios**: aprobación gerencial, revisión legal, subsanación de observación, actualización por vencimiento, validación de firma, corrección de datos y reasignación de responsable
- **9 tipos ordinarios**: revisión de formato, revisión ortográfica, actualización de anexos, cambio de categoría, solicitud de copia, digitalización, reclasificación, traslado a archivo y otros
- **Plazo de atención** con fecha límite y control de vencimiento
- **Detección de reincidencia** sobre el mismo documento
- **5 estados**: pendiente, en proceso, atendida, vencida y anulada

### Historial Documental
- **Bitácora permanente** agrupada por día
- **Entradas y salidas** con 8 acciones: creación, edición, nueva versión, envío a revisión, aprobación, observación, rechazo y archivado
- **Trazabilidad completa** con responsable, documento y versión afectada
- **Filtros** por acción, categoría, documento y texto libre

### Flujos de Aprobación
- **12 tipos de flujo**: aprobación de contrato, de factura, de presupuesto, revisión legal, visto bueno de gerencia, validación técnica, firma de convenio, publicación de política, homologación de proveedor, cierre de expediente, renovación documental y otros
- **Control por etapas**: etapas completadas sobre etapas totales, con porcentaje de avance
- **Proyección de cierre** según el ritmo real de aprobación
- **Prioridad** alta, media y baja
- **4 estados**: en curso, completado, suspendido y cancelado

### Gestión de Almacenamiento
- **Cuota por categoría documental** y periodo
- **Capacidad asignada frente a espacio utilizado**, con porcentaje de uso
- **Semáforo**: normal, en alerta, excedido y sin uso
- **Umbral de alerta** configurable, 80 % por defecto
- **Distribución automática** de la cuota entre categorías
- **Cierre de periodo** con arrastre del consumo

### Dashboard Documental
- **Total de documentos** y documentos activos
- **Aprobados, observados, vencidos y archivados**
- **Documentos por categoría**
- **Tiempo promedio de aprobación**
- **Flujo documental mensual**: entradas frente a salidas
- **Tendencia documental** de los últimos 6 periodos
- **Actividad reciente**
- **Alertas automáticas**: vencimientos próximos, documentos observados y cuotas excedidas

### Archivo Histórico
- Documentos archivados acumulados, con evolución temporal y meta de archivado del periodo

### Configuración Empresarial
- Razón social, RUC, sector, áreas y responsable del archivo
- Días de alerta por defecto y prefijo de codificación
- Perfil de usuario y panel de desarrollador

---

## Arquitectura

```
src/app/
├── core/
│   ├── components/        # Icon, PasswordStrength
│   ├── guards/            # Guard de autenticación
│   ├── layout/            # Sidebar, Topbar y navegación móvil
│   ├── models/
│   │   ├── company.model.ts        # Empresa y áreas
│   │   ├── document.model.ts       # Documentos, estados y vencimiento
│   │   ├── review-request.model.ts # Solicitudes de revisión
│   │   ├── history.model.ts        # Historial documental
│   │   ├── workflow.model.ts       # Flujos de aprobación
│   │   └── storage.model.ts        # Cuotas de almacenamiento
│   ├── services/
│   │   ├── firebase.ts             # Capa de acceso a Firestore
│   │   ├── auth.ts                 # Autenticación Firebase
│   │   ├── document.ts             # Documentos
│   │   ├── review-request.ts       # Solicitudes
│   │   ├── history.ts              # Historial
│   │   ├── workflow.ts             # Flujos de aprobación
│   │   ├── storage.ts              # Almacenamiento
│   │   ├── alerts.ts               # Motor de alertas
│   │   ├── email.ts                # Notificaciones
│   │   └── dev-settings.ts
│   └── utils/
└── pages/
    ├── dashboard/         # Dashboard documental
    ├── documents/         # Documentos
    ├── review-requests/   # Solicitudes de revisión
    ├── history/           # Historial documental
    ├── workflows/         # Flujos de aprobación
    ├── workflow/          # Detalle de flujo
    ├── storage/           # Gestión de almacenamiento
    ├── archive/           # Archivo histórico
    ├── indicators/        # Indicadores documentales
    ├── alerts/            # Alertas
    ├── settings/          # Configuración empresarial
    ├── onboarding/        # Configuración inicial
    └── login/             # Acceso
```

---

## Instalación

```bash
git clone https://github.com/<usuario>/archiva.git
cd archiva
npm install
npm start
```

Disponible en `http://localhost:4200`.

## Configuración de Firebase

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com).
2. Habilitar Authentication con Email/Password y Google.
3. Crear una base de datos Cloud Firestore.
4. Copiar las credenciales en `src/environments/environment.ts`.
5. Desplegar reglas: `firebase deploy --only firestore:rules`.

## Build y despliegue

```bash
npm run build
```

Configurado para Vercel mediante `vercel.json`.

---

## Licencia

Proyecto académico para el curso de Administración de Software. Todos los derechos reservados.
