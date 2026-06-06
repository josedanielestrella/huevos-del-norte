import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';

function renderBootError(error) {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? error.stack : '';

  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#fff7ed;font-family:Arial,sans-serif;">
      <div style="width:min(720px,100%);background:#ffffff;border:1px solid #fdba74;border-radius:16px;padding:24px;box-shadow:0 12px 30px rgba(0,0,0,.08);">
        <h1 style="margin:0 0 12px;font-size:28px;color:#9a3412;">Error cargando el sistema</h1>
        <p style="margin:0 0 16px;color:#7c2d12;">La pagina cargo, pero el frontend fallo al iniciar.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#fff7ed;border-radius:12px;padding:16px;color:#7c2d12;overflow:auto;">${escapeHtml(message)}</pre>
        ${stack ? `<details style="margin-top:12px;"><summary style="cursor:pointer;color:#9a3412;">Ver detalle tecnico</summary><pre style="white-space:pre-wrap;word-break:break-word;background:#fff7ed;border-radius:12px;padding:16px;color:#7c2d12;overflow:auto;margin-top:12px;">${escapeHtml(stack)}</pre></details>` : ''}
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    }).catch(() => {});
  });
}

window.addEventListener('error', event => {
  renderBootError(event.error || event.message || 'Error no controlado');
});

window.addEventListener('unhandledrejection', event => {
  renderBootError(event.reason || 'Promesa rechazada sin manejar');
});

async function bootstrap() {
  try {
    const { default: App } = await import('./App.jsx');
    createRoot(document.getElementById('root')).render(<App />);
  } catch (error) {
    console.error('FRONTEND_BOOT_ERROR', error);
    renderBootError(error);
  }
}

bootstrap();
