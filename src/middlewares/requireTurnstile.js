// src/middlewares/requireTurnstile.js

import {
  verifyTurnstile,
} from '../utils/verifyTurnstile.js';


export async function requireTurnstile(
  req,
  res,
  next
) {
  try {
    const token =
      req.body?.turnstileToken;


    const verification =
      await verifyTurnstile(
        token
      );


    if (!verification.success) {
      return res
        .status(403)
        .json({
          message:
            'No se pudo validar la verificación de seguridad. Intenta nuevamente.',

          code:
            'TURNSTILE_FAILED',
        });
    }


    /*
     * El token ya cumplió su función.
     *
     * Lo eliminamos antes de pasar
     * al schema de Contacto para que
     * NO forme parte de los datos
     * normales de la aplicación.
     */
    delete req.body.turnstileToken;


    next();

  } catch (error) {

    console.error(
      'Error verificando Turnstile:',
      error
    );


    /*
     * Fallamos de forma segura.
     *
     * Si Cloudflare no puede verificarse,
     * NO dejamos pasar el formulario.
     */
    return res
      .status(503)
      .json({
        message:
          'No se pudo comprobar la verificación de seguridad. Intenta nuevamente en unos momentos.',

        code:
          'TURNSTILE_UNAVAILABLE',
      });
  }
}