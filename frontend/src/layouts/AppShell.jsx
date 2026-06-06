import React, { useState } from 'react';
import { Menu, RefreshCw, WifiOff, X, LogOut } from 'lucide-react';
import BrandLogo from '../components/BrandLogo.jsx';

export default function AppShell({ menu, groups, page, setPage, currentLabel, subtitle, online, pending, onRefresh, onLogout, children, toast }) {
  const [navOpen, setNavOpen] = useState(false);

  const navigate = id => {
    setPage(id);
    setNavOpen(false);
  };

  return (
    <div className="app">
      {navOpen && <div className="nav-overlay" onClick={() => setNavOpen(false)} />}

      <aside className={`sidebar${navOpen ? ' sidebar-open' : ''}`}>
        <div className="brand">
          <BrandLogo className="brand-logo" compact light />
        </div>

        <nav className="sidebar-nav">
          {groups.map(group => {
            const items = menu.filter(item => item.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="nav-group">
                <div className="nav-group-label">{group}</div>
                {items.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    className={`nav-btn${page === id ? ' nav-btn-active' : ''}`}
                    onClick={() => navigate(id)}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {id === 'sync' && pending > 0 && <span className="nav-badge">{pending}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span className={`status-dot${online ? ' dot-online' : ' dot-offline'}`} />
          <span>{online ? 'En linea' : 'Sin conexion'}</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-btn" onClick={() => setNavOpen(open => !open)}>
              {navOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <h1 className="page-title">{currentLabel}</h1>
              <p className="page-sub">{subtitle}</p>
            </div>
          </div>
          <div className="topbar-right">
            {!online && (
              <span className="offline-pill">
                <WifiOff size={13} /> Sin conexion
              </span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
              <RefreshCw size={15} /> Actualizar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onLogout}>
              <LogOut size={15} /> Salir
            </button>
          </div>
        </header>

        {toast && (
          <div className={`toast toast-${toast.type}`} onClick={toast.onClose}>
            {toast.msg}
          </div>
        )}

        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
