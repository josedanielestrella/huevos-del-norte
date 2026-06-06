import React, { useState } from 'react';
import { Section, Two, Input, Select, Form, StatusBadge } from './ui.jsx';
import { money, fmtDate, fmtDateTime } from '../utils/money.js';

const METHODS = ['efectivo', 'transferencia', 'mixto'];

export default function Payables({ state, submit }) {
  const pendingPayables = state.payables.filter(p => p.status !== 'pagado');
  const [form, setForm] = useState({
    payableId: pendingPayables[0]?.id || '',
    amount: '',
    method: 'transferencia',
    note: '',
  });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const selectedPay = state.payables.find(p => p.id === form.payableId);
  const supplier = selectedPay ? state.suppliers.find(s => s.id === selectedPay.supplierId) : null;
  const purchase = selectedPay ? state.purchases.find(p => p.id === selectedPay.purchaseId) : null;
  const pending = selectedPay ? selectedPay.amount - selectedPay.paid : 0;

  const totalOwed = state.payables.reduce((s, p) => s + (p.amount - p.paid), 0);

  const today = new Date().toISOString().slice(0, 10);

  const handleSave = () => {
    submit('/payable-payments', { ...form, amount: Number(form.amount) });
    setForm({ payableId: pendingPayables[0]?.id || '', amount: '', method: 'transferencia', note: '' });
  };

  return (
    <div>
      <Two>
        <Section title="Registrar pago a proveedor">
          {pendingPayables.length === 0 ? (
            <div className="info-box info-green">✓ No hay deudas pendientes con proveedores.</div>
          ) : (
            <Form onSubmit={handleSave}>
              <Select
                label="Cuenta por pagar *"
                value={form.payableId}
                onChange={v => setForm({ ...form, payableId: v, amount: '' })}
                options={pendingPayables.map(p => {
                  const s = state.suppliers.find(x => x.id === p.supplierId);
                  const pur = state.purchases.find(x => x.id === p.purchaseId);
                  return [p.id, `${s?.name || '?'} – ${pur?.number || ''} – Debe: ${money(p.amount - p.paid)}`];
                })}
              />

              {selectedPay && (
                <div className="info-box info-orange">
                  <div><strong>{supplier?.name}</strong> · {purchase?.number}</div>
                  <div>Compra total: {money(selectedPay.amount)}</div>
                  <div>Pagado: {money(selectedPay.paid)}</div>
                  <div>Pendiente: <strong>{money(pending)}</strong></div>
                  <div>Vence: <strong style={{ color: selectedPay.dueDate < today ? '#dc2626' : '#374151' }}>{selectedPay.dueDate}</strong>
                    {selectedPay.dueDate < today && ' ⚠ VENCIDO'}
                  </div>
                </div>
              )}

              <Input label="Monto a pagar (RD$) *" type="number" step="0.01" min="0.01"
                max={pending} value={form.amount} onChange={f('amount')} required />
              <Select label="Método" value={form.method} onChange={f('method')} options={METHODS} />
              <Input label="Nota" value={form.note} onChange={f('note')} placeholder="Opcional" />

              <button type="submit" className="btn btn-primary btn-lg" disabled={!form.payableId || !form.amount}>
                Registrar pago
              </button>
            </Form>
          )}
        </Section>

        <Section title={`CxP — Total pendiente: ${money(totalOwed)}`}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Proveedor</th><th>Compra</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Vence</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {state.payables.map(p => {
                  const s = state.suppliers.find(x => x.id === p.supplierId);
                  const pur = state.purchases.find(x => x.id === p.purchaseId);
                  const isOverdue = p.dueDate < today && p.status !== 'pagado';
                  return (
                    <tr key={p.id} style={{ background: isOverdue ? '#fff1f2' : undefined }}>
                      <td><strong>{s?.name || '—'}</strong></td>
                      <td>{pur?.number || '—'}</td>
                      <td>{money(p.amount)}</td>
                      <td style={{ color: '#16a34a' }}>{money(p.paid)}</td>
                      <td style={{ color: p.amount - p.paid > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                        {money(p.amount - p.paid)}
                      </td>
                      <td style={{ color: isOverdue ? '#dc2626' : '#374151', fontWeight: isOverdue ? 700 : 400 }}>
                        {p.dueDate}{isOverdue && ' ⚠'}
                      </td>
                      <td><StatusBadge status={p.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </Two>

      <Section title="Historial de pagos realizados a proveedores">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Proveedor</th><th>Monto</th><th>Método</th><th>Nota</th></tr>
            </thead>
            <tbody>
              {state.payablePayments.slice().reverse().map(pp => {
                const s = state.suppliers.find(x => x.id === pp.supplierId);
                return (
                  <tr key={pp.id}>
                    <td>{fmtDateTime(pp.date)}</td>
                    <td>{s?.name || '—'}</td>
                    <td><strong style={{ color: '#dc2626' }}>{money(pp.amount)}</strong></td>
                    <td>{pp.method}</td>
                    <td>{pp.note || '—'}</td>
                  </tr>
                );
              })}
              {!state.payablePayments.length && (
                <tr><td colSpan={5}><p className="muted">Sin pagos registrados.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
