import crypto from 'crypto';

const PASSWORD_PREFIX = 'scrypt';
const TOKEN_PREFIX = 'hdn';

function getSecret() {
  return process.env.JWT_SECRET || 'change_this_secret';
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_PREFIX}$${salt}$${derivedKey}`;
}

export function verifyPassword(password, passwordHash) {
  if (!passwordHash || typeof passwordHash !== 'string') return false;
  const [prefix, salt, storedKey] = passwordHash.split('$');
  if (prefix !== PASSWORD_PREFIX || !salt || !storedKey) return false;
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derivedKey, 'hex'), Buffer.from(storedKey, 'hex'));
}

export function createToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${TOKEN_PREFIX}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [prefix, body, signature] = token.split('.');
  if (prefix !== TOKEN_PREFIX || !body || !signature) return null;

  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    permissions: user.permissions,
    employeeId: user.employeeId,
    phone: user.phone,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    active: user.active,
    assignedRouteIds: Array.isArray(user.assignedRouteIds) ? user.assignedRouteIds : [],
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
