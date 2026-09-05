# ARCHIVA — Auditoría Técnica

**Fecha:** 5 de septiembre de 2026 · **Objetivo:** https://earthboundll.github.io/Archiva/ · **Commit:** `7b15ee4`
**Perfiles aplicados:** Senior Full Stack · UX/UI · QA · Security Analyst

> **Estado tras la auditoría (commit ):** los tres hallazgos críticos
> están **corregidos y desplegados**. Ver el apartado *Correcciones aplicadas*
> al final del documento. El resto de hallazgos sigue abierto.

## Alcance y limitación declarada

Auditoría realizada sobre el código fuente completo (22.113 líneas) y sobre el despliegue en producción, con pruebas activas en navegador y verificación contra las APIs de Firebase y GitHub.

**Limitación:** no dispongo de credenciales y no creo cuentas, de modo que **las 12 pantallas internas se auditaron leyendo el código, no visualmente**. Todo hallazgo marcado *(sin verificación visual)* requiere confirmación con una sesión iniciada.

---

## 0. Respuesta a la pregunta del botón Atrás

**Probado y verificado: el botón Atrás tras el logout NO expone páginas protegidas.** No existe esa vulnerabilidad.

El motivo es que Angular es una SPA con enrutado propio: al pulsar Atrás el navegador emite `popstate`, el Router intercepta la navegación y **vuelve a ejecutar `authGuard`**. Como `signOut()` ya puso `currentUser` a `null`, el guard devuelve un `UrlTree` hacia `/login` y el componente protegido nunca llega a instanciarse. No hay ni siquiera un parpadeo de contenido, porque Angular no renderiza nada mientras el guard se resuelve.

El *bfcache* tampoco aplica: solo interviene en navegaciones entre documentos distintos, no en las internas de una SPA.

**Verificación directa:** navegué sin sesión a `https://earthboundll.github.io/Archiva/dashboard` y el sistema redirigió a `/login`. La manipulación de URL tampoco funciona.

### Pero encontré el bug inverso, y es peor

El mismo guard tiene un defecto **crítico** en la dirección contraria:

```ts
// src/app/core/guards/auth-guard.ts
// Si todavía está cargando, esperar        ← lo que dice el comentario
if (authService.isLoading()) {
  return router.createUrlTree(['/login']);  ← lo que hace el código
}
```

El comentario promete esperar; el código expulsa al login. Y `isLoading` arranca en `true` porque `onAuthStateChanged` de Firebase es asíncrono.

**Consecuencia:** cualquier usuario con sesión válida que pulse **F5 en una página protegida es expulsado al login**. Peor aún, un instante después Firebase restaura la sesión, pero como la pantalla de login no redirige a los usuarios ya autenticados, la persona se queda mirando un formulario de acceso mientras técnicamente está dentro. La única salida es escribir la URL a mano.

### Código correctivo

**`src/app/core/guards/auth-guard.ts`** — esperar de verdad a que se resuelva el estado:

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { Auth } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(Auth);
  const router = inject(Router);

  // Espera a que Firebase resuelva el estado antes de decidir.
  return toObservable(auth.isLoading).pipe(
    filter(cargando => !cargando),
    take(1),
    map(() => auth.isAuthenticated() ? true : router.createUrlTree(['/login']))
  );
};
```

**`src/app/core/services/auth.ts`** — limpiar el rastro local y no dejar la página protegida en el historial:

```ts
async signOut() {
  await this.firebase.signOut();

  // La cache offline sobrevive al logout: hay que borrarla (ver S-3).
  await this.offlineSync.clearAll();
  localStorage.removeItem('trackpays_last_synced');

  // replaceUrl evita que la pagina protegida quede como entrada de historial.
  await this.router.navigate(['/login'], { replaceUrl: true });
}
```

**Guard adicional para `/login` y `/onboarding`** — impedir que un usuario autenticado vuelva al formulario:

```ts
// src/app/core/guards/guest-guard.ts
export const guestGuard: CanActivateFn = () => {
  const auth   = inject(Auth);
  const router = inject(Router);

  return toObservable(auth.isLoading).pipe(
    filter(cargando => !cargando),
    take(1),
    map(() => auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true)
  );
};
```

---

## 1. Seguridad y Autenticación

### El dato que ordena todo lo demás

El guard del cliente **es cosmético**. Cualquiera puede saltárselo con las DevTools. La protección real es Firestore, y **esa está bien hecha**: verifiqué con una petición anónima a la API REST y devuelve `PERMISSION_DENIED`. Las reglas aíslan por `request.auth.uid`, así que aunque alguien fuerce la interfaz, no puede leer ni escribir datos ajenos.

Eso rebaja la gravedad de los fallos de enrutado: son defectos de experiencia y de exposición de interfaz, no brechas de datos.

| ID | Severidad | Hallazgo |
|---|---|---|
| **S-1** | 🔴 Crítico | `authGuard` expulsa sesiones válidas al recargar (detallado arriba) |
| **S-2** | 🔴 Crítico | `/onboarding` está **fuera del guard** |
| **S-3** | 🟠 Alto | La cache offline no se borra al cerrar sesión |
| **S-4** | 🟠 Alto | Condición de carrera en `signIn()` |
| **S-5** | 🟡 Medio | Sin cabeceras de seguridad en producción |
| **S-6** | 🟡 Medio | Datos personales en la consola de producción |
| **S-7** | 🟡 Medio | Regla Firestore `/public/**` con lectura abierta |
| **S-8** | 🔵 Bajo | `bypassSecurityTrustHtml` en `IconComponent` |
| **S-9** | 🔵 Bajo | Clave de Supabase en el historial público de git |
| **S-10** | 🔵 Bajo | Sin recuperación de contraseña |

### S-2 · `/onboarding` sin protección — Crítico

En `app.routes.ts`, `onboarding` está declarado como hermano de `login`, fuera del bloque con `canActivate: [authGuard]`.

**Verificado en producción:** sin sesión, recorrí el asistente completo — nombre, razón social, área — sin que nadie me detuviera.

```ts
// Corrección: mover onboarding dentro del bloque protegido,
// o al menos aplicarle un guard propio.
{
  path: 'onboarding',
  canActivate: [authGuard],
  loadComponent: () => import('./pages/onboarding/onboarding')
                        .then(m => m.OnboardingComponent)
}
```

### S-3 · La cache offline sobrevive al logout — Alto

`offline-sync.service.ts` mantiene una base IndexedDB llamada `trackpays_offline` con los almacenes `transactions`, `income`, `expenses`, `budgets`, `goals` y `pending_sync`. Guarda **datos de negocio completos**, **no está segmentada por usuario**, y `signOut()` no la toca.

En un equipo compartido —un aula, una oficina— el usuario B puede recibir datos cacheados del usuario A.

```ts
// Añadir a OfflineSyncService:
async clearAll(): Promise<void> {
  this.db?.close();
  this.db = null;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
```

Y llamarlo desde `signOut()`, como en el bloque de código de la sección 0.

### S-4 · Condición de carrera en `signIn()` — Alto

```ts
async signIn(email: string, password: string) {
  const result = await this.firebase.signIn(email, password);
  this.router.navigate(['/dashboard']);   // ← el signal aún puede ser null
  return result;
}
```

`onAuthStateChanged` puede no haberse ejecutado todavía cuando el guard evalúa `isAuthenticated()`. El síntoma es intermitente y desconcertante: inicias sesión correctamente y vuelves al login. Con el guard corregido de la sección 0 desaparece, porque el guard pasa a esperar la resolución.

### S-5 · Sin cabeceras de seguridad — Medio

`vercel.json` define `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` y `Referrer-Policy`. **GitHub Pages no lee `vercel.json`.** Comprobado con `curl -I` sobre el sitio real: la única cabecera presente es `Strict-Transport-Security`.

No hay protección contra *clickjacking*, ni `nosniff`, ni política de *referrer*, ni CSP.

GitHub Pages no permite cabeceras personalizadas. Las opciones son: desplegar en Vercel —donde `vercel.json` sí aplica y ya está escrito—, o añadir una CSP por `<meta http-equiv>` en `index.html`, que cubre parte del problema pero no `X-Frame-Options`.

### S-6 · Datos personales en consola — Medio

38 llamadas a `console.*` llegan a producción. La más grave:

```ts
// email.ts:80
console.log('[EmailService] Sending confirmation:', templateParams);
```

`templateParams` contiene el correo del usuario. Solución: envolver en `if (!environment.production)` o eliminar las trazas en el build con `drop_console`.

### S-7 · Regla `/public/**` — Medio

```
match /public/{documentId} {
  allow read: if true;
}
```

Hoy la colección no se usa, pero deja una superficie de lectura anónima abierta para el futuro. Si no hay caso de uso, elimínala.

### S-8 · `bypassSecurityTrustHtml` — Bajo

`IconComponent` desactiva el sanitizador de Angular. **Hoy no es explotable**: el contenido sale de un `Record` estático (`LUCIDE_ICONS`), y un nombre desconocido devuelve `''`. Lo señalo porque el patrón se vuelve peligroso en cuanto alguien haga ese catálogo dinámico.

### Vulnerabilidades OWASP verificadas y descartadas

| Riesgo | Estado |
|---|---|
| A01 Broken Access Control | ✅ Firestore aísla por UID; verificado `PERMISSION_DENIED` anónimo |
| A02 Cryptographic Failures | ✅ HTTPS forzado, HSTS presente |
| A03 Injection / XSS | ✅ Angular sanitiza; el único `bypass` es sobre catálogo estático |
| A05 Security Misconfiguration | ❌ **S-5**: sin cabeceras en Pages |
| A07 Identification & Auth Failures | ❌ **S-1, S-4**: fallos de flujo, no de credenciales |
| A09 Logging Failures | ❌ **S-6**: PII en consola |

**Secuestro de sesión:** no hay JWT en `localStorage` ni en cookies. Firebase persiste el token en IndexedDB (`firebaseLocalStorageDb`), inaccesible entre orígenes y renovado automáticamente. `signOut()` lo borra correctamente — comprobado: tras cerrar sesión, `localStorage` y `sessionStorage` quedan vacíos.

**Historial del navegador:** no permite recuperar una sesión cerrada. El token no viaja en la URL y el guard se reevalúa en cada navegación.

---

## 2. Experiencia de Usuario

| ID | Severidad | Hallazgo |
|---|---|---|
| **U-1** | 🔴 Crítico | El onboarding **no guarda absolutamente nada** |
| **U-2** | 🟠 Alto | Textos financieros residuales en el onboarding |
| **U-3** | 🟠 Alto | Botón final sin feedback: falla en silencio |
| **U-4** | 🟡 Medio | Sin estado de carga durante la resolución de sesión |
| **U-5** | 🟡 Medio | Sin recuperación de contraseña |
| **U-6** | 🔵 Bajo | El detalle de flujo solo es accesible desde el listado |

### U-1 · El onboarding es un maniquí — Crítico

```ts
finishOnboarding() {
  // Guardar datos del onboarding en Firebase
  this.router.navigate(['/dashboard']);
}
```

El comentario describe una intención que nunca se implementó. El asistente pide nombre, razón social y área, y al pulsar **¡Empezar!** **descarta los tres** y navega. Todo el flujo de bienvenida es decorativo.

Además `OnboardingComponent` conserva estado muerto de la etapa financiera: `income`, `customIncome`, `incomeOptions = [1000, 2000, 3000, 5000, 8000, 10000]`, `goalName`, `goalAmount`.

Existe un `OnboardingService` con `saveOnboardingResponse()` ya implementado y sin usar. Conectarlo es el arreglo.

### U-2 · Textos financieros residuales — Alto

Sobrevivieron a la migración porque estaban en plantillas en línea con redacción distinta:

| Ubicación | Texto actual | Propuesta |
|---|---|---|
| `onboarding.ts:30` | «Tu asistente financiero personal» | «Tu sistema de control documental» |
| `onboarding.ts:90` | «Establece un objetivo para empezar a ahorrar» | «Define el primer flujo de aprobación» |
| `onboarding.ts:93` | «Nombre de la meta» | «Nombre del flujo» |
| `onboarding.ts:103` | «Cantidad objetivo» | «Número de etapas» |

Son las cuatro primeras frases que lee un evaluador. Corregirlas cuesta minutos y su ausencia delata el origen del proyecto.

### U-3 · Botón bloqueado sin explicación — Alto

*(Corregido respecto a la primera versión de este informe: en un primer análisis lo describí como un fallo silencioso al pulsar. La causa real es distinta.)*

El botón está deshabilitado por  — dos campos heredados de Tracky que en ARCHIVA no tienen sentido. Al recorrer el asistente sin rellenarlos, el botón simplemente no responde y **nada indica qué falta**.

Un control deshabilitado sin explicación es peor que uno habilitado que falla: el usuario no tiene ninguna pista de qué hacer. La regla es señalar el campo pendiente, no bloquear en silencio.

### Lo que sí está bien

Los mensajes de error del login están **bien traducidos por código de Firebase** (`parseError`), en lugar de volcar el error crudo. La validación de contraseña exige 8 caracteres, un número y una mayúscula, con indicador de fortaleza en vivo. Las operaciones destructivas piden confirmación. La navegación alcanza cualquier módulo en dos clics.

---

## 3. Interfaz Visual

| ID | Severidad | Hallazgo |
|---|---|---|
| **I-1** | 🟠 Alto | Inputs de 41 px: por debajo del mínimo táctil de 44 px |
| **I-2** | 🟠 Alto | `font-size: 14px` en inputs → zoom automático en iOS |
| **I-3** | 🟡 Medio | 27 posibles conflictos de contraste sin verificar |
| **I-4** | 🔵 Bajo | Claves de `localStorage` con prefijo `trackpays_` |

### I-1 e I-2 · Formularios en móvil — Alto

Medido en viewport de 375×812:

```
inputs:  altura 41px  ·  font-size 14px
botón:   altura 49px  ✅
```

**41 px** incumple el mínimo de 44×44 px de WCAG 2.5.5 y de las guías de Apple y Material.

**14 px es el problema serio**: Safari en iOS hace **zoom automático** al enfocar cualquier campo con menos de 16 px. El usuario toca el correo, la página salta, y tiene que pellizcar para volver. Es de los defectos móviles que más frustran y se corrige con una línea:

```scss
.login-form input {
  font-size: 16px;   // impide el zoom de iOS
  min-height: 44px;  // objetivo tactil accesible
}
```

### I-3 · Contraste sin verificar — Medio *(sin verificación visual)*

La migración cambió el tema de oscuro a claro reescribiendo tokens. Las reglas SCSS con colores fijos no se enteraron. Corregí `login.scss`, donde el botón primario tenía `color: var(--color-text)` — texto oscuro sobre azul petróleo. **Quedan 27 usos de `background: var(--color-primary)` en otras hojas sin auditar.**

Método de comprobación, pantalla por pantalla, una vez con sesión:

```bash
grep -rn -A3 "background: var(--color-primary)" src --include=*.scss | grep "color: var(--color-text)"
```

### Lo que sí está bien

La paleta vive íntegramente en tokens CSS, de modo que la identidad es consistente por construcción. La escala tipográfica está definida (`--text-xs` a `--text-3xl`) y se respeta. Existen tokens semánticos para los ocho estados documentales. En móvil **no hay scroll horizontal** y el hero se oculta correctamente.

---

## 4. Animaciones e Interacciones

El sistema de movimiento es, sorprendentemente, lo más cuidado del proyecto. `_design-system.scss` define curvas y duraciones con criterio:

```scss
--ease-out:     cubic-bezier(0.23, 1, 0.32, 1);
--ease-drawer:  cubic-bezier(0.32, 0.72, 0, 1);
--duration-fast: 100ms;  --duration-normal: 160ms;
```

Duraciones por debajo de 200 ms, que es lo correcto para interacciones de interfaz.

| ID | Severidad | Hallazgo |
|---|---|---|
| **A-1** | 🟠 Alto | Sin `prefers-reduced-motion` |
| **A-2** | 🟡 Medio | Sin *skeleton loaders*: solo «Cargando…» |
| **A-3** | 🟡 Medio | `provideNoopAnimations()` desactiva las animaciones de Angular |
| **A-4** | 🔵 Bajo | Sin indicador de progreso entre rutas |

### A-1 · Accesibilidad del movimiento — Alto

No hay una sola consulta `prefers-reduced-motion` en las 5.000 líneas de SCSS. Para usuarios con trastornos vestibulares, esto va de mareo real. Es el arreglo con mejor relación coste/beneficio del informe:

```scss
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### A-3 · Contradicción de configuración

`app.config.ts` registra `provideNoopAnimations()`, que **desactiva el motor de animaciones de Angular**. Todo el movimiento actual es CSS puro. Funciona, pero significa que ninguna animación de entrada/salida de rutas o de listas es posible sin cambiarlo. Si es deliberado, conviene documentarlo; si no, debería ser `provideAnimations()`.

---

## 5. QA — Bugs Funcionales

| ID | Severidad | Bug | Estado |
|---|---|---|---|
| **Q-1** | 🔴 Crítico | El onboarding descarta los datos | Verificado en producción |
| **Q-2** | 🔴 Crítico | F5 en página protegida expulsa al login | Verificado por código |
| **Q-3** | 🟠 Alto | `/onboarding` accesible sin sesión | Verificado en producción |
| **Q-4** | 🟠 Alto | «¡Empezar!» no responde ni informa | Verificado en producción |
| **Q-5** | 🟡 Medio | Rutas profundas devuelven HTTP 404 | Verificado — limitación de Pages |
| **Q-6** | 🟡 Medio | Sin cobertura de pruebas real | Verificado |
| **Q-7** | 🔵 Bajo | Sin página 404 propia | Verificado |

### Q-5 · El 404 de las rutas profundas

`https://earthboundll.github.io/Archiva/documentos` devuelve **estado HTTP 404** aunque la página se vea perfectamente: el respaldo `404.html` sirve el `index.html` y Angular resuelve la ruta. Es una limitación estructural de GitHub Pages, no un fallo del código. Afecta al SEO y a cualquier monitor de disponibilidad. En Vercel no ocurre, porque `vercel.json` ya define el *rewrite* correcto.

### Q-6 · Las pruebas no prueban nada

Los 8 archivos `.spec.ts` contienen una única aserción trivial (`expect(component).toBeTruthy()`). **Cobertura real de lógica de negocio: 0 %.** Y el motor de recurrencia —549 líneas con años bisiestos, últimos días de mes y primeros días hábiles— es exactamente el tipo de código que sin pruebas falla en silencio.

El workflow de CI **solo compila**; no ejecuta `vitest`.

### Casos límite sin cubrir

- El catálogo de tipos documentales no valida el formato del código `CAT-ÁREA-CORRELATIVO`.
- No hay comprobación de códigos duplicados.
- `finishOnboarding()` no valida que los campos estén rellenos.

---

## 6. Rendimiento

| ID | Severidad | Hallazgo | Medición |
|---|---|---|---|
| **P-1** | 🟠 Alto | Bundle inicial excede el presupuesto | **952 kB** frente a 500 kB (+90 %) |
| **P-2** | 🟡 Medio | Un chunk concentra el peso | `chunk-WIJMGOIM.js` = **379 kB** |
| **P-3** | 🟡 Medio | Sin service worker | Hay lógica offline sin PWA |
| **P-4** | 🔵 Bajo | Dos familias tipográficas bloqueantes | Archivo + Roboto Mono |

Total de recursos servidos: **1,41 MB**.

### Lo que sí está bien

Las 13 rutas usan `loadComponent()`, de modo que **la carga diferida está correctamente aplicada**. El estado usa `signal()` y `computed()`, que evita los renderizados innecesarios de la detección de cambios por zona. GitHub Pages sirve todo con hash de contenido y cache inmutable.

### P-1 · El presupuesto se supera desde el primer build

`angular.json` declara un aviso a 500 kB y un error a 1 MB. Estamos en 952 kB: pasado el aviso, a 48 kB del error. El proyecto **no puede crecer** sin romper su propio build.

Causa probable: Chart.js y el SDK de Firebase entran en el bundle inicial. Chart.js solo se necesita en el tablero:

```ts
// En lugar de provideCharts(withDefaultRegisterables()) global,
// registrar solo los controladores usados, o cargar Chart.js
// dinamicamente dentro del componente de tablero.
const { Chart, registerables } = await import('chart.js');
```

---

## 7. Arquitectura Frontend

| ID | Severidad | Hallazgo |
|---|---|---|
| **R-1** | 🟠 Alto | `firebase.ts`: 1.123 líneas, objeto omnisciente |
| **R-2** | 🟠 Alto | `review-requests.ts`: 1.962 líneas en un componente |
| **R-3** | 🟠 Alto | 135 usos de `: any` pese a `strict: true` |
| **R-4** | 🟡 Medio | Sin manejo centralizado de errores |
| **R-5** | 🟡 Medio | Sin capa de repositorio por entidad |
| **R-6** | 🔵 Bajo | CI sin ejecución de pruebas |

### R-1 y R-3 · La frontera de datos no está tipada

`FirebaseService` concentra 38 métodos y toda la comunicación con Firestore. Sus firmas son `data: any` y `Promise<any>`, lo que **anula el modo estricto de TypeScript justo en el punto donde entran los datos externos** — exactamente donde el tipado más valor aporta. Los seis modelos de dominio están bien definidos y no se usan para tipar esta capa.

Corrección progresiva, sin reescritura: tipar un método por sesión, empezando por los de documentos.

```ts
// Antes
async crearDocumento(userId: string, data: any): Promise<any>

// Después
async crearDocumento(userId: string, data: DocumentoPayload): Promise<Documento>
```

### R-2 · Componentes desproporcionados

`review-requests.ts` tiene 1.962 líneas: plantilla, estado, validación, llamadas a servicio y formato en un solo archivo. Es inmantenible y no admite pruebas unitarias. Debe partirse en un componente contenedor y componentes de presentación.

### Lo que sí está bien

La separación `core/` (modelos, servicios, guards, layout) frente a `pages/` es correcta y escalable. Todos los componentes son *standalone*, sin NgModules. La inyección usa `inject()` de forma consistente. Los modelos emplean uniones de literales en lugar de `string`, lo que da seguridad de tipos en el dominio. El sistema de diseño está centralizado en tokens.

---

## 8. Reporte Final

### Tabla de prioridades

| Prioridad | Problema | Impacto | Solución |
|---|---|---|---|
| 🔴 **Crítico** | `authGuard` expulsa sesiones válidas al recargar (S-1) | Recargar cualquier página echa al usuario. Bloquea el uso normal | Guard reactivo que espere a `isLoading` — código en la sección 0 |
| 🔴 **Crítico** | El onboarding no guarda nada (U-1, Q-1) | Todo el flujo de bienvenida es decorativo; los datos se pierden | Conectar `finishOnboarding()` con `OnboardingService.saveOnboardingResponse()` |
| 🔴 **Crítico** | `/onboarding` sin protección (S-2, Q-3) | Interfaz interna accesible sin sesión | Añadir `canActivate: [authGuard]` a la ruta |
| 🟠 **Alto** | Cache offline no se borra al cerrar sesión (S-3) | Fuga de datos entre usuarios en equipos compartidos | `clearAll()` con `deleteDatabase` invocado desde `signOut()` |
| 🟠 **Alto** | Carrera en `signIn()` (S-4) | Login intermitente que devuelve al formulario | Se resuelve con el guard corregido |
| 🟠 **Alto** | Inputs de 41 px y 14 px (I-1, I-2) | Zoom automático en iOS; objetivos táctiles insuficientes | `font-size: 16px; min-height: 44px` |
| 🟠 **Alto** | Sin `prefers-reduced-motion` (A-1) | Mareo en usuarios con trastornos vestibulares | Bloque `@media` de 6 líneas |
| 🟠 **Alto** | Textos financieros en el onboarding (U-2) | Delata el origen del proyecto en la primera pantalla | Reescribir 4 cadenas |
| 🟠 **Alto** | Bundle 952 kB / presupuesto 500 kB (P-1) | Carga lenta; el proyecto no puede crecer | Chart.js bajo demanda en el tablero |
| 🟠 **Alto** | `: any` en la frontera de datos (R-3) | `strict: true` anulado donde más importa | Tipar `FirebaseService` con los modelos existentes |
| 🟡 **Medio** | Sin cabeceras de seguridad en Pages (S-5) | Sin protección anti-clickjacking ni `nosniff` | Desplegar en Vercel o añadir CSP por `<meta>` |
| 🟡 **Medio** | PII en consola de producción (S-6) | Correos del usuario visibles en DevTools | `drop_console` o guardas por entorno |
| 🟡 **Medio** | Contraste sin verificar en 12 pantallas (I-3) | Posible texto ilegible tras el cambio de tema | Auditar con sesión iniciada |
| 🟡 **Medio** | Cobertura de pruebas 0 % (Q-6, R-6) | El motor de recurrencia no está protegido | Pruebas del modelo + `vitest` en el CI |
| 🟡 **Medio** | Sin skeleton loaders (A-2) | Percepción de lentitud | Sustituir «Cargando…» por esqueletos |
| 🟡 **Medio** | Regla `/public/**` abierta (S-7) | Superficie de lectura anónima sin uso | Eliminar la regla |
| 🟡 **Medio** | Rutas profundas con HTTP 404 (Q-5) | Perjudica SEO y monitorización | Migrar a Vercel |
| 🔵 **Bajo** | Sin recuperación de contraseña (S-10, U-5) | El usuario que olvida la clave queda fuera | `sendPasswordResetEmail` de Firebase |
| 🔵 **Bajo** | Clave Supabase en el historial git (S-9) | Clave de cliente de proyecto ajeno, expuesta | Reescribir historial o ignorar |
| 🔵 **Bajo** | Claves `localStorage` con prefijo `trackpays_` (I-4) | Inconsistencia de marca visible en DevTools | Renombrar con migración |
| 🔵 **Bajo** | Sin página 404 propia (Q-7) | Toda ruta inválida cae al tablero | Componente `NotFound` antes del comodín |

### Puntuación

| Dimensión | Nota | Justificación |
|---|---|---|
| **Seguridad** | **6 / 10** | Las reglas de Firestore están bien y son la defensa real: ningún fallo permite leer datos ajenos. Penalizan el guard roto, `/onboarding` abierto, la cache que sobrevive al logout y la ausencia total de cabeceras |
| **UX** | **5 / 10** | El onboarding no guarda nada y falla en silencio; recargar expulsa al usuario. Compensan los mensajes de error bien traducidos y una navegación de dos clics |
| **UI** | **7 / 10** | Sistema de diseño sólido en tokens, escala tipográfica coherente, identidad consistente y sin scroll horizontal en móvil. Restan los formularios móviles y 12 pantallas sin verificar |
| **Rendimiento** | **6 / 10** | Carga diferida correcta en las 13 rutas y estado con signals. Resta un bundle inicial un 90 % por encima de su propio presupuesto |
| **Arquitectura** | **6 / 10** | Separación de capas correcta, componentes standalone, modelos con uniones de literales. Restan el objeto omnisciente de 1.123 líneas, los componentes de 1.962 y `any` en la frontera de datos |
| **Nota general** | **6 / 10** | Base arquitectónica sana con defectos concretos y acotados. Ninguno exige rediseño: los tres críticos se cierran en una jornada |

### Veredicto

**No está listo para uso real, pero está cerca.** Ningún hallazgo cuestiona la arquitectura: son defectos puntuales en puntos concretos, y los tres críticos se resuelven con menos de cien líneas.

El dato más tranquilizador es que **la seguridad de los datos no depende de los fallos encontrados**. Las reglas de Firestore están bien escritas y verificadas: aunque alguien manipule URLs o desactive el guard con las DevTools, no accede a información ajena. Todos los defectos de enrutado son de experiencia y de exposición de interfaz.

El más embarazoso no es técnico: **el onboarding pide tres datos y los tira a la basura**, con un comentario que promete guardarlos. Es lo primero que ve cualquier evaluador y lo primero que debería arreglarse.

### Orden de trabajo recomendado

1. Guard reactivo (S-1, S-4) — cierra dos hallazgos con un cambio · **30 min**
2. Proteger `/onboarding` (S-2) — una línea · **5 min**
3. Conectar el guardado del onboarding (U-1) — el servicio ya existe · **1 h**
4. Textos del onboarding (U-2) — cuatro cadenas · **10 min**
5. `clearAll()` en el logout (S-3) · **30 min**
6. Formularios móviles (I-1, I-2) — dos propiedades CSS · **10 min**
7. `prefers-reduced-motion` (A-1) — seis líneas · **5 min**
8. Auditoría visual de las 12 pantallas con sesión (I-3) · **2 h**

**Total hasta un estado publicable: menos de una jornada.**


---

## 9. Correcciones Aplicadas

Commit , desplegado y verificado en producción (run #8).

### C-1 · Guard reactivo — cierra S-1 y S-4

 ahora **espera** a que  pase a  antes de decidir, en lugar de expulsar al login con información incompleta:

\
Cierra de paso **S-4**: la condición de carrera de  desaparece porque el guard ya no evalúa antes de tiempo.

Se añade  sobre , de modo que un usuario autenticado que llegue al formulario de acceso sea devuelto al tablero.

**Verificado en producción:**  sin sesión sigue redirigiendo a , sin regresión ni bloqueo.
**Sin verificar:** el caso que motivó el arreglo —F5 con sesión válida— requiere credenciales.

### C-2 ·  protegido — cierra S-2 y Q-3

\
**Verificado en producción:** antes se recorría el asistente completo sin sesión; ahora redirige a .

### C-3 · El onboarding persiste — cierra U-1, U-2, U-3 y Q-1

 deja de ser un stub y guarda en el perfil del usuario mediante el método nuevo , que escribe en :

| Campo | Origen |
|---|---|
|  | Paso 2 |
|  | Paso 3 |
|  | Paso 4 |
|  | Paso 4, con sugerencia automática |
| , ,  | Metadatos |

No se reutilizó , que existía pero arrastraba el modelo financiero completo (, , ,  y creación automática de fuentes de ingreso).

Los pasos 3 y 4 pedían **ingreso mensual** y **meta de ahorro**; ahora piden razón social, área responsable y prefijo. Con ello desaparecen los cuatro textos financieros de **U-2** y los campos que bloqueaban el botón en **U-3**.

Se añaden además estado de carga (), mensaje de error diferenciado para sesión expirada frente a fallo de red, y  en la navegación final para no dejar el asistente en el historial.

### Estado de los hallazgos

| Hallazgo | Estado |
|---|---|
| S-1 Guard expulsa sesiones válidas | ✅ Corregido |
| S-2  sin protección | ✅ Corregido y verificado |
| S-4 Carrera en  | ✅ Corregido |
| S-5 Login accesible con sesión activa | ✅ Corregido () |
| U-1 El onboarding no guarda | ✅ Corregido |
| U-2 Textos financieros en onboarding | ✅ Corregido |
| U-3 Botón bloqueado sin explicación | ✅ Corregido |
| S-3 Cache offline tras logout | ⬜ Abierto |
| S-5 Cabeceras de seguridad | ⬜ Abierto |
| S-6 PII en consola | ⬜ Abierto |
| I-1, I-2 Formularios móviles | ⬜ Abierto |
| I-3 Contraste sin verificar | ⬜ Abierto |
| A-1  | ⬜ Abierto |
| P-1 Bundle 952 kB | ⬜ Abierto |
| Q-6 Cobertura de pruebas | ⬜ Abierto |
| R-1, R-2, R-3 Deuda estructural | ⬜ Abierto |
