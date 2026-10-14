// src/utils/verifyTurnstile.js

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';


export async function verifyTurnstile(token) {
  /*
   * Validación básica antes de consultar
   * a Cloudflare.
   */
  if (
    typeof token !== 'string' ||
    token.trim().length === 0 ||
    token.length > 2048
  ) {
    return {
      success: false,
      errorCodes: ['invalid-input-response'],
    };
  }


  const secret =
    process.env.TURNSTILE_SECRET_KEY;


  /*
   * Nunca continuamos si el servidor
   * no tiene configurada su clave.
   */
  if (!secret) {
    throw new Error(
      'TURNSTILE_SECRET_KEY no está configurada'
    );
  }


  const body =
    new URLSearchParams({
      secret,
      response: token,
    });


  const response =
    await fetch(
      TURNSTILE_VERIFY_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body,
      }
    );


  if (!response.ok) {
    throw new Error(
      `Error consultando Turnstile: ${response.status}`
    );
  }


  const data =
    await response.json();


  return {
    success:
      data?.success === true,

    errorCodes:
      Array.isArray(
        data?.['error-codes']
      )
        ? data['error-codes']
        : [],

    hostname:
      data?.hostname ?? null,

    action:
      data?.action ?? null,
  };
}