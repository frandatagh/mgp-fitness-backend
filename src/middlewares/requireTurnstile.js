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

      console.error(
        'Turnstile rechazado:',
        {
          errorCodes:
            verification.errorCodes,

          hostname:
            verification.hostname,

          action:
            verification.action,
        }
      );


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
     * No lo enviamos al schema ni a Prisma.
     */
    delete req.body.turnstileToken;


    next();

  } catch (error) {

    console.error(
      'Error verificando Turnstile:',
      error
    );


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