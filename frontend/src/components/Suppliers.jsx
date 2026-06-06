import React, { useState } from 'react';
import { Section, Two, Input, Textarea, Form, StatusBadge } from './ui.jsx';
import { money, fmtDate } from '../utils/money.js';

export default function Suppliers({ state, submit }) {
  const [tab, setTab] = useState('lista');
  const [selected, setSelected] = useState(null);
  const blank = { name: '', phone: '', address: '', rnc: '', notes: '' };
  const [form, setForm] = useState(blank);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (selected) {
      submit(`/suppliers/${selected.id}`, form, 'PUT');
    } else {
      submit('/suppliers', form);
    }
    setForm(blank);
    setSelected(null);
    setTab('lista');
  };

  const startEdit = s => {
    setSelected(s);
    setForm({ name: s.name, phone: s.phone, address: s.address, rnc: s.rnc, notes: s.notes });
    setTab('form');
  };

  return (
    <div>
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'lista' ? ' tab-active' : ''}`} onClick={() => { setTab('lista'); setSelected(null); setForm(blank); }}>
          Proveedores
        </button>
        <button className={`tab-btn${tab === 'form' ? ' tab-active' : ''}`} onClick={() => { setTab('form'); setSelected(null); setForm(blank); }}>
          {selected ? 'Editar proveedor' : '+ Nuevo proveedor'}
        </button>
      </div>

      {tab === 'form' && (
        <Two>
          <Section title={selected ? `Editando: ${selected.name}` : 'Nuevo proveedor'}>
            <Form onSubmit={handleSave}>
              <Input label="Nombre *" value={form.name} onChange={f('name')} required />
              <Input label="Teléfono" value={form.phone} onChange={f('phone')} />
              <Input label="Dirección" value={form.address} onChange={f('address')} />
              <Input label="RNC / Cédula" value={form.rnc} onChange={f('rnc')} />
              <Textarea label="Notas" value={form.notes} onChange={f('notes')} />
              <button type="submit" className="btn btn-primary btn-lg">
                {selected ? 'Guardar cambios' : 'Crear proveedor'}
              </button>
            </Form>
          </Section>

          <Section title="Resumen de proveedores">
            {state.suppliers.map(s => {
              const purs = state.purchases.filter(p => p.supplierId === s.id);
              const total = purs.reduce((sum, p) => sum + p.total, 0);
              const paid  = purs.reduce((sum, p) => sum + p.paid, 0);
              return (
                <div key={s.id} className="supplier-card" onClick={() => startEdit(s)}>
                  <div className="supplier-name">{s.name}</div>
                  <div className="supplier-meta">{s.phone} · {s.address}</div>
                  <div className="supplier-stats">
                    <span>{purs.length} compras</span>
                    <span>{money(total)} comprado</span>
                    <span style={{ color: total - paid > 0 ? '#dc2626' : '#16a34a' }}>
                      {money(total - paid)} pendiente
                    </span>
                  </div>
                </div>
              );
            })}
          </Section>
        </Two>
      )}

      {tab === 'lista' && (
        <Section title="Todos los proveedores">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Teléfono</th><th>Dirección</th><th>RNC</th><th>Compras</th><th>Total comprado</th><th>Pendiente</th><th></th></tr>
              </thead>
              <tbody>
                {state.suppliers.map(s => {
                  const purs = state.purchases.filter(p => p.supplierId === s.id);
                  const total = purs.reduce((sum, p) => sum + p.total, 0);
                  const paid  = purs.reduce((sum, p) => sum + p.paid, 0);
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.phone}</td>
                      <td>{s.address}</td>
                      <td>{s.rnc || '—'}</td>
                      <td>{purs.length}</td>
                      <td>{money(total)}</td>
                      <td style={{ color: total - paid > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                        {money(total - paid)}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-xs" onClick={() => startEdit(s)}>Editar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Purchase history per supplier */}
          {state.suppliers.map(s => {
            const purs = state.purchases.filter(p => p.supplierId === s.id);
            if (!purs.length) return null;
            return (
              <div key={s.id} style={{ marginTop: 24 }}>
                <h3 style={{ marginBottom: 8 }}>{s.name} — Historial</h3>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Fecha</th><th>Total</th><th>Pagado</th><th>Estado</th></tr></thead>
                    <tbody>
                      {purs.map(p => (
                        <tr key={p.id}>
                          <td>{p.number}</td>
                          <td>{fmtDate(p.date)}</td>
                          <td>{money(p.total)}</td>
                          <td>{money(p.paid)}</td>
                          <td><StatusBadge status={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </Section>
      )}
    </div>
  );
}
