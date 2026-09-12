/**
 * El servicio de tenencia, instanciado de verdad.
 *
 * Existe porque la primera versión de las pruebas de la Fase 2 no
 * detectaba la peor regresión posible: quitar la lista blanca de
 * `puede()`. Reproducían la decisión en una función propia del fichero de
 * pruebas y comprobaban esa copia — así que la copia seguía siendo
 * correcta mientras el servicio dejaba de aplicarla.
 *
 * Es el mismo modo de fallo que ya costó dos correcciones en este
 * proyecto: una prueba que mira la declaración en vez de la aplicación.
 * Aquí se instancia el servicio con dobles y se le pregunta a él.
 */

import { TestBed } from '@angular/core/testing';

import { TenantService } from './tenant';
import { FirebaseService } from './firebase';
import { Auth } from './auth';

import { Rol, Permiso } from '../models/rbac.model';
import { PROHIBIDOS_EN_SOPORTE, PERMITIDOS_EN_SOPORTE, olvidarEmpresa } from '../models/plataforma.model';
import { Miembro } from '../models/member.model';

const OPERADOR = {
  uid: 'op-1',
  email: 'operador@plataforma.com',
  nombre: 'Operadora'
};

function miembroReal(rol: Rol): Miembro {
  return {
    uid: 'u-1', empresaId: 'e-1',
    email: 'maria@empresa.com', nombre: 'María',
    rol, estado: 'activo',
    area: 'administracion', fechaAlta: '2026-01-01'
  } as Miembro;
}

/**
 * Monta el servicio con la respuesta que la prueba decida.
 *
 * @param perfil     lo que devuelve el perfil global
 * @param miembro    la pertenencia, si el perfil declara empresa
 * @param operador   el documento de plataforma, si se consulta
 */
function montar(
  perfil: Record<string, unknown> | null,
  miembro: Miembro | null,
  operador: Record<string, unknown> | null
) {
  olvidarEmpresa();
  TestBed.resetTestingModule();

  const firebaseFalso = {
    getPerfilGlobal: () => Promise.resolve(perfil),
    getMiembro: () => Promise.resolve(miembro),
    getSuperAdmin: () => Promise.resolve(operador),
    marcarAcceso: () => Promise.resolve()
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: FirebaseService, useValue: firebaseFalso },
      { provide: Auth, useValue: { getUserId: () => 'u-1' } }
    ]
  });

  return TestBed.inject(TenantService);
}

describe('Tenencia · un usuario de empresa, sin cambios', () => {

  it('resuelve su pertenencia y no consulta la plataforma', async () => {
    let consultada = false;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: FirebaseService,
          useValue: {
            getPerfilGlobal: () => Promise.resolve({ empresaId: 'e-1' }),
            getMiembro: () => Promise.resolve(miembroReal(Rol.COLABORADOR)),
            getSuperAdmin: () => { consultada = true; return Promise.resolve(null); },
            marcarAcceso: () => Promise.resolve()
          }
        },
        { provide: Auth, useValue: { getUserId: () => 'u-1' } }
      ]
    });

    const tenant = TestBed.inject(TenantService);
    await tenant.resolver();

    // La propiedad de coste cero, comprobada ejecutando y no leyendo.
    expect(consultada).toBe(false);
    expect(tenant.esPlataforma()).toBe(false);
    expect(tenant.empresaId()).toBe('e-1');
  });

  it('conserva exactamente los permisos de su rol', async () => {
    const tenant = montar({ empresaId: 'e-1' }, miembroReal(Rol.ADMIN_EMPRESA), null);
    await tenant.resolver();

    // Si el filtro se colara en el camino normal, un administrador de
    // empresa perdería la mitad de sus permisos sin que nadie lo pidiera.
    for (const p of PROHIBIDOS_EN_SOPORTE) {
      if (p === Permiso.DOC_VER_CONFIDENCIAL || p === Permiso.ALMACENAMIENTO_GESTIONAR) continue;
      expect(tenant.puede(p)).toBe(true);
    }
  });

  it('un colaborador sigue sin poder aprobar', async () => {
    const tenant = montar({ empresaId: 'e-1' }, miembroReal(Rol.COLABORADOR), null);
    await tenant.resolver();
    expect(tenant.puede(Permiso.APROBAR)).toBe(false);
  });
});

describe('Tenencia · el operador de plataforma', () => {

  it('sin empresa en el perfil, se resuelve como plataforma', async () => {
    const tenant = montar(null, null, OPERADOR);
    await tenant.resolver();

    expect(tenant.esPlataforma()).toBe(true);
    expect(tenant.plataformaSinEmpresa()).toBe(true);
    expect(tenant.empresaId()).toBeNull();
    expect(tenant.motivoSinAcceso()).toBe('plataforma');
  });

  it('sin empresa y sin ser operador, sigue sin acceso', async () => {
    const tenant = montar(null, null, null);
    await tenant.resolver();

    expect(tenant.esPlataforma()).toBe(false);
    expect(tenant.motivoSinAcceso()).toBe('sin_empresa');
  });

  it('al entrar en una empresa, todo apunta a ella', async () => {
    const tenant = montar(null, null, OPERADOR);
    await tenant.resolver();

    tenant.entrarEn('e-99');

    expect(tenant.empresaId()).toBe('e-99');
    expect(tenant.exigirEmpresa()).toBe('e-99');
    expect(tenant.uid()).toBe(OPERADOR.uid);
    expect(tenant.rol()).toBe(Rol.ADMIN_EMPRESA);
  });

  it('no puede entrar quien no es operador', async () => {
    const tenant = montar({ empresaId: 'e-1' }, miembroReal(Rol.ADMIN_EMPRESA), null);
    await tenant.resolver();

    expect(() => tenant.entrarEn('e-99')).toThrow();
  });

  it('salir vacía la empresa pero conserva la condición de operador', async () => {
    const tenant = montar(null, null, OPERADOR);
    await tenant.resolver();
    tenant.entrarEn('e-99');

    tenant.salirDeEmpresa();

    expect(tenant.empresaId()).toBeNull();
    expect(tenant.esPlataforma()).toBe(true);
  });

  it('cerrar sesión olvida también la condición de operador', async () => {
    const tenant = montar(null, null, OPERADOR);
    await tenant.resolver();
    tenant.entrarEn('e-99');

    tenant.limpiar();

    expect(tenant.esPlataforma()).toBe(false);
    expect(tenant.empresaId()).toBeNull();
  });

  it('una recarga devuelve al operador a la empresa que visitaba', async () => {
    const primera = montar(null, null, OPERADOR);
    await primera.resolver();
    primera.entrarEn('e-77');

    // Segunda sesión sobre el mismo almacenamiento: es lo que hace una
    // recarga. No se llama a olvidarEmpresa, a diferencia de montar().
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: FirebaseService,
          useValue: {
            getPerfilGlobal: () => Promise.resolve(null),
            getMiembro: () => Promise.resolve(null),
            getSuperAdmin: () => Promise.resolve(OPERADOR),
            marcarAcceso: () => Promise.resolve()
          }
        },
        { provide: Auth, useValue: { getUserId: () => 'u-1' } }
      ]
    });

    const segunda = TestBed.inject(TenantService);
    await segunda.resolver();

    expect(segunda.empresaId()).toBe('e-77');
  });
});

// ============================================
// LA LISTA BLANCA, APLICADA POR EL SERVICIO
// ============================================

describe('Tenencia · el servicio aplica la lista blanca', () => {

  /**
   * Estas son las pruebas que faltaban.
   *
   * Comprueban que el servicio APLIQUE el filtro, no que el filtro esté
   * bien definido. Quitar la línea de `puede()` tiene que hacerlas fallar:
   * es la regresión que la primera versión de esta fase no detectaba.
   */

  for (const p of PROHIBIDOS_EN_SOPORTE) {
    it(`el servicio niega ${p} a un operador dentro de una empresa`, async () => {
      const tenant = montar(null, null, OPERADOR);
      await tenant.resolver();
      tenant.entrarEn('e-1');

      expect(tenant.puede(p)).toBe(false);
    });
  }

  it('los niega también en la variante de varios permisos', async () => {
    // Sin el filtro aquí, esta variante sería la puerta trasera de la otra.
    const tenant = montar(null, null, OPERADOR);
    await tenant.resolver();
    tenant.entrarEn('e-1');

    expect(tenant.puedeAlguno([Permiso.APROBAR, Permiso.DOC_EDITAR])).toBe(false);
  });

  it('pero deja pasar los permitidos en esa misma variante', async () => {
    const tenant = montar(null, null, OPERADOR);
    await tenant.resolver();
    tenant.entrarEn('e-1');

    expect(tenant.puedeAlguno([Permiso.APROBAR, Permiso.DOC_VER])).toBe(true);
  });

  for (const p of PERMITIDOS_EN_SOPORTE) {
    it(`el servicio concede ${p} a un operador dentro de una empresa`, async () => {
      const tenant = montar(null, null, OPERADOR);
      await tenant.resolver();
      tenant.entrarEn('e-1');

      expect(tenant.puede(p)).toBe(true);
    });
  }

  it('un operador sin empresa activa no puede nada', async () => {
    // La pertenencia es nula, así que no pasa ni la primera comprobación.
    const tenant = montar(null, null, OPERADOR);
    await tenant.resolver();

    for (const p of PERMITIDOS_EN_SOPORTE) {
      expect(tenant.puede(p)).toBe(false);
    }
  });
});
