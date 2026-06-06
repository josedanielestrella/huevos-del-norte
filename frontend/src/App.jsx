import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch, getStoredSession, logoutRequest } from './utils/api.js';
import { saveCache, getCache, addToQueue, getQueue, markSynced } from './db/offline.js';
import Dashboard from './components/Dashboard.jsx';
import Inventory from './components/Inventory.jsx';
import Purchases from './components/Purchases.jsx';
import Suppliers from './components/Suppliers.jsx';
import Sales from './components/Sales.jsx';
import Clients from './components/Clients.jsx';
import Routes from './components/Routes.jsx';
import Trucks from './components/Trucks.jsx';
import Expenses from './components/Expenses.jsx';
import Receivables from './components/Receivables.jsx';
import Payables from './components/Payables.jsx';
import Reports from './components/Reports.jsx';
import SettingsPage from './components/Settings.jsx';
import Sync from './components/Sync.jsx';
import Login from './components/Login.jsx';
import Users from './components/Users.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import VendorLayout from './layouts/VendorLayout.jsx';
import BrandLogo from './components/BrandLogo.jsx';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [state, setState] = useState(null);
  const [dash, setDash] = useState(null);
  const [reports, setReports] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [session, setSession] = useState(() => getStoredSession());

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, onClose: () => setToast(null) });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const logout = useCallback(async (message = '') => {
    await logoutRequest().catch(() => {});
    setSession(null);
    setState(null);
    setDash(null);
    setReports(null);
    setError('');
    setLoading(false);
    if (message) showToast(message, 'warning');
  }, [showToast]);

  const load = useCallback(async (silent = false) => {
    if (!session?.token) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setError('');
    try {
      if (navigator.onLine) {
        const [s, d, r] = await Promise.all([
          apiFetch('/state'),
          apiFetch('/dashboard'),
          apiFetch('/reports'),
        ]);
        setState(s);
        setDash(d);
        setReports(r);
        await Promise.all([saveCache('state', s), saveCache('dashboard', d), saveCache('reports', r)]);
      } else {
        const [s, d, r] = await Promise.all([
          getCache('state'),
          getCache('dashboard'),
          getCache('reports'),
        ]);
        if (!s) throw new Error('Sin cache local. Inicia sesion con internet en la primera carga.');
        setState(s);
        setDash(d);
        setReports(r);
      }
    } catch (loadError) {
      if (loadError.code === 401) {
        await logout('La sesion expiro. Inicia sesion de nuevo.');
        return;
      }
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [logout, session?.token]);

  const submit = useCallback(async (path, body, method = 'POST') => {
    try {
      if (navigator.onLine) {
        const response = await apiFetch(path, {
          method,
          ...(method === 'DELETE' ? {} : { body: JSON.stringify(body) }),
        });
        showToast('Guardado correctamente');
        await load(true);
        return response;
      } else {
        await addToQueue({ path, body, method });
        setPending(count => count + 1);
        showToast('Guardado localmente. Se sincronizara al reconectar.', 'warning');
        return { queued: true };
      }
    } catch (submitError) {
      if (submitError.code === 401) {
        await logout('La sesion expiro. Inicia sesion de nuevo.');
        return;
      }
      showToast(submitError.message, 'error');
      return null;
    }
  }, [load, logout, showToast]);

  const syncPending = useCallback(async () => {
    const queue = await getQueue();
    let synced = 0;
    for (const op of queue) {
      try {
        await apiFetch(op.path, {
          method: op.method,
          ...(op.method === 'DELETE' ? {} : { body: JSON.stringify(op.body) }),
        });
        await markSynced(op.id);
        synced += 1;
      } catch {
        // leave queued
      }
    }
    if (synced > 0) {
      await load(true);
      setPending(0);
      showToast(`${synced} operacion(es) sincronizada(s)`);
    }
    return synced;
  }, [load, showToast]);

  useEffect(() => {
    if (!session?.token) {
      setLoading(false);
      return;
    }

    load();
    const goOnline = () => { setOnline(true); syncPending(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [load, session?.token, syncPending]);

  if (!session?.token) {
    return <Login onLogin={nextSession => { setSession(nextSession); setLoading(true); }} />;
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <BrandLogo className="loading-brand-logo" compact />
        <p>Cargando Huevos del Norte...</p>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="loading-screen">
        <div className="loading-logo loading-error">!</div>
        <h2>Error de conexion</h2>
        <p style={{ maxWidth: 380, textAlign: 'center', color: '#64748b' }}>{error}</p>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => load()}>
          Reintentar
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => logout()}>
          Volver al login
        </button>
      </div>
    );
  }

  const props = { state, dash, reports, submit, reload: () => load(true), online, session, navigate: setPage };
  const pages = {
    dashboard: <Dashboard {...props} />,
    users: <Users {...props} />,
    inventory: <Inventory {...props} />,
    purchases: <Purchases {...props} />,
    suppliers: <Suppliers {...props} />,
    sales: <Sales {...props} />,
    clients: <Clients {...props} />,
    routes: <Routes {...props} />,
    trucks: <Trucks {...props} />,
    expenses: <Expenses {...props} />,
    receivables: <Receivables {...props} />,
    payables: <Payables {...props} />,
    reports: <Reports {...props} />,
    settings: <SettingsPage {...props} />,
    sync: <Sync {...props} pending={pending} syncPending={syncPending} />,
  };

  const layoutProps = {
    page,
    setPage,
    session,
    online,
    pending,
    onRefresh: () => load(true),
    onLogout: () => logout(),
    toast,
  };

  const vendorAllowed = new Set(['dashboard', 'sales', 'expenses', 'receivables', 'inventory', 'clients', 'routes', 'reports', 'sync']);
  const currentPage = session.user?.role === 'admin'
    ? page
    : (vendorAllowed.has(page) ? page : 'dashboard');
  const content = pages[currentPage] || pages.dashboard;

  if (session.user?.role === 'admin') {
    return <AdminLayout {...layoutProps} page={currentPage}>{content}</AdminLayout>;
  }

  return <VendorLayout {...layoutProps} page={currentPage}>{content}</VendorLayout>;
}
