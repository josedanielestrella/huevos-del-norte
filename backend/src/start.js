import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT || 5000);
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function isSameApiRunning() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (!response.ok) return false;

    const payload = await response.json();
    return payload?.ok === true && payload?.data?.status === 'ok';
  } catch {
    return false;
  }
}

async function bootstrap() {
  try {
    if (await isSameApiRunning()) {
      console.log(`La API ya esta corriendo en http://localhost:${PORT}`);
      process.exit(0);
    }

    const [{ startServer }, { initPersistence }] = await Promise.all([
      import('./server.js'),
      import('./config/persistence.js'),
    ]);

    initPersistence();
    startServer(PORT);
  } catch (error) {
    console.error('BOOT_ERROR');
    console.error(error);
    process.exit(1);
  }
}

await bootstrap();
