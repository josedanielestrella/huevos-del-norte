import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRoutes from './routes/index.js';
import { getDatabaseConfig } from './config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(__dirname, '..', '..', 'frontend', 'dist');

export function createApp() {
  const app = express();
  const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const hasFrontendDist = fs.existsSync(frontendDistPath);

  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      if (clientUrls.includes(origin)) return callback(null, true);
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
  }));
  app.use(express.json());
  app.use(morgan('dev'));

  app.use('/api', apiRoutes);

  if (hasFrontendDist) {
    app.use(express.static(frontendDistPath, {
      etag: false,
      lastModified: false,
      maxAge: 0,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html') || filePath.endsWith('manifest.json') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  } else {
    app.get('/', (_, res) => res.json({
      ok: true,
      app: 'Huevos del Norte API',
      database: getDatabaseConfig(),
    }));
  }

  app.use((error, _req, res, _next) => {
    const status = error.statusCode || 500;
    res.status(status).json({
      ok: false,
      message: error.message || 'Error interno del servidor',
    });
  });

  return app;
}

export function startServer(port = Number(process.env.PORT || 5000)) {
  const app = createApp();
  const server = app.listen(port, () => {
    console.log(`API corriendo en http://localhost:${port}`);
  });

  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`No se pudo iniciar la API: el puerto ${port} ya esta en uso.`);
      console.error('Cierra la instancia anterior o define otro PORT en backend/.env.');
      process.exit(1);
    }

    console.error('No se pudo iniciar la API.', error);
    process.exit(1);
  });

  return server;
}
