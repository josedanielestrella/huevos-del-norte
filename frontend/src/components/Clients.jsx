import React, { useState } from 'react';
import { Section, Two, Input, Select, Form, StatusBadge } from './ui.jsx';
import { money, fmtDateTime } from '../utils/money.js';

export default function Clients({ state, submit }) {
  const isAdmin = state.currentUser?.role === 'admin';
  const [tab, setTab] = useState('lista');
  const [selected, setSelected] = useState(null);
  const blank = { name: '', phone: '', address: '', sector: '', routeId: state.routes[0]?.id || '' };
  const [form, setForm] = useState(blank);
  const setField = key => value => setForm(current => ({ ...current, [key]: value }));

  function resetForm() {
    setSelected(null);
    setForm({ ...blank, routeId: state.routes[0]?.id || '' });
  }

  function startEdit(client) {
    setSelected(client);
    setForm({
      name: client.name,
      phone: client.phone,
      address: client.address,
      sector: client.sector,
      routeId: client.routeId || '',
    });
    setTab('form');
  }

  function handleSave() {
    if (selected) submit(`/clients/${selected.id}`, form, 'PUT');
    else submit('/clients', form, 'POST');
    resetForm();
    setTab('lista');
  }

  if (!isAdmin) {
    return <VendorClients state={state} />;
  }

  return (
    <div>
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'lista' ? ' tab-active' : ''}`} onClick={() => { setTab('lista'); resetForm(); }}>
          Clientes
        </button>
        <button className={`tab-btn${tab === 'form' ? ' tab-active' : ''}`} onClick={() => { setTab('form'); resetForm(); }}>
          {selected ? 'Editar cliente' : '+ Nuevo cliente'}
        </button>
      </div>

      {tab === 'form' && (
        <Two>
          <Section title={selected ? `Editando: ${selected.name}` : 'Nuevo cliente'}>
            <Form onSubmit={handleSave}>
              <Input label="Nombre completo *" value={form.name} onChange={setField('name')} required />
              <Input label="Telefono" value={form.phone} onChange={setField('phone')} />
              <Input label="Direccion" value={form.address} onChange={setField('address')} />
              <Input label="Sector / Barrio" value={form.sector} onChange={setField('sector')} />
              <Select label="Ruta" value={form.routeId} onChange={setField('routeId')} options={[['', '- Sin ruta -'], ...state.routes.map(route => [route.id, route.name])]} />
              <button type="submit" className="btn btn-primary btn-lg">{selected ? 'Guardar cambios' : 'Crear cliente'}</button>
            </Form>
          </Section>

          <Section title="Clientes por ruta">
            {form.routeId ? (
              <div>
                {state.clients.filter(client => client.routeId === form.routeId).map(client => (
                  <div key={client.id} className="supplier-card">
                    <div className="supplier-name">{client.name}</div>
                    <div className="supplier-meta">{client.phone} - {client.sector}</div>
                    {client.balance > 0 && <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }}>Debe: {money(client.balance)}</div>}
                  </div>
                ))}
                {!state.clients.filter(client => client.routeId === form.routeId).length && <p className="muted">No hay clientes en esta ruta.</p>}
              </div>
            ) : <p className="muted">Selecciona una ruta.</p>}
          </Section>
        </Two>
      )}

      {tab === 'lista' && <ClientsTable state={state} onEdit={startEdit} showEdit />}
    </div>
  );
}

function VendorClients({ state }) {
  return (
    <div>
      <Section title="Clientes de tus rutas">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Cliente</th><th>Telefono</th><th>Sector</th><th>Ruta</th><th>Balance</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {state.clients.map(client => {
                const route = state.routes.find(item => item.id === client.routeId);
                return (
                  <tr key={client.id}>
                    <td><strong>{client.name}</strong>{client.isGeneralCustomer && <span className="badge badge-gray" style={{ marginLeft: 6 }}>Libre</span>}</td>
                    <td>{client.phone || '-'}</td>
                    <td>{client.sector || '-'}</td>
                    <td>{route?.name || '-'}</td>
                    <td>{client.balance > 0 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{money(client.balance)}</span> : <span style={{ color: '#16a34a' }}>Al dia</span>}</td>
                    <td><StatusBadge status={client.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Historial de compras por cliente">
        {state.clients.map(client => {
          const invoices = state.invoices.filter(invoice => invoice.clientId === client.id);
          if (!invoices.length) return null;
          return (
            <div key={client.id} style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 6 }}>{client.name}</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Fecha</th><th>Total</th><th>Pagado</th><th>Estado</th></tr></thead>
                  <tbody>
                    {invoices.map(invoice => (
                      <tr key={invoice.id}>
                        <td>{invoice.number}</td>
                        <td>{fmtDateTime(invoice.date)}</td>
                        <td>{money(invoice.total)}</td>
                        <td>{money(invoice.paid)}</td>
                        <td><StatusBadge status={invoice.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function ClientsTable({ state, onEdit, showEdit = false }) {
  return (
    <div>
      <Section title="Todos los clientes">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Telefono</th><th>Direccion</th><th>Sector</th><th>Ruta</th><th>Balance</th><th>Facturas</th><th></th></tr>
            </thead>
            <tbody>
              {state.clients.map(client => {
                const route = state.routes.find(item => item.id === client.routeId);
                const invoices = state.invoices.filter(item => item.clientId === client.id);
                return (
                  <tr key={client.id}>
                    <td><strong>{client.name}</strong></td>
                    <td>{client.phone}</td>
                    <td>{client.address}</td>
                    <td>{client.sector}</td>
                    <td>{route?.name || '-'}</td>
                    <td>{client.balance > 0 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{money(client.balance)}</span> : <span style={{ color: '#16a34a' }}>Al dia</span>}</td>
                    <td>{invoices.length}</td>
                    <td>{showEdit && <button className="btn btn-ghost btn-xs" onClick={() => onEdit(client)}>Editar</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
