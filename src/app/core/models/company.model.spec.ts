/**
 * Configuración de la empresa archivante.
 *
 * El asistente inicial recogía estos datos y ninguna otra parte del sistema
 * los leía: el prefijo que prometía usar en el código —«CON-ADM-0001»— no
 * llegaba al generador. Estas pruebas fijan las reglas de validación y, la
 * última, que el prefijo configurado sí acabe dentro del código.
 */

import {
  esPrefijoValido,
  esRucValido,
  validarEmpresa,
  sugerirPrefijo,
  estaConfigurada,
  EMPRESA_POR_DEFECTO,
  SECTORES,
  Empresa
} from './company.model';
import { generarCodigo, esCodigoValido } from './document.model';

function empresa(parcial: Partial<Empresa> = {}): Empresa {
  return {
    ...EMPRESA_POR_DEFECTO,
    razonSocial: 'Constructora Andes S.A.C.',
    ruc: '20123456789',
    responsableArchivo: 'M. Quispe',
    prefijoCodificacion: 'ADM',
    diasAlertaPorDefecto: 30,
    ...parcial
  };
}

describe('Empresa · prefijo de codificación', () => {

  it('acepta de tres a cinco letras', () => {
    expect(esPrefijoValido('ADM')).toBe(true);
    expect(esPrefijoValido('LEGAL')).toBe(true);
  });

  it('rechaza lo que no puede formar un código legible', () => {
    expect(esPrefijoValido('AD')).toBe(false);       // demasiado corto
    expect(esPrefijoValido('ADMINIS')).toBe(false);  // demasiado largo
    expect(esPrefijoValido('AD1')).toBe(false);      // con dígito
    expect(esPrefijoValido('A M')).toBe(false);      // con espacio
    expect(esPrefijoValido('')).toBe(false);
  });

  it('no distingue mayúsculas al validar', () => {
    expect(esPrefijoValido('adm')).toBe(true);
  });

  it('lo deriva del área cuando el usuario no lo escribe', () => {
    expect(esPrefijoValido(sugerirPrefijo('administracion'))).toBe(true);
    expect(esPrefijoValido(sugerirPrefijo('legal'))).toBe(true);
  });
});

describe('Empresa · RUC', () => {

  it('acepta los once dígitos con prefijo válido', () => {
    for (const inicio of ['10', '15', '17', '20']) {
      expect(esRucValido(inicio + '123456789')).toBe(true);
    }
  });

  it('rechaza longitudes y prefijos que no existen', () => {
    expect(esRucValido('2012345678')).toBe(false);   // diez dígitos
    expect(esRucValido('201234567890')).toBe(false); // doce
    expect(esRucValido('30123456789')).toBe(false);  // prefijo inexistente
    expect(esRucValido('20abcdefghi')).toBe(false);
  });

  it('admite dejarlo en blanco: no toda organización lo tiene al empezar', () => {
    expect(esRucValido('')).toBe(true);
    expect(esRucValido('   ')).toBe(true);
  });
});

describe('Empresa · validación completa', () => {

  it('acepta una configuración completa', () => {
    expect(validarEmpresa(empresa())).toBeNull();
  });

  it('exige razón social', () => {
    expect(validarEmpresa(empresa({ razonSocial: '' }))).toContain('razón social');
    expect(validarEmpresa(empresa({ razonSocial: 'ab' }))).toContain('tres caracteres');
  });

  it('exige responsable del archivo', () => {
    expect(validarEmpresa(empresa({ responsableArchivo: '' }))).toContain('responde del archivo');
  });

  it('exige un prefijo utilizable', () => {
    expect(validarEmpresa(empresa({ prefijoCodificacion: 'A1' }))).toContain('prefijo');
  });

  it('acota el aviso previo entre uno y trescientos sesenta y cinco días', () => {
    expect(validarEmpresa(empresa({ diasAlertaPorDefecto: 0 }))).toContain('1 a 365');
    expect(validarEmpresa(empresa({ diasAlertaPorDefecto: 400 }))).toContain('1 a 365');
    expect(validarEmpresa(empresa({ diasAlertaPorDefecto: 1 }))).toBeNull();
    expect(validarEmpresa(empresa({ diasAlertaPorDefecto: 365 }))).toBeNull();
  });

  it('deja pasar un RUC vacío pero no uno mal formado', () => {
    expect(validarEmpresa(empresa({ ruc: '' }))).toBeNull();
    expect(validarEmpresa(empresa({ ruc: '999' }))).toContain('RUC');
  });
});

describe('Empresa · estado de configuración', () => {

  it('no está configurada mientras falte lo mínimo', () => {
    expect(estaConfigurada(null)).toBe(false);
    expect(estaConfigurada(EMPRESA_POR_DEFECTO)).toBe(false);
    expect(estaConfigurada(empresa({ prefijoCodificacion: '' }))).toBe(false);
    expect(estaConfigurada(empresa({ razonSocial: '' }))).toBe(false);
  });

  it('está configurada con razón social y prefijo', () => {
    expect(estaConfigurada(empresa())).toBe(true);
  });

  it('ofrece los ocho sectores del catálogo', () => {
    expect(Object.keys(SECTORES).length).toBe(8);
  });
});

describe('Empresa · el prefijo llega al código del documento', () => {

  it('usa el prefijo configurado, que es lo que el asistente promete', () => {
    // El asistente enseña «CON-ADM-0001» mientras el usuario escribe el
    // prefijo. Antes el generador tomaba las siglas del área y esa promesa
    // no se cumplía nunca.
    expect(generarCodigo('contrato', 'legal', 1, 'ADM')).toBe('CON-ADM-0001');
  });

  it('sin prefijo configurado conserva las siglas del área', () => {
    const codigo = generarCodigo('contrato', 'legal', 1);
    expect(codigo.startsWith('CON-')).toBe(true);
    expect(codigo.endsWith('-0001')).toBe(true);
    expect(esCodigoValido(codigo)).toBe(true);
  });

  it('ignora un prefijo que no serviría para codificar', () => {
    // Un prefijo mal formado no debe colarse en el código: se cae al área.
    const conBasura = generarCodigo('contrato', 'legal', 1, 'A1!');
    const sinNada   = generarCodigo('contrato', 'legal', 1);
    expect(conBasura).toBe(sinNada);
  });

  it('el código resultante sigue cumpliendo el formato normalizado', () => {
    for (const p of ['ADM', 'LEGAL', 'RRHH']) {
      expect(esCodigoValido(generarCodigo('factura', 'finanzas', 42, p))).toBe(true);
    }
  });

  it('rellena el correlativo a cuatro dígitos', () => {
    expect(generarCodigo('oficio', 'gerencia', 7, 'GER')).toBe('OFI-GER-0007');
    expect(generarCodigo('oficio', 'gerencia', 1234, 'GER')).toBe('OFI-GER-1234');
  });
});
