const SESSION_KEY = 'hdn_session';
const SESSION_KIND_KEY = 'hdn_session_kind';

function resolveApiBase() {
  const envApi = import.meta.env.VITE_API_URL?.trim();
  if (envApi) return envApi.replace(/\/$/, '');

  if (typeof window === 'undefined') return 'http://localhost:5000/api';

  if (import.meta.env.DEV) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:5000/api`;
  }

  return '/api';
}

const API = resolveApiBase();

export function getStoredSession() {
  try {
    const storage = getSessionStorage();
    return JSON.parse(storage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function getSessionStorage() {
  const kind = localStorage.getItem(SESSION_KIND_KEY) || 'local';
  return kind === 'session' ? sessionStorage : localStorage;
}

export function saveSession(session, remember = true) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  localStorage.setItem(SESSION_KIND_KEY, remember ? 'local' : 'session');
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KIND_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export async function apiFetch(path, options = {}) {
  const session = getStoredSession();
  const headers = {
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(options.headers || {}),
  };

  let res;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifica que el backend este encendido e intentalo de nuevo.');
  }

  const json = await res.json().catch(() => ({ ok: false, message: 'Respuesta invalida del servidor' }));

  if (res.status === 401) {
    clearSession();
    const error = new Error(json.message || 'Sesion expirada');
    error.code = 401;
    throw error;
  }

  if (!json.ok) throw new Error(json.message || 'Error del servidor');
  return json.data;
}

export async function loginRequest({ username, password, remember }) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
    headers: {},
  });
  saveSession(data, remember);
  return data;
}

export async function logoutRequest() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } finally {
    clearSession();
  }
}
