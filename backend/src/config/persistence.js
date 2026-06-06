import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { store } from '../store.js';
import { getDatabaseConfig } from './database.js';
import { hashPassword } from '../utils/auth.js';

let db = null;

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function hydrateStore(savedState) {
  if (!savedState || typeof savedState !== 'object') return;

  for (const key of Object.keys(savedState)) {
    store[key] = savedState[key];
  }
}

function syncBootstrapAdmin() {
  const email = String(process.env.ADMIN_EMAIL || 'josedanielestrella@outlook.com').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '1234');
  const displayName = String(process.env.ADMIN_NAME || 'Jose Daniel Estrella').trim() || 'Jose Daniel Estrella';

  let employee = store.employees.find(item => item.id === 'emp-admin');
  if (!employee) {
    employee = {
      id: 'emp-admin',
      name: displayName,
      phone: '',
      address: '',
      role: 'admin',
      salaryType: 'mensual',
      salaryAmount: 0,
      status: 'activo',
      createdAt: '2026-05-21T08:00:00.000Z',
    };
    store.employees.unshift(employee);
  } else {
    employee.name = displayName;
    employee.role = 'admin';
    employee.status = 'activo';
  }

  let user = store.users.find(item => item.id === 'usr-admin');
  if (!user) {
    user = {
      id: 'usr-admin',
      username: email,
      passwordHash: hashPassword(password),
      role: 'admin',
      permissions: ['*'],
      employeeId: 'emp-admin',
      name: displayName,
      phone: '',
      email,
      displayName,
      status: 'activo',
      active: true,
      assignedRouteIds: [],
      rememberTokenVersion: 1,
      passwordRecovery: {
        enabled: false,
        resetToken: null,
        resetRequestedAt: null,
      },
      createdAt: '2026-05-21T08:00:00.000Z',
      lastLoginAt: null,
    };
    store.users.unshift(user);
    return;
  }

  user.username = email;
  user.email = email;
  user.passwordHash = hashPassword(password);
  user.role = 'admin';
  user.permissions = ['*'];
  user.employeeId = 'emp-admin';
  user.name = displayName;
  user.displayName = displayName;
  user.status = 'activo';
  user.active = true;
  user.assignedRouteIds = Array.isArray(user.assignedRouteIds) ? user.assignedRouteIds : [];
  user.rememberTokenVersion = Number(user.rememberTokenVersion) || 1;
  user.passwordRecovery = {
    enabled: false,
    resetToken: null,
    resetRequestedAt: null,
  };
}

export function persistStore() {
  if (!db) return;

  db.prepare(`
    INSERT INTO app_state (id, state_json, updated_at)
    VALUES (1, @state_json, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `).run({
    state_json: JSON.stringify(store),
    updated_at: new Date().toISOString(),
  });
}

export function initPersistence() {
  const config = getDatabaseConfig();
  if (config.driver !== 'sqlite' || !config.sqlitePath) {
    return config;
  }

  ensureDirectory(config.sqlitePath);
  db = new Database(config.sqlitePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const row = db.prepare('SELECT state_json FROM app_state WHERE id = 1').get();
  if (row?.state_json) {
    hydrateStore(JSON.parse(row.state_json));
  }

  syncBootstrapAdmin();
  persistStore();

  return config;
}

export function closePersistence() {
  if (!db) return;
  db.close();
  db = null;
}
