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

### Empresa y personas
- **Multiempresa**: documentos, flujos, solicitudes, bitácora y cuotas cuelgan de la empresa, no del usuario
- **Cinco roles** con permisos declarados en una matriz: administrador, gerencia, jefatura de área, supervisión y colaborador
- **Invitaciones** con testigo de un solo uso y siete días de vigencia; revocables y reenviables
- **Suspensión** que retira el acceso sin borrar el historial
- **Aislamiento** aplicado en el cliente y, sobre todo, en las reglas de Firestore

### Bandeja y aprobaciones
- **Cinco bandejas**: mis pendientes, mis aprobaciones, mis observaciones, mis documentos e historial
- **Seis acciones** sobre una etapa: aprobar, observar, rechazar, solicitar corrección, delegar y reasignar
- **Delegar** mantiene al titular; **reasignar** transfiere la responsabilidad
- Un documento con etapas vivas **queda bloqueado para edición**
- **Trazabilidad**: quién creó, editó, aprobó, observó o rechazó, con fecha, hora y navegador

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
- **Etapas con responsable**: cada una declara quién la resuelve y en cuántos días
- **Duplicar** un flujo como plantilla, sin arrastrar su historial
- **Alta, edición y anulación** con motivo registrado
- **Resolución por etapas** en orden: aprobar avanza, observar devuelve, rechazar suspende
- **Reanudación** de un flujo suspendido, conservando lo ya resuelto
- **Historial de aprobaciones** con quién resolvió cada etapa y cuándo
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
- Razón social, RUC validado, sector, área que custodia el archivo y responsable
- **Prefijo de codificación** que entra en el código de cada documento: `CON-ADM-0001`
- Días de aviso previo al vencimiento, aplicados a los documentos nuevos
- Perfil de usuario y panel de desarrollador

---

## Arquitectura

```
src/app/
├── core/
│   ├── components/        # Icon, PasswordStrength
│   ├── guards/            # Guard de autenticación
│   ├── layout/            # Sidebar, Topbar y navegación móvil
│   ├── directives/        # Diálogo accesible: Escape, foco y retorno
│   ├── models/
│   │   ├── rbac.model.ts           # Roles, permisos y matriz
│   │   ├── company.model.ts        # Empresa, RUC, sector y prefijo
│   │   ├── member.model.ts         # Pertenencia y estado
│   │   ├── invitation.model.ts     # Invitaciones y testigos
│   │   ├── approval.model.ts       # Tareas de aprobación y bandejas
│   │   ├── audit.model.ts          # Trazabilidad
│   │   ├── document.model.ts       # Documentos, estados y vencimiento
│   │   ├── review-request.model.ts # Solicitudes de revisión
│   │   ├── history.model.ts        # Bitácora documental
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
│   │   ├── tenant.ts               # Empresa y rol de la sesión
│   │   ├── company.ts              # Configuración de la empresa
│   │   ├── members.ts              # Personas e invitaciones
│   │   ├── approvals.ts            # Tareas de aprobación
│   │   ├── audit.ts                # Registro de trazabilidad
│   │   └── dev-settings.ts
│   └── utils/
└── pages/
    ├── dashboard/         # Dashboard documental
    ├── documents/         # Documentos
    ├── review-requests/   # Solicitudes de revisión
    ├── history/           # Historial documental
    ├── workflows/         # Flujos de aprobación
    ├── workflow/          # Detalle: etapas, resoluciones e historial
    ├── storage/           # Gestión de almacenamiento
    ├── archive/           # Archivo histórico
    ├── indicators/        # Indicadores documentales
    ├── alerts/            # Alertas
    ├── inbox/             # Bandeja de aprobaciones
    ├── users/             # Personas e invitaciones
    ├── audit/             # Registro de trazabilidad
    ├── settings/          # Configuración empresarial
    ├── invitation/        # Aceptar una invitación
    ├── no-access/         # Sin pertenencia o sin permiso
    └── login/             # Acceso
```

---

## Modelo de datos

```
usuarios/{uid}                          → a qué empresa pertenece
invitaciones/{token}                    → índice público mínimo, por testigo

empresas/{empresaId}
  ├── miembros/{uid}                    → rol y estado: concede el acceso
  ├── invitaciones/{id}
  ├── documentos/{id}/archivos/{id}
  ├── solicitudes/{id}
  ├── flujos/{id}
  ├── tareas/{id}                       → etapas de aprobación
  ├── bitacora/{id}
  ├── auditoria/{id}                    → solo se añade
  └── periodos/{periodoId}/almacenamiento/{categoria}
```

La pertenencia es lo que abre la puerta: las reglas de Firestore leen
`empresas/{eid}/miembros/{uid}` en cada operación y comprueban estado y rol.
Sin ella, todo queda denegado por omisión.

---

## Puesta en marcha

Tres pasos, una sola vez. Los tres hacen falta: sin el primero el
aislamiento entre empresas vive solo en el navegador, y sin el tercero
no hay forma de entrar.

### 1. Desplegar las reglas

El flujo de GitHub publica el sitio, no las reglas. Estas van con la CLI
de Firebase:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore
```

El proyecto ya esta declarado en `.firebaserc`, asi que no pregunta cual.
Despliega `firestore.rules` y `firestore.indexes.json` a la vez.

**Hasta que esto se ejecute, cualquier cuenta autenticada puede leer los
datos de cualquier empresa.** Las comprobaciones del cliente son de
experiencia; la frontera real son las reglas.

### 2. Sembrar la primera empresa

No hay alta publica, y eso crea un huevo-y-gallina: quien crearia la
primera empresa todavia no pertenece a ninguna, asi que las reglas le
deniegan todo. Se rompe desde fuera, con las credenciales de
administrador del proyecto:

```bash
npm install --no-save firebase-admin
node scripts/sembrar-empresa.mjs \
  --clave "C:/ruta/clave-servicio.json" \
  --ruc 20123456789 \
  --razon "Constructora Andes S.A.C." \
  --email admin@empresa.com \
  --nombre "Nombre Apellido"
```

La clave de servicio sale de la consola de Firebase: Configuracion del
proyecto → Cuentas de servicio → Generar nueva clave privada. **Guardala
fuera del repositorio**: da acceso total al proyecto.

El script crea la empresa, la cuenta, la pertenencia con rol
`admin_empresa` y su asiento de auditoria; imprime la contrasena una sola
vez. Es idempotente: ejecutarlo dos veces con el mismo RUC no duplica
nada.

### 3. Invitar al resto

Desde **Personas**, ya dentro de la aplicacion. El script no vuelve a
hacer falta.

---

## Instalación

```bash
git clone https://github.com/<usuario>/archiva.git
cd archiva
pnpm install
pnpm start
```

Disponible en `http://localhost:4200`.

> Se usa **pnpm**, no npm. `@angular/fire@20` declara Angular 20 como dependencia
> de pares y el proyecto va con Angular 21: `npm install` aborta por ese conflicto.

### Pruebas

```bash
pnpm exec ng test --watch=false
```

134 casos sobre el motor de renovación, la máquina de estados, los flujos de
aprobación, la configuración de la empresa, el saneado de escrituras, las
guardas de sesión, la iconografía y el contraste WCAG de ambos temas. La
integración continua los ejecuta **antes** de compilar: un fallo no llega a
producción.

## Configuración de Firebase

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com).
2. Habilitar Authentication con Email/Password y Google.
3. Crear una base de datos Cloud Firestore.
4. Copiar las credenciales en `src/environments/environment.ts`.
5. Copiar el contenido de `firestore.rules` en la consola, o desplegarlo con
   `firebase deploy --only firestore:rules` si tienes la CLI configurada.

## Build y despliegue

```bash
npm run build
```

Configurado para Vercel mediante `vercel.json`.

---

## Licencia

Proyecto académico para el curso de Administración de Software. Todos los derechos reservados.
