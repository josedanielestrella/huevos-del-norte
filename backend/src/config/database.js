import path from 'node:path';

const DEFAULT_DATABASE_URL = 'sqlite:./data/huevos-del-norte.db';

export function resolveDatabaseUrl() {
  return String(process.env.DATABASE_URL || DEFAULT_DATABASE_URL).trim() || DEFAULT_DATABASE_URL;
}

export function resolveSqlitePath(databaseUrl = resolveDatabaseUrl()) {
  if (!databaseUrl.startsWith('sqlite:')) return null;
  const rawPath = databaseUrl.slice('sqlite:'.length).trim();
  if (!rawPath) return path.resolve(process.cwd(), 'data', 'huevos-del-norte.db');
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

export function getDatabaseConfig() {
  const databaseUrl = resolveDatabaseUrl();
  const sqlitePath = resolveSqlitePath(databaseUrl);
  const cloudSql = {
    instanceId: process.env.CLOUD_SQL_INSTANCE_ID || '',
    databaseName: process.env.DATABASE_NAME || '',
    serviceId: process.env.SERVICE_ID || '',
  };
  const externalConnectionConfigured = Boolean(databaseUrl && !sqlitePath);

  return {
    driver: sqlitePath ? 'sqlite' : 'external',
    databaseUrl,
    databaseUrlConfigured: Boolean(databaseUrl),
    sqlitePath,
    cloudSqlReady: Boolean(
      cloudSql.instanceId
      && cloudSql.databaseName
      && cloudSql.serviceId
      && externalConnectionConfigured
    ),
    cloudSql,
    note: sqlitePath
      ? 'El backend guarda el estado en SQLite local. Para Cloud SQL luego debes reemplazar DATABASE_URL por la cadena real de conexion.'
      : 'Hay una DATABASE_URL externa configurada, pero este backend aun no tiene adaptador SQL relacional para esa conexion.',
  };
}
