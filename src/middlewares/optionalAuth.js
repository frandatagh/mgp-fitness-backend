// src/middlewares/optionalAuth.js
import jwt from 'jsonwebtoken';

export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      req.user = null;
      return next();
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    return next();
  } catch (error) {
    // Si el token es inválido, no rompemos la ruta;
    // solo lo tratamos como invitado.
    req.user = null;
    return next();
  }
}