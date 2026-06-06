import { service } from '../services/storeService.js';
import { verifyToken } from '../utils/auth.js';

export function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = verifyToken(token);

  if (!payload?.sub) {
    const error = new Error('Sesion invalida o expirada');
    error.statusCode = 401;
    return next(error);
  }

  const user = service.getUserById(payload.sub);
  if (!user || user.status !== 'activo' || user.active === false) {
    const error = new Error('Usuario no autorizado');
    error.statusCode = 401;
    return next(error);
  }

  req.auth = {
    token,
    payload,
    user,
    safeUser: service.getSafeUserById(user.id),
  };
  return next();
}

export function requireAdmin(req, _res, next) {
  if (req.auth?.user?.role === 'admin') return next();
  const error = new Error('Solo el administrador puede realizar esta accion');
  error.statusCode = 403;
  return next(error);
}

export function requireVendorRoute(req, _res, next) {
  if (req.auth?.user?.role === 'admin') return next();
  const routeId = req.params.id || req.body.routeId || req.body.assignedRouteId || req.body.route?.id;
  if (!routeId) {
    const error = new Error('Debes indicar una ruta');
    error.statusCode = 400;
    return next(error);
  }
  const allowed = service.getAccessibleRouteIds(req.auth.user);
  if (!allowed.includes(routeId)) {
    const error = new Error('No tienes acceso a esa ruta');
    error.statusCode = 403;
    return next(error);
  }
  return next();
}
