import React, { useState } from 'react';
import { Section, Two, Input, Select, Form, StatusBadge } from './ui.jsx';
import { EGG_PER_CARTON } from '../utils/money.js';

const STATUSES = ['Disponible', 'En ruta', 'Mantenimiento'];

export default function Trucks({ state, submit }) {
  const [selected, setSelected] = useState(null);
  const blank = { code: '', plate: '', capacityCartons: 200, status: 'Disponible' };
  const [form, setForm] = useState(blank);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const startEdit = t => { setSelected(t); setForm({ code: t.code, plate: t.plate, capacityCartons: t.capacityCartons, status: t.status }); };
  const cancel = () => { setSelected(null); setForm(blank); };

  const handleSave = () => {
    if (selected) submit(`/trucks/${selected.id}`, { ...form, capacityCartons: Number(form.capacityCartons) }, 'PUT');
    else submit('/trucks', { ...form, capacityCartons: Number(form.capacityCartons) });
    cancel();
  };

  return (
    <Two>
      <Section title={selected ? `Editando: ${selected.code}` : 'Nuevo camión'}>
        <Form onSubmit={handleSave}>
          <Input label="Código *" value={form.code} onChange={f('code')} required placeholder="Ej: CAM-04" />
          <Input label="Placa" value={form.plate} onChange={f('plate')} placeholder="Ej: L999111" />
          <Input label="Capacidad (cartones)" type="number" min="1" value={form.capacityCartons} onChange={f('capacityCartons')} />
          <div className="info-box info-blue">
            {Number(form.capacityCartons) > 0 && (
              <span>= {(Number(form.capacityCartons) * EGG_PER_CARTON).toLocaleString()} huevos</span>
            )}
          </div>
          <Select label="Estado" value={form.status} onChange={f('status')} options={STATUSES} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary">{selected ? 'Guardar cambios' : 'Crear camión'}</button>
            {selected && <button type="button" className="btn btn-ghost" onClick={cancel}>Cancelar</button>}
          </div>
        </Form>
      </Section>

      <Section title="Flota de camiones">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Código</th><th>Placa</th><th>Capacidad</th><th>Huevos</th><th>Estado</th><th>Ruta actual</th><th></th></tr>
            </thead>
            <tbody>
              {state.trucks.map(t => {
                const route = state.routes.find(r => r.truckId === t.id && r.status === 'En proceso');
                return (
                  <tr key={t.id}>
                    <td><strong>{t.code}</strong></td>
                    <td>{t.plate}</td>
                    <td>{t.capacityCartons} ctn</td>
                    <td>{(t.capacityCartons * EGG_PER_CARTON).toLocaleString()} u</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>{route?.name || '—'}</td>
                    <td><button className="btn btn-ghost btn-xs" onClick={() => startEdit(t)}>Editar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {STATUSES.map(s => {
              const count = state.trucks.filter(t => t.status === s).length;
              return (
                <div key={s} className="info-box info-blue" style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{count}</div>
                  <div style={{ fontSize: 12 }}>{s}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    </Two>
  );
}
