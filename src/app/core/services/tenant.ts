import { Injectable, computed, inject, signal, Injector } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { AuditService } from './audit';
import { Miembro, puedeEntrar } from '../models/member.model';
import { Rol, Permiso, tienePermiso, tieneAlguno } from '../models/rbac.model';
import {
  OperadorPlataforma,
  pertenenciaSintetica,
  permitidoEnSoporte,
  recordarEmpresa,
  empresaRecordada,
  olvidarEmpresa
} from '../models/plataforma.model';
import { log } from '../utils/logger';

/**
 * Resuelve a qué empresa pertenece quien ha iniciado sesión y con qué rol.
 *
 * Es la pieza de la que cuelga todo lo demás: ningún servicio vuelve a
 * consultar `users/{uid}/...`, sino `empresas/{empresaId}/...`, y el
 * identificador de empresa sale siempre de aquí. Antes cada cuenta era una
 * isla con su propio acervo y no existía nada que aislar.
 *
 * La resolución cuesta dos lecturas —el perfil global y la pertenencia— y
 * se hace una sola vez por sesión, no una por consulta.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private firebase = inject(FirebaseService);
  private authService = inject(Auth);

  /**
   * El inyector, para resolver la auditoria cuando haga falta.
   *
   * No se inyecta AuditService directamente porque el ciclo seria
   * inmediato: ese servicio toma de aqui la empresa y el actor, asi que
   * ya depende de esta clase. Angular lo detecta al construir y falla.
   *
   * Resolverlo en el momento de usarlo deshace el nudo sin mover la
   * responsabilidad: cuando entrarEn() se ejecuta, los dos servicios
   * llevan rato construidos. Y la garantia de que no se entra sin dejar
   * constancia sigue viviendo donde se entra, que es donde tiene que
   * estar — sacarla a quien llama la convertiria en una convencion.
   */
  private readonly inyector = inject(Injector);

  private readonly _miembro   = signal<Miembro | null>(null);
  private readonly _cargando  = signal(true);
  private readonly _resuelto  = signal(false);
  private resolucion: Promise<Miembro | null> | null = null;

  /**
   * Quien opera la plataforma, si la sesion es de plataforma.
   *
   * Se guarda aparte de la pertenencia sintetica porque sobrevive a
   * entrar y salir de empresas: la condicion de operador no cambia al
   * cambiar de cliente.
   */
  private readonly _operador = signal<OperadorPlataforma | null>(null);

  readonly miembro  = this._miembro.asReadonly();
  readonly cargando = this._cargando.asReadonly();

  /** true cuando ya se intentó resolver, con o sin resultado. */
  readonly resuelto = this._resuelto.asReadonly();

  /**
   * ¿La sesion en curso es de plataforma?
   *
   * Es un estado, no un rol ni un permiso: describe quien esta dentro,
   * no lo que puede hacer. Por si solo no concede nada — un operador
   * sin empresa activa tiene el identificador de empresa en nulo,
   * igual que alguien sin acceso.
   */
  readonly esPlataforma = computed(() => this._operador() !== null);

  /** El operador, para mostrarlo y —desde la Fase 3— para atribuirle. */
  readonly operador = this._operador.asReadonly();

  /** Un operador de plataforma que todavia no ha entrado en ninguna. */
  readonly plataformaSinEmpresa = computed(() =>
    this.esPlataforma() && this._miembro() === null
  );

  readonly empresaId = computed(() => this._miembro()?.empresaId ?? null);
  readonly rol       = computed<Rol | null>(() => this._miembro()?.rol ?? null);
  readonly uid       = computed(() => this._miembro()?.uid ?? null);
  readonly nombre    = computed(() => this._miembro()?.nombre ?? '');

  /**
   * Alguien autenticado que no pertenece a ninguna empresa, o cuya
   * pertenencia está suspendida. No es un error: es un estado que la
   * aplicación tiene que saber mostrar.
   */
  readonly sinAcceso = computed(() =>
    this._resuelto() && !puedeEntrar(this._miembro())
  );

  readonly motivoSinAcceso = computed<'sin_empresa' | 'suspendido' | 'invitado' | 'plataforma' | null>(() => {
    if (!this._resuelto()) return null;
    const m = this._miembro();

    // Un operador sin empresa activa no esta excluido: esta esperando a
    // elegir una. Decirle que no pertenece a ninguna empresa seria
    // literalmente cierto y completamente inutil.
    if (!m) return this.esPlataforma() ? 'plataforma' : 'sin_empresa';
    if (m.estado === 'suspendido') return 'suspendido';
    if (m.estado === 'invitado')   return 'invitado';
    return null;
  });

  // ------------------------------------------
  // RESOLUCION
  // ------------------------------------------

  /**
   * Averigua la empresa del usuario en curso.
   *
   * Las llamadas simultáneas comparten la misma promesa: al arrancar,
   * varias guardas y pantallas la piden a la vez.
   */
  async resolver(forzar = false): Promise<Miembro | null> {
    if (!forzar && this._resuelto()) return this._miembro();
    if (!forzar && this.resolucion)  return this.resolucion;

    const uid = this.authService.getUserId();
    if (!uid) {
      this._miembro.set(null);
      this._resuelto.set(true);
      this._cargando.set(false);
      return null;
    }

    this._cargando.set(true);

    this.resolucion = (async () => {
      try {
        const perfil = await this.firebase.getPerfilGlobal(uid);
        const empresaId = perfil?.['empresaId'] as string | undefined;

        // Sin empresa en el perfil, este camino terminaba aqui en nulo.
        // Ahora cuelga de el la via de plataforma, y solo de el: un usuario
        // de empresa NUNCA llega a evaluarla, asi que no paga la lectura.
        if (!empresaId) {
          return await this.resolverPlataforma(uid);
        }

        const miembro = await this.firebase.getMiembro(empresaId, uid);
        this._miembro.set(miembro);

        // Deja constancia del acceso sin bloquear el arranque.
        if (miembro && puedeEntrar(miembro)) {
          this.firebase.marcarAcceso(empresaId, uid)
            .catch(e => log.warn('[Tenant] no se pudo registrar el acceso:', e));
        }

        return miembro;
      } catch (e) {
        log.error('[Tenant] no se pudo resolver la empresa:', e);
        this._miembro.set(null);
        return null;
      } finally {
        this._resuelto.set(true);
        this._cargando.set(false);
        this.resolucion = null;
      }
    })();

    return this.resolucion;
  }

  /**
   * ¿Es operador de plataforma? Y si lo es, ¿donde estaba?
   *
   * Una lectura, y solo para quien no tiene empresa. Ese caso ya
   * terminaba en «sin acceso» tras una consulta fallida, asi que el
   * coste anadido para un usuario normal es exactamente cero.
   */
  private async resolverPlataforma(uid: string): Promise<Miembro | null> {
    const datos = await this.firebase.getSuperAdmin(uid);

    if (!datos) {
      this._operador.set(null);
      this._miembro.set(null);
      return null;
    }

    const operador = datos as OperadorPlataforma;
    this._operador.set(operador);

    // Si venia de una empresa —una recarga, un enlace directo—, vuelve
    // a ella. Si no, queda en modo plataforma sin empresa activa.
    const retenida = empresaRecordada();
    this._miembro.set(retenida ? pertenenciaSintetica(operador, retenida) : null);

    return this._miembro();
  }

  /**
   * Entra en una empresa para dar soporte.
   *
   * Puebla la pertenencia sintetica, de la que derivan el identificador
   * de empresa, el rol, el uid y el nombre. A partir de ahi los 28
   * puntos de servicio y las 27 comprobaciones de permiso apuntan a esa
   * empresa sin saber que quien mira es de plataforma.
   *
   * No cuesta ninguna lectura: la pertenencia se construye en memoria.
   */
  async entrarEn(empresaId: string, motivo: string): Promise<void> {
    const operador = this._operador();
    if (!operador) {
      throw new Error('Solo un operador de plataforma puede entrar en una empresa.');
    }
    if (!empresaId?.trim()) {
      throw new Error('Indica en que empresa entrar.');
    }
    if (!motivo?.trim()) {
      // Obligar a escribir por que se entra convierte la visita en un acto
      // deliberado. Es el mismo razonamiento por el que observar y
      // rechazar ya exigen motivo en el flujo de aprobacion.
      throw new Error('Indica por que entras: queda registrado en la auditoria de la empresa.');
    }

    // La pertenencia se puebla ANTES de asentar, porque el servicio de
    // auditoria toma de aqui la empresa y el actor. Si el asiento falla,
    // se deshace: no puede quedar dentro sin constancia.
    const anterior = this._miembro();
    this._miembro.set(pertenenciaSintetica(operador, empresaId));
    this._resuelto.set(true);
    this._cargando.set(false);

    try {
      const audit = this.inyector.get(AuditService);
      await audit.registrarOFallar({
        accion: 'acceso_soporte',
        entidad: 'empresa',
        entidadId: empresaId,
        entidadEtiqueta: empresaId,
        detalle: 'Acceso de soporte de plataforma',
        motivoIntervencion: motivo.trim()
      });
    } catch (e) {
      // Aqui la tolerancia se invierte respecto al resto del sistema. En
      // una operacion de usuario, perder el documento porque no se pudo
      // anotar seria peor que perder la anotacion. En una entrada de
      // plataforma, entrar sin dejar rastro es lo que no puede pasar.
      this._miembro.set(anterior);
      log.error('[Plataforma] entrada abortada: no se pudo dejar constancia', e);
      throw new Error(
        'No se pudo registrar el acceso en la auditoria de esa empresa. ' +
        'La entrada se ha cancelado: no se entra sin dejar constancia.'
      );
    }

    // Solo despues de que conste. Asi, si la pestana se recarga, vuelve a
    // una empresa en la que ya hay registro de haber entrado.
    recordarEmpresa(empresaId);
  }

  /**
   * Sale de la empresa visitada.
   *
   * Cambiar de empresa es salir y volver a entrar, no una transicion
   * directa. Modelarlo como transicion invitaria a dejar residuos de la
   * anterior — y hay uno concreto: el servicio de empresa cachea la
   * ficha en una senal y solo la recarga si se le fuerza. Sin una salida
   * limpia, el operador veria la ficha de la empresa anterior sobre los
   * datos de la nueva.
   */
  salirDeEmpresa(): void {
    olvidarEmpresa();
    this._miembro.set(null);
  }

  /** Olvida lo resuelto. Se llama al cerrar sesión. */
  limpiar(): void {
    this._miembro.set(null);
    this._resuelto.set(false);
    this._cargando.set(true);
    this.resolucion = null;

    // El modo y la empresa visitada mueren con la sesion: en un equipo
    // compartido, quien entre despues no debe heredar ni una cosa ni otra.
    this._operador.set(null);
    olvidarEmpresa();
  }

  /**
   * Identificador de empresa, o error.
   *
   * Los servicios lo llaman antes de cada consulta: si falta, es un fallo
   * de programación —una consulta lanzada sin sesión resuelta— y conviene
   * que se note, no que devuelva una lista vacía silenciosa.
   */
  exigirEmpresa(): string {
    const id = this.empresaId();
    if (!id) throw new Error('Sin empresa activa: la sesión no está resuelta.');
    return id;
  }

  /** Igual, pero devuelve null en vez de lanzar. Para lecturas opcionales. */
  empresaOpcional(): string | null {
    return this.empresaId();
  }

  // ------------------------------------------
  // PERMISOS
  // ------------------------------------------

  /**
   * ¿Puede quien mira hacer esto?
   *
   * Punto unico: las 27 comprobaciones de la aplicacion pasan por aqui, y
   * desde la Fase 2 tambien la guarda de rutas. Un solo sitio donde se
   * decide es lo que evita que dos capas digan cosas distintas.
   *
   * En modo plataforma se consulta la lista blanca ANTES que el rol. La
   * pertenencia sintetica lleva rol de administrador de empresa —el unico
   * que abre todas las pantallas—, y ese rol tiene en la matriz permiso
   * para editar documentos, aprobar etapas y anular solicitudes. Lo que no
   * este escrito en la lista no se concede, aunque el rol lo tenga.
   */
  puede(permiso: Permiso): boolean {
    if (!puedeEntrar(this._miembro())) return false;
    if (this.esPlataforma() && !permitidoEnSoporte(permiso)) return false;
    return tienePermiso(this.rol(), permiso);
  }

  /**
   * Igual con varios permisos.
   *
   * El filtro se aplica aqui tambien y no es redundante: sin el, esta
   * variante seria la puerta trasera de la anterior.
   */
  puedeAlguno(permisos: Permiso[]): boolean {
    if (!puedeEntrar(this._miembro())) return false;

    const alcanzables = this.esPlataforma()
      ? permisos.filter(permitidoEnSoporte)
      : permisos;

    return tieneAlguno(this.rol(), alcanzables);
  }

  /** Versión reactiva, para ocultar controles en las plantillas. */
  permiso(p: Permiso) {
    return computed(() => this.puede(p));
  }

  esAdmin(): boolean {
    return this.rol() === Rol.ADMIN_EMPRESA;
  }

  /**
   * ¿Ve el acervo completo o solo lo suyo?
   *
   * Un colaborador no tiene DOC_VER_TODOS: sus consultas se acotan a los
   * documentos que él registró.
   */
  veTodo(): boolean {
    return this.puede(Permiso.DOC_VER_TODOS);
  }
}
