/**
 * Borrado de la caché local del navegador.
 *
 * Vivía dentro del servicio de sincronización sin conexión, que se eliminó
 * por no tener consumidor: la aplicación nunca operó desconectada, pero sí
 * necesita limpiar lo que el navegador guardó al cerrar sesión.
 *
 * Es una función suelta, sin inyección de dependencias, porque Auth la
 * invoca al salir y el servicio dependía de Auth: inyectarla crearía un
 * ciclo.
 */
const BASES = ['archiva_offline', 'trackpays_offline'];

export async function borrarCacheLocal(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  await Promise.all(BASES.map(nombre => new Promise<void>(resolve => {
    const peticion = indexedDB.deleteDatabase(nombre);
    peticion.onsuccess = () => resolve();
    peticion.onerror   = () => resolve();
    // Si otra pestaña la tiene abierta, no se bloquea el cierre de sesión.
    peticion.onblocked = () => resolve();
  })));
}
