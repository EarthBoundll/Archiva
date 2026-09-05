import { environment } from '../../../environments/environment';

/**
 * Registro de trazas silenciado en produccion.
 *
 * Las llamadas directas a console.* llegaban al build publicado y algunas
 * volcaban datos personales del usuario —el correo, dentro de los parametros
 * de las plantillas de EmailJS— visibles para cualquiera que abriese las
 * herramientas de desarrollo.
 *
 * error() se conserva siempre: un fallo real debe poder diagnosticarse en
 * produccion, y nunca recibe datos del usuario como argumento.
 */
const enDesarrollo = !environment.production;

export const log = {
  debug(...args: unknown[]): void {
    if (enDesarrollo) console.log(...args);
  },

  warn(...args: unknown[]): void {
    if (enDesarrollo) console.warn(...args);
  },

  error(...args: unknown[]): void {
    console.error(...args);
  }
};
