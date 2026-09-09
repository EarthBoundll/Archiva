import { Injectable, inject, signal } from '@angular/core';
import { FirebaseService } from './firebase';
import { TenantService } from './tenant';
import { AuditService } from './audit';
import {
  Miembro,
  MiembroPayload,
  EstadoMiembro,
  validarMiembro,
  puedeCambiarse,
  quedaOtroAdmin,
  iniciales
} from '../models/member.model';
import {
  Invitacion,
  InvitacionPayload,
  generarToken,
  fechaExpiracion,
  estadoReal,
  esAceptable,
  enlaceInvitacion,
  diasRestantes
} from '../models/invitation.model';
import { Rol, Permiso, puedeAsignarRol, rolesAsignablesPor, ROLES } from '../models/rbac.model';
import { AreaEmisora } from '../models/document.model';

/**
 * Personas de la empresa e invitaciones.
 *
 * ARCHIVA es software empresarial: nadie crea su cuenta por su cuenta. Un
 * administrador invita, la persona recibe un enlace con un testigo de un
 * solo uso y elige ahí su contraseña.
 */
@Injectable({ providedIn: 'root' })
export class MembersService {
  private firebase = inject(FirebaseService);
  private tenant = inject(TenantService);
  private audit = inject(AuditService);

  private readonly _miembros = signal<Miembro[]>([]);
  readonly miembros = this._miembros.asReadonly();

  // ------------------------------------------
  // MIEMBROS
  // ------------------------------------------

  async getMiembros(forzar = false): Promise<Miembro[]> {
    if (!forzar && this._miembros().length) return this._miembros();

    const empresaId = this.tenant.empresaOpcional();
    if (!empresaId) return [];

    const datos = await this.firebase.getMiembros(empresaId);
    const lista = (datos as any[])
      .map(m => this.normalizar(m, empresaId))
      .sort((a, b) => (ROLES[b.rol]?.nivel ?? 0) - (ROLES[a.rol]?.nivel ?? 0)
                   || a.nombre.localeCompare(b.nombre));

    this._miembros.set(lista);
    return lista;
  }

  /** Solo los que pueden recibir trabajo: activos. */
  async getActivos(): Promise<Miembro[]> {
    return (await this.getMiembros()).filter(m => m.estado === 'activo');
  }

  /** Candidatos a responsable de una etapa: quien puede aprobar. */
  async getAprobadores(): Promise<Miembro[]> {
    const permitidos: Rol[] = [Rol.ADMIN_EMPRESA, Rol.GERENTE, Rol.JEFE_AREA, Rol.SUPERVISOR];
    return (await this.getActivos()).filter(m => permitidos.includes(m.rol));
  }

  async cambiarRol(uid: string, nuevoRol: Rol): Promise<void> {
    this.exigir(Permiso.USUARIOS_EDITAR_ROL);

    const empresaId = this.tenant.exigirEmpresa();
    const actorUid = this.tenant.uid()!;
    const lista = await this.getMiembros(true);
    const objetivo = lista.find(m => m.uid === uid);
    if (!objetivo) throw new Error('Esa persona ya no pertenece a la empresa.');

    if (!puedeCambiarse(actorUid, uid)) {
      throw new Error('No puedes cambiarte el rol a ti mismo: pídeselo a otro administrador.');
    }
    if (!puedeAsignarRol(this.tenant.rol(), nuevoRol)) {
      throw new Error('No puedes conceder un rol por encima del tuyo.');
    }
    if (objetivo.rol === Rol.ADMIN_EMPRESA && nuevoRol !== Rol.ADMIN_EMPRESA
        && !quedaOtroAdmin(lista, uid)) {
      throw new Error('Es el único administrador activo: nombra otro antes de cambiarle el rol.');
    }

    await this.firebase.guardarMiembro(empresaId, uid, {
      rol: nuevoRol,
      actualizadoEl: new Date().toISOString()
    });

    await this.audit.registrarSobre(
      'cambio_rol', 'usuario', uid, objetivo.nombre,
      `De ${ROLES[objetivo.rol]?.label} a ${ROLES[nuevoRol]?.label}`
    );

    await this.getMiembros(true);
  }

  async cambiarEstado(uid: string, estado: EstadoMiembro, motivo?: string): Promise<void> {
    this.exigir(Permiso.USUARIOS_DESACTIVAR);

    const empresaId = this.tenant.exigirEmpresa();
    const actorUid = this.tenant.uid()!;
    const lista = await this.getMiembros(true);
    const objetivo = lista.find(m => m.uid === uid);
    if (!objetivo) throw new Error('Esa persona ya no pertenece a la empresa.');

    if (!puedeCambiarse(actorUid, uid)) {
      throw new Error('No puedes suspenderte a ti mismo.');
    }
    if (estado === 'suspendido' && objetivo.rol === Rol.ADMIN_EMPRESA
        && !quedaOtroAdmin(lista, uid)) {
      throw new Error('Es el único administrador activo: la empresa se quedaría sin quien la configure.');
    }

    await this.firebase.guardarMiembro(empresaId, uid, {
      estado,
      actualizadoEl: new Date().toISOString()
    });

    await this.audit.registrarSobre(
      estado === 'suspendido' ? 'suspendio' : 'reactivo',
      'usuario', uid, objetivo.nombre, motivo
    );

    await this.getMiembros(true);
  }

  async actualizarArea(uid: string, area: AreaEmisora): Promise<void> {
    this.exigir(Permiso.USUARIOS_EDITAR_ROL);
    const empresaId = this.tenant.exigirEmpresa();

    await this.firebase.guardarMiembro(empresaId, uid, {
      area, actualizadoEl: new Date().toISOString()
    });
    await this.getMiembros(true);
  }

  // ------------------------------------------
  // INVITACIONES
  // ------------------------------------------

  async getInvitaciones(): Promise<Invitacion[]> {
    const empresaId = this.tenant.empresaOpcional();
    if (!empresaId) return [];

    const datos = await this.firebase.getInvitaciones(empresaId);
    return (datos as any[]).map(i => ({ ...i, estado: estadoReal(i) } as Invitacion));
  }

  /** Solo las que siguen sirviendo para entrar. */
  async getPendientes(): Promise<Invitacion[]> {
    return (await this.getInvitaciones()).filter(i => i.estado === 'pendiente');
  }

  async invitar(p: InvitacionPayload): Promise<Invitacion> {
    this.exigir(Permiso.USUARIOS_INVITAR);

    const invalido = validarMiembro(p as MiembroPayload);
    if (invalido) throw new Error(invalido);

    if (!puedeAsignarRol(this.tenant.rol(), p.rol)) {
      throw new Error('No puedes invitar a alguien con un rol por encima del tuyo.');
    }

    const empresaId = this.tenant.exigirEmpresa();
    const email = p.email.trim().toLowerCase();

    // Ni dos invitaciones vivas al mismo correo ni invitar a quien ya está.
    const miembros = await this.getMiembros(true);
    if (miembros.some(m => m.email.toLowerCase() === email)) {
      throw new Error('Esa persona ya pertenece a la empresa.');
    }
    if ((await this.getPendientes()).some(i => i.email.toLowerCase() === email)) {
      throw new Error('Ya hay una invitación pendiente para ese correo.');
    }

    const actor = this.tenant.miembro()!;
    const ahora = new Date();

    // El nombre de la empresa viaja en la invitacion para que la pantalla
    // de aceptacion pueda decir a donde te estan invitando. Quien la abre
    // no puede leer la ficha de la empresa: no pertenece a ella todavia.
    const empresa = await this.firebase.getEmpresa(empresaId).catch(() => null);
    const nombreEmpresa = empresa?.['nombreComercial'] || empresa?.['razonSocial'] || '';

    // La marca, para que la pantalla de aceptacion no se vea generica.
    // Si falla, la invitacion sigue siendo valida: se vera con los
    // colores de la plataforma, que es peor pero no rompe nada.
    const marca = await this.firebase.getMarca(empresaId).catch(() => null);

    const invitacion: Omit<Invitacion, 'id'> = {
      empresaId,
      empresaNombre: nombreEmpresa,
      email,
      nombre: p.nombre.trim(),
      rol: p.rol,
      area: p.area,
      cargo: p.cargo?.trim(),
      token: generarToken(),
      estado: 'pendiente',
      invitadaPor: actor.uid,
      invitadaPorNombre: actor.nombre || actor.email,
      fechaEnvio: ahora.toISOString(),
      fechaExpira: fechaExpiracion(ahora)
    };

    const id = await this.firebase.crearInvitacion(empresaId, {
      ...invitacion,
      colorPrimario: marca?.['colorPrimario'],
      logo: marca?.['logo']
    });

    await this.audit.registrarSobre(
      'invito', 'invitacion', id, `${invitacion.nombre} (${email})`,
      `Rol ${ROLES[p.rol]?.label}`
    );

    return { ...invitacion, id } as Invitacion;
  }

  async revocar(inv: Invitacion, motivo?: string): Promise<void> {
    this.exigir(Permiso.USUARIOS_INVITAR);

    if (!esAceptable(inv)) {
      throw new Error('Esa invitación ya no está pendiente.');
    }

    const empresaId = this.tenant.exigirEmpresa();
    await this.firebase.actualizarInvitacion(empresaId, inv.id, inv.token, {
      estado: 'revocada',
      fechaRevocada: new Date().toISOString(),
      motivoRevocacion: motivo?.trim()
    });

    await this.audit.registrarSobre(
      'revoco', 'invitacion', inv.id, `${inv.nombre} (${inv.email})`, motivo
    );
  }

  /** Anula la anterior y emite una nueva con testigo fresco. */
  async reenviar(inv: Invitacion): Promise<Invitacion> {
    await this.revocar(inv, 'Reemplazada por una invitación nueva');
    return this.invitar({
      email: inv.email, nombre: inv.nombre,
      rol: inv.rol, area: inv.area, cargo: inv.cargo
    });
  }

  enlaceDe(inv: Invitacion): string {
    return enlaceInvitacion(inv.token);
  }

  diasQueLeQuedan(inv: Invitacion): number {
    return diasRestantes(inv);
  }

  // ------------------------------------------
  // CATALOGOS Y PRESENTACION
  // ------------------------------------------

  rolesQuePuedeAsignar(): Rol[] {
    return rolesAsignablesPor(this.tenant.rol());
  }

  inicialesDe(nombre: string): string {
    return iniciales(nombre);
  }

  // ------------------------------------------
  // INTERNO
  // ------------------------------------------

  private exigir(permiso: Permiso): void {
    if (!this.tenant.puede(permiso)) {
      throw new Error('Tu rol no permite esta acción.');
    }
  }

  private normalizar(m: any, empresaId: string): Miembro {
    return {
      uid: m.uid,
      empresaId: m.empresaId ?? empresaId,
      email: m.email ?? '',
      nombre: m.nombre ?? m.email ?? 'Sin nombre',
      rol: (m.rol ?? Rol.COLABORADOR) as Rol,
      estado: (m.estado ?? 'activo') as EstadoMiembro,
      area: (m.area ?? 'otros') as AreaEmisora,
      cargo: m.cargo,
      invitadoPor: m.invitadoPor,
      fechaAlta: m.fechaAlta ?? '',
      ultimoAcceso: m.ultimoAcceso,
      actualizadoEl: m.actualizadoEl
    };
  }
}
