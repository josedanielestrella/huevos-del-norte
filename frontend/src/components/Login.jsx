import React, { useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';
import { loginRequest } from '../utils/api.js';
import BrandLogo from './BrandLogo.jsx';

const DEFAULT_LOGIN_EMAIL = import.meta.env.VITE_DEFAULT_LOGIN_EMAIL?.trim() || 'josedanielestrella@outlook.com';
const DEFAULT_LOGIN_PASSWORD = import.meta.env.VITE_DEFAULT_LOGIN_PASSWORD ?? '1234';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState(DEFAULT_LOGIN_EMAIL);
  const [password, setPassword] = useState(DEFAULT_LOGIN_PASSWORD);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const session = await loginRequest({ username, password, remember });
      onLogin(session);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-brand">
          <BrandLogo className="login-logo" />
          <div className="login-brand-copy">
            <strong>Huevos del Norte</strong>
            <span>Acceso administrativo y operativo</span>
          </div>
        </div>

        <div className="login-copy">
          <h1>Iniciar sesion</h1>
          <p>Ingresa con tu correo y tu contrasena para entrar al sistema.</p>
        </div>

        <form className="form login-form" onSubmit={handleSubmit}>
          <label className="field">
            Correo o usuario
            <div className="login-input">
              <Mail size={16} />
              <input
                type="text"
                value={username}
                onChange={event => setUsername(event.target.value)}
                placeholder={DEFAULT_LOGIN_EMAIL}
                required
              />
            </div>
          </label>

          <label className="field">
            Contrasena
            <div className="login-input">
              <LockKeyhole size={16} />
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder={DEFAULT_LOGIN_PASSWORD ? '******' : ''}
                required
              />
            </div>
          </label>

          <div className="login-actions-row">
            <label className="toggle-label">
              <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
              <span>Recordarme</span>
            </label>
            <button type="button" className="login-link" disabled>
              Recuperacion futura
            </button>
          </div>

          {error && <div className="info-box info-red">{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar al sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
