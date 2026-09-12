/**
 * Siembra la primera empresa y su primer administrador.
 *
 * ARCHIVA no tiene alta publica: nadie crea su cuenta por su cuenta. Esa
 * decision resuelve el problema de que cualquiera entre, y crea otro: la
 * primera empresa no puede nacer desde dentro de la aplicacion, porque
 * quien la crearia todavia no pertenece a ninguna y las reglas le
 * deniegan todo.
 *
 * Este script rompe ese huevo-y-gallina desde fuera. Usa las credenciales
 * de administrador del proyecto, que saltan las reglas de Firestore por
 * diseno, asi que solo puede ejecutarlo quien tiene la clave del
 * proyecto. A partir de aqui el administrador sembrado invita al resto
 * desde la pantalla de Personas y este script no vuelve a hacer falta.
 *
 * ----------------------------------------------------------------------
 * USO
 *
 *   1. Consola de Firebase → Configuracion del proyecto → Cuentas de
 *      servicio → «Generar nueva clave privada». Baja un JSON.
 *
 *   2. Guardalo FUERA del repositorio. Esa clave da acceso total al
 *      proyecto: si acaba en un commit, hay que revocarla.
 *
 *   3. npm install --no-save firebase-admin
 *
 *   4. node scripts/sembrar-empresa.mjs \
 *        --clave "C:/ruta/a/la/clave.json" \
 *        --ruc 20123456789 \
 *        --razon "Constructora Andes S.A.C." \
 *        --email admin@empresa.com \
 *        --nombre "Diego Acosta"
 *
 *   5. La contrasena se imprime una sola vez. Cambiala al primer acceso.
 *
 * ----------------------------------------------------------------------
 * MODO OPERADOR DE PLATAFORMA
 *
 * El mismo script siembra tambien super administradores. No pertenecen a
 * ninguna empresa: operan la plataforma.
 *
 *   node scripts/sembrar-empresa.mjs --clave "C:/ruta/clave.json" \
 *     --superadmin --email operador@plataforma.com --nombre "Nombre Apellido"
 *
 * La cuenta tiene que existir ya en Firebase Authentication. El script no
 * la crea: un operador con acceso a todos los clientes no deberia nacer de
 * un comando que ademas inventa su contrasena.
 *
 * Y no hay marcha atras desde la aplicacion. Las reglas cierran la
 * escritura sobre esa coleccion sin excepcion, ni siquiera para otro super
 * administrador. Para retirar a alguien, hay que borrar su documento desde
 * la consola de Firebase o volver a ejecutar esto.
 * ----------------------------------------------------------------------
 */

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// ============================================
// ARGUMENTOS
// ============================================

function argumentos() {
  const a = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) out[a[i].slice(2)] = a[i + 1];
  }
  return out;
}

const arg = argumentos();

// Dos modos. El de plataforma no necesita RUC ni razon social porque no
// hay empresa: se siembra a una persona, no a una organizacion.
//
// Se detecta recorriendo argv y no por la tabla de pares: el parser toma
// lo siguiente a cada --clave como su valor, asi que una bandera suelta
// quedaria indefinida —o se comeria el argumento de al lado—.
const MODO_PLATAFORMA = process.argv.includes('--superadmin');

const REQUERIDOS = MODO_PLATAFORMA
  ? ['clave', 'email']
  : ['clave', 'ruc', 'razon', 'email'];

const FALTA = REQUERIDOS.filter(k => !arg[k]);
if (FALTA.length) {
  console.error('\nFaltan argumentos: --' + FALTA.join(' --'));
  console.error('\nSembrar una empresa:');
  console.error('  node scripts/sembrar-empresa.mjs --clave clave.json \\');
  console.error('    --ruc 20123456789 --razon "Constructora Andes S.A.C." \\');
  console.error('    --email admin@empresa.com --nombre "Diego Acosta"');
  console.error('\nSembrar un operador de plataforma:');
  console.error('  node scripts/sembrar-empresa.mjs --clave clave.json \\');
  console.error('    --superadmin --email operador@plataforma.com --nombre "Nombre"\n');
  process.exit(1);
}

// El RUC peruano son once digitos y empieza por 10 (persona natural con
// negocio) o 20 (persona juridica). Se comprueba aqui porque una empresa
// mal identificada arrastra el error a todos sus documentos.
if (!MODO_PLATAFORMA && !/^(10|20)\d{9}$/.test(arg.ruc)) {
  console.error('\nEse RUC no es valido: son once digitos que empiezan por 10 o 20.\n');
  process.exit(1);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(arg.email)) {
  console.error('\nEse correo no tiene forma de correo.\n');
  process.exit(1);
}

// ============================================
// ARRANQUE
// ============================================

let admin;
try {
  admin = await import('firebase-admin/app');
} catch {
  console.error('\nFalta firebase-admin. Instalalo sin guardarlo en el proyecto:');
  console.error('  npm install --no-save firebase-admin\n');
  process.exit(1);
}

const { initializeApp, cert } = admin;
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');

let credencial;
try {
  credencial = JSON.parse(readFileSync(arg.clave, 'utf8'));
} catch (e) {
  console.error('\nNo pude leer la clave: ' + e.message + '\n');
  process.exit(1);
}

initializeApp({ credential: cert(credencial) });
const db = getFirestore();
const auth = getAuth();

console.log('\nProyecto: ' + credencial.project_id);
if (MODO_PLATAFORMA) {
  console.log('Modo:     operador de plataforma');
  console.log('Cuenta:   ' + arg.email + '\n');
} else {
  console.log('Empresa:  ' + arg.razon + '  (RUC ' + arg.ruc + ')');
  console.log('Admin:    ' + arg.email + '\n');
}

// ============================================
// MODO OPERADOR DE PLATAFORMA
// ============================================
//
// Termina aqui: no hay empresa que sembrar.

if (MODO_PLATAFORMA) {
  // La cuenta tiene que existir. Crearla aqui significaria que un
  // comando puede fabricar un acceso a todos los clientes, con una
  // contrasena que ademas se inventa el propio comando.
  let operador;
  try {
    operador = await auth.getUserByEmail(arg.email);
  } catch {
    console.error(
      '\nNo existe ninguna cuenta con ese correo en Firebase Authentication.\n' +
      'Creala primero desde la consola, y vuelve a ejecutar esto.\n'
    );
    process.exit(1);
  }

  const ref = db.doc('superadmins/' + operador.uid);
  const previo = await ref.get();

  if (previo.exists) {
    console.log('· Ya era operador de plataforma. Nada que cambiar.');
  } else {
    // Los campos son informativos: ninguna regla los lee. Sirven para
    // saber quien es cada uid al mirar la coleccion desde la consola.
    await ref.set({
      uid: operador.uid,
      email: arg.email,
      nombre: arg.nombre ?? operador.displayName ?? arg.email,
      fechaAlta: new Date().toISOString(),
      altaPor: 'script de siembra'
    });
    console.log('· Operador de plataforma creado: superadmins/' + operador.uid);
  }

  console.log('\n' + '\u2500'.repeat(58));
  console.log('Listo. Esta cuenta opera la plataforma:');
  console.log('  Correo: ' + arg.email);
  console.log('  Uid:    ' + operador.uid);
  console.log('\n  No pertenece a ninguna empresa y, por ahora, no puede');
  console.log('  hacer nada: las reglas todavia no le conceden acceso.');
  console.log('  Eso llega con las fases siguientes.');
  console.log('\n  Para retirarle el acceso: borra ese documento desde la');
  console.log('  consola de Firebase. No se puede desde la aplicacion.');
  console.log('\u2500'.repeat(58) + '\n');

  process.exit(0);
}

// ============================================
// 1. LA EMPRESA
// ============================================

// El identificador se deriva del RUC: es lo unico que ya identifica a la
// empresa de forma univoca, y asi ejecutar el script dos veces con el
// mismo RUC apunta al mismo documento en vez de crear un duplicado.
const empresaId = 'e-' + arg.ruc;
const empresaRef = db.doc('empresas/' + empresaId);

const yaExiste = (await empresaRef.get()).exists;
if (yaExiste) {
  console.log('· La empresa ya existe. No se toca: solo se anade el administrador.');
} else {
  await empresaRef.set({
    id: empresaId,
    ruc: arg.ruc,
    razonSocial: arg.razon,
    nombreComercial: arg.nombreComercial ?? arg.razon,
    sector: arg.sector ?? 'otros',
    // El prefijo entra en el codigo de cada documento. Si no se indica,
    // se toman las tres primeras letras de la razon social.
    prefijo: (arg.prefijo ?? arg.razon.replace(/[^A-Za-zÑñ]/g, '').slice(0, 3)).toUpperCase(),
    direccion: arg.direccion ?? '',
    telefono: arg.telefono ?? '',
    email: arg.email,
    estado: 'activa',
    areasActivas: ['administracion', 'legal', 'operaciones', 'finanzas', 'rrhh'],
    fechaRegistro: new Date().toISOString(),
    creadaPor: 'script de siembra'
  });
  console.log('· Empresa creada: empresas/' + empresaId);
}

// ============================================
// 2. LA CUENTA
// ============================================

let usuario;
let contrasena = null;

try {
  usuario = await auth.getUserByEmail(arg.email);
  console.log('· La cuenta ya existia en Firebase Auth. Se reutiliza.');
} catch {
  // Doce bytes en base64url dan una contrasena que nadie adivina y que
  // se puede leer en voz alta para transcribirla una vez.
  contrasena = randomBytes(12).toString('base64url');
  usuario = await auth.createUser({
    email: arg.email,
    password: contrasena,
    displayName: arg.nombre ?? arg.email,
    emailVerified: false
  });
  console.log('· Cuenta creada en Firebase Auth.');
}

// ============================================
// 3. LA PERTENENCIA
// ============================================
//
// Es lo que abre la puerta. Sin este documento, la cuenta existe pero el
// guard la manda a «sin acceso» y las reglas le deniegan todo.

const miembroRef = db.doc('empresas/' + empresaId + '/miembros/' + usuario.uid);
const miembroPrevio = await miembroRef.get();

if (miembroPrevio.exists && miembroPrevio.data().rol === 'ADMIN_EMPRESA') {
  console.log('· Ya era administrador de esta empresa. Nada que cambiar.');
} else {
  await miembroRef.set({
    uid: usuario.uid,
    empresaId,
    email: arg.email,
    nombre: arg.nombre ?? arg.email,
    rol: 'ADMIN_EMPRESA',
    estado: 'activo',
    area: 'administracion',
    cargo: arg.cargo ?? 'Administrador',
    fechaAlta: new Date().toISOString(),
    altaPor: 'script de siembra'
  }, { merge: true });
  console.log('· Pertenencia creada con rol ADMIN_EMPRESA.');
}

// El perfil global dice a que empresa pertenece la cuenta. Es lo primero
// que lee TenantService al abrir sesion.
await db.doc('usuarios/' + usuario.uid).set({
  uid: usuario.uid,
  email: arg.email,
  nombre: arg.nombre ?? arg.email,
  empresaId,
  fechaRegistro: new Date().toISOString()
}, { merge: true });
console.log('· Perfil global enlazado a la empresa.');

// ============================================
// 4. TRAZA
// ============================================
//
// La siembra tambien se audita. Un acervo documental cuyo primer asiento
// aparece de la nada no explica de donde salio el administrador que lo
// creo todo.

await db.collection('empresas/' + empresaId + '/auditoria').add({
  actorUid: usuario.uid,
  actorNombre: arg.nombre ?? arg.email,
  actorRol: 'ADMIN_EMPRESA',
  accion: 'creo',
  entidad: 'empresa',
  entidadId: empresaId,
  entidadEtiqueta: arg.razon,
  detalle: 'Empresa sembrada desde el script de administracion',
  fecha: new Date().toISOString().slice(0, 10),
  hora: new Date().toTimeString().slice(0, 5),
  timestamp: new Date().toISOString(),
  agente: 'scripts/sembrar-empresa.mjs',
  servidor: true
});

// ============================================
// LISTO
// ============================================

console.log('\n' + '─'.repeat(58));
console.log('Listo. Entra en la aplicacion con:');
console.log('  Correo:     ' + arg.email);

if (contrasena) {
  console.log('  Contrasena: ' + contrasena);
  console.log('\n  Esta contrasena no se vuelve a mostrar. Copiala ahora y');
  console.log('  cambiala al primer acceso.');
} else {
  console.log('  Contrasena: la que ya tenia esa cuenta.');
}

console.log('\nDesde Personas ya puedes invitar al resto del equipo.');
console.log('Este script no vuelve a hacer falta.');
console.log('─'.repeat(58) + '\n');

process.exit(0);
