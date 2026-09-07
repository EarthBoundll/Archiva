import { Injectable, computed, inject, signal } from '@angular/core';
import { FirebaseService } from './firebase';
import { Auth } from './auth';
import { Miembro, puedeEntrar } from '../models/member.model';
import { Rol, Permiso, tienePermiso, tieneAlguno } from '../models/rbac.model';
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

  private readonly _miembro   = signal<Miembro | null>(null);
  private readonly _cargando  = signal(true);
  private readonly _resuelto  = signal(false);
  private resolucion: Promise<Miembro | null> | null = null;

  readonly miembro  = this._miembro.asReadonly();
  readonly cargando = this._cargando.asReadonly();

  /** true cuando ya se intentó resolver, con o sin resultado. */
  readonly resuelto = this._resuelto.asReadonly();

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

  readonly motivoSinAcceso = computed<'sin_empresa' | 'suspendido' | 'invitado' | null>(() => {
    if (!this._resuelto()) return null;
    const m = this._miembro();
    if (!m) return 'sin_empresa';
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

        if (!empresaId) {
          this._miembro.set(null);
          return null;
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

  /** Olvida lo resuelto. Se llama al cerrar sesión. */
  limpiar(): void {
    this._miembro.set(null);
    this._resuelto.set(false);
    this._cargando.set(true);
    this.resolucion = null;
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

  puede(permiso: Permiso): boolean {
    return puedeEntrar(this._miembro()) && tienePermiso(this.rol(), permiso);
  }

  puedeAlguno(permisos: Permiso[]): boolean {
    return puedeEntrar(this._miembro()) && tieneAlguno(this.rol(), permisos);
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
