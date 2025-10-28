import jwt from "jsonwebtoken";

/**
 * Verifica que exista un JWT válido en Authorization: Bearer <token>.
 * Si es válido, inyecta req.user = { id: <string> } y deja pasar.
 * Si no, responde 401.
 */
export function verifyToken(req, res, next) {
  try {
    // 1) Obtener header Authorization
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    // 2) Validar formato "Bearer <token>"
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Missing or invalid Authorization header" });
    }

    // 3) Verificar firma y expiración del JWT
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
      // Error de configuración: mejor explotar temprano
      const err = new Error("Server misconfigured: JWT_SECRET missing or too short");
      err.statusCode = 500;
      throw err;
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload.userId fue lo que firmaste en /login y /register
    req.user = { id: payload.userId };

    // 4) Continuar a la ruta protegida
    return next();
  } catch (err) {
    // jwt.verify lanza si el token es inválido o expiró
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}