import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { Section, Two } from './ui.jsx';
import { getQueue } from '../db/offline.js';
import { fmtDateTime } from '../utils/money.js';

export default function Sync({ online, pending, syncPending }) {
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    getQueue().then(setQueue);
  }, [pending]);

  const handleSync = async () => {
    setSyncing(true);
    setResult('');
    const count = await syncPending();
    setSyncing(false);
    setResult(count > 0 ? `${count} operación(es) sincronizada(s) correctamente.` : 'Sin operaciones pendientes.');
    getQueue().then(setQueue);
  };

  return (
    <Two>
      <Section title="Estado de sincronización">
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          {online ? (
            <>
              <Wifi size={56} color="#16a34a" />
              <h2 style={{ margin: '12px 0 4px', color: '#16a34a' }}>En línea</h2>
              <p style={{ color: '#64748b' }}>Conectado al servidor. Los datos se guardan automáticamente.</p>
            </>
          ) : (
            <>
              <WifiOff size={56} color="#dc2626" />
              <h2 style={{ margin: '12px 0 4px', color: '#dc2626' }}>Sin conexión</h2>
              <p style={{ color: '#64748b' }}>Trabajando en modo offline. Los cambios se guardan localmente.</p>
            </>
          )}
        </div>

        {pending > 0 && (
          <div className="info-box info-orange">
            <strong>{pending} operación(es) pendiente(s) de sincronizar.</strong>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>Se sincronizarán automáticamente cuando vuelva la conexión.</p>
          </div>
        )}

        {online && (
          <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 16 }}
            onClick={handleSync} disabled={syncing}>
            <RefreshCw size={18} className={syncing ? 'spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        )}

        {result && (
          <div className="info-box info-green" style={{ marginTop: 12 }}>
            <CheckCircle2 size={16} style={{ marginRight: 6 }} />
            {result}
          </div>
        )}
      </Section>

      <Section title="Cola de operaciones pendientes">
        {queue.length === 0 ? (
          <div className="info-box info-green">
            <CheckCircle2 size={16} style={{ marginRight: 6 }} />
            Sin operaciones pendientes. Todo está sincronizado.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Operación</th><th>Ruta</th><th>Guardado</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {queue.map((op, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-blue">{op.method}</span></td>
                    <td><code>{op.path}</code></td>
                    <td>{fmtDateTime(op.queuedAt)}</td>
                    <td>
                      <span className={`badge badge-${op.synced ? 'green' : 'yellow'}`}>
                        {op.synced ? 'Sincronizado' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="info-box info-blue" style={{ marginTop: 16 }}>
          <strong>¿Cómo funciona el modo offline?</strong>
          <ul style={{ margin: '8px 0 0 16px', fontSize: 13, lineHeight: 1.8 }}>
            <li>El sistema detecta si hay conexión automáticamente</li>
            <li>Sin conexión, los cambios se guardan en el navegador (IndexedDB)</li>
            <li>Al reconectar, se sincronizan automáticamente</li>
            <li>Para instalar como app, usa el botón de instalación del navegador</li>
          </ul>
        </div>
      </Section>
    </Two>
  );
}
