/**
 * Sello de compilación.
 *
 * Sirve para responder «¿estoy viendo la versión nueva?» sin abrir las
 * herramientas de desarrollo: durante la migración hubo varias sesiones
 * mirando una copia en caché y creyendo que un cambio no se había aplicado.
 *
 * Se calcula al compilar, no en tiempo de ejecución, para que la cadena
 * quede congelada dentro del paquete publicado.
 */
export const SELLO_COMPILACION: string = new Date().toISOString().slice(0, 16).replace('T', ' ');
