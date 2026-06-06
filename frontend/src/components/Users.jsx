import React, { useMemo, useState } from 'react';
import { Section, Two, Input, Select, Form, StatusBadge } from './ui.jsx';
import { fmtDateTime } from '../utils/money.js';

const ROLES = [['admin', 'Administrador'], ['vendedor', 'Vendedor']];

function makeBlank(routes) {
  return {
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    role: 'vendedor',
    status: 'activo',
    assignedRouteIds: routes.slice(0, 1).map(route => route.id),
  };
}

export default function Users({ state, submit }) {
  const routes = useMemo(() => state.routes.filter(route => route.id !== 'r-free'), [state.routes]);
  const [tab, setTab] = useState('lista');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(makeBlank(routes));

  function resetForm() {
    setSelected(null);
    setForm(makeBlank(routes));
  }

  function startEdit(user) {
    setSelected(user);
    setForm({
      name: user.name || user.displayName || '',
      username: user.username || '',
      password: '',
      phone: user.phone || '',
      email: user.email || '',
      role: user.role,
      status: user.status || 'activo',
      assignedRouteIds: user.assignedRouteIds || [],
    });
    setTab('form');
  }

  function toggleRoute(routeId) {
    setForm(current => ({
      ...current,
      assignedRouteIds: current.assignedRouteIds.includes(routeId)
        ? current.assignedRouteIds.filter(item => item !== routeId)
        : [...current.assignedRouteIds, routeId],
    }));
  }

  function handleSave() {
    const payload = {
      ...form,
      assignedRouteIds: form.role === 'admin' ? state.routes.map(route => route.id) : form.assignedRouteIds,
    };
    if (selected) submit(`/users/${selected.id}`, payload, 'PUT');
    else submit('/users', payload, 'POST');
    resetForm();
    setTab('lista');
  }

  function handleStatus(user, status) {
    submit(`/users/${user.id}/status`, { status }, 'PATCH');
  }

  function handleDelete(user) {
    if (window.confirm(`Eliminar usuario ${user.username}?`)) {
      submit(`/users/${user.id}`, {}, 'DELETE');
    }
  }

  return (
    <div>
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'lista' ? ' tab-active' : ''}`} onClick={() => { setTab('lista'); resetForm(); }}>
          Usuarios
        </button>
        <button className={`tab-btn${tab === 'form' ? ' tab-active' : ''}`} onClick={() => { setTab('form'); resetForm(); }}>
          {selected ? 'Editar usuario' : '+ Nuevo usuario'}
        </button>
      </div>

      {tab === 'form' && (
        <Two>
          <Section title={selected ? `Editar ${selected.displayName}` : 'Crear usuario'}>
            <Form onSubmit={handleSave}>
              <Input label="Nombre completo *" value={form.name} onChange={value => setForm(current => ({ ...current, name: value }))} required />
              <Input label="Usuario / login *" value={form.username} onChange={value => setForm(current => ({ ...current, username: value }))} required />
              <Input label={selected ? 'Nueva contrasena' : 'Contrasena *'} type="password" value={form.password} onChange={value => setForm(current => ({ ...current, password: value }))} required={!selected} />
              <Input label="Telefono" value={form.phone} onChange={value => setForm(current => ({ ...current, phone: value }))} />
              <Input label="Correo opcional" value={form.email} onChange={value => setForm(current => ({ ...current, email: value }))} />
              <Select label="Rol" value={form.role} onChange={value => setForm(current => ({ ...current, role: value }))} options={ROLES} />
              <Select label="Estado" value={form.status} onChange={value => setForm(current => ({ ...current, status: value }))} options={[['activo', 'Activo'], ['inactivo', 'Inactivo']]} />

              {form.role === 'vendedor' && (
                <div className="route-picker">
                  <div className="route-picker-title">Rutas asignadas</div>
                  {routes.map(route => (
                    <label key={route.id} className="toggle-label route-picker-item">
                      <input
                        type="checkbox"
                        checked={form.assignedRouteIds.includes(route.id)}
                        onChange={() => toggleRoute(route.id)}
                      />
                      <span>{route.name}</span>
                    </label>
                  ))}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg">
                {selected ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </Form>
          </Section>

          <Section title="Reglas del modulo">
            <div className="info-box info-blue">
              <p><strong>Solo existen dos roles:</strong> Administrador y Vendedor.</p>
              <p>Los vendedores solo veran las rutas asignadas en este formulario.</p>
              <p>Si cambias la contrasena al editar, la anterior se reemplaza.</p>
            </div>
          </Section>
        </Two>
      )}

      {tab === 'lista' && (
        <Section title="Usuarios del sistema">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Login</th><th>Telefono</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Rutas</th><th>Creado</th><th></th></tr>
              </thead>
              <tbody>
                {state.users.map(user => (
                  <tr key={user.id}>
                    <td><strong>{user.displayName || user.name}</strong></td>
                    <td>{user.username}</td>
                    <td>{user.phone || '—'}</td>
                    <td>{user.email || '—'}</td>
                    <td><span className={`badge badge-${user.role === 'admin' ? 'orange' : 'blue'}`}>{user.role}</span></td>
                    <td><StatusBadge status={user.status || 'activo'} /></td>
                    <td>
                      {(user.assignedRouteIds || []).map(routeId => state.routes.find(route => route.id === routeId)?.name).filter(Boolean).join(', ') || '—'}
                    </td>
                    <td>{fmtDateTime(user.createdAt)}</td>
                    <td className="action-cell">
                      <button className="btn btn-ghost btn-xs" onClick={() => startEdit(user)}>Editar</button>
                      {user.status === 'activo'
                        ? <button className="btn btn-ghost btn-xs" onClick={() => handleStatus(user, 'inactivo')}>Desactivar</button>
                        : <button className="btn btn-ghost btn-xs" onClick={() => handleStatus(user, 'activo')}>Activar</button>}
                      <button className="btn btn-danger btn-xs" onClick={() => handleDelete(user)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
