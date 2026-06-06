import React, { useState } from 'react';
import { Plus, Trash2, Printer } from 'lucide-react';
import { Section, Two, Input, Select, Textarea, Form, StatusBadge } from './ui.jsx';
import { money, toCartons, fmtDateTime, EGG_PER_CARTON } from '../utils/money.js';
import { printWindow } from '../utils/print.js';

const PAYMENT_METHODS = ['efectivo', 'transferencia', 'crédito', 'mixto'];
const EMPTY_ITEM = { eggTypeId: 'grande', mode: 'carton', quantity: 1, costPerCarton: '' };

export default function Purchases({ state, submit }) {
  const [tab, setTab] = useState('lista');
  const [form, setForm] = useState({
    supplierId: state.suppliers[0]?.id || '',
    items: [{ ...EMPTY_ITEM }],
    paid: '',
    paymentMethod: 'efectivo',
    notes: '',
    dueDate: '',
  });

  const setItem = (i, field, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: val };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] });
  const removeItem = i => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const calcTotal = () => form.items.reduce((s, it) => {
    const qty = Number(it.quantity) || 0;
    const cost = Number(it.costPerCarton) || 0;
    const units = it.mode === 'carton' ? qty * EGG_PER_CARTON : qty;
    return s + (it.mode === 'carton' ? qty * cost : units * (cost / EGG_PER_CARTON));
  }, 0);

  const total = calcTotal();
  const paid = Number(form.paid) || 0;
  const isCredit = form.paymentMethod === 'crédito';

  const handleSubmit = () => {
    const items = form.items.map(it => ({
      ...it,
      quantity: Number(it.quantity),
      costPerCarton: Number(it.costPerCarton),
    }));
    submit('/purchases', { ...form, items, paid: isCredit ? 0 : paid });
    setForm({ supplierId: state.suppliers[0]?.id || '', items: [{ ...EMPTY_ITEM }], paid: '', paymentMethod: 'efectivo', notes: '', dueDate: '' });
    setTab('lista');
  };

  const printPurchase = pur => {
    const supplier = state.suppliers.find(s => s.id === pur.supplierId);
    const eggName = id => state.eggTypes.find(e => e.id === id)?.name || id;
    const rows = pur.items.map(it => `<tr>
      <td>${eggName(it.eggTypeId)}</td>
      <td>${it.mode === 'carton' ? `${it.quantity} cartones (${it.totalUnits} u)` : `${it.quantity} unidades`}</td>
      <td>${money(it.costPerCarton)}/ctn</td>
      <td style="text-align:right">${money(it.subtotal)}</td>
    </tr>`).join('');
    printWindow(pur.number, `
      <div class="header">
        <div><h1>Orden de Compra</h1><strong style="font-size:18px">${pur.number}</strong></div>
        <div class="invoice-meta">${new Date(pur.date).toLocaleString('es-DO')}<br>
          Estado: <span class="badge badge-${pur.status}">${pur.status}</span>
        </div>
      </div>
      <h2>Proveedor: ${supplier?.name || '—'}</h2>
      <p>${supplier?.address || ''} · Tel: ${supplier?.phone || ''}</p>
      <table style="margin-top:14px">
        <thead><tr><th>Tipo</th><th>Cantidad</th><th>Costo</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total-section"><table class="total-box">
        <tr><td>Total compra</td><td>${money(pur.total)}</td></tr>
        <tr><td>Pagado</td><td>${money(pur.paid)}</td></tr>
        <tr class="grand-total"><td>Pendiente</td><td>${money(pur.total - pur.paid)}</td></tr>
      </table></div>
      ${pur.notes ? `<p style="margin-top:14px">Nota: ${pur.notes}</p>` : ''}
    `);
  };

  return (
    <div>
      <div className="tab-bar">
        {['lista', 'nueva'].map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' tab-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'lista' ? 'Historial de compras' : '+ Nueva compra'}
          </button>
        ))}
      </div>

      {tab === 'nueva' && (
        <Two>
          <Section title="Registrar compra">
            <Form onSubmit={handleSubmit}>
              <Select label="Proveedor *" value={form.supplierId} onChange={v => setForm({ ...form, supplierId: v })}
                options={state.suppliers.map(s => [s.id, s.name])} required />

              <div style={{ marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Productos</div>
              {form.items.map((it, i) => (
                <div key={i} className="item-block">
                  <div className="item-block-head">
                    <span>Producto {i + 1}</span>
                    {form.items.length > 1 && (
                      <button type="button" className="btn btn-danger btn-xs" onClick={() => removeItem(i)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <Select label="Tipo" value={it.eggTypeId} onChange={v => setItem(i, 'eggTypeId', v)}
                    options={state.eggTypes.map(e => [e.id, e.name])} />
                  <Select label="Unidad" value={it.mode} onChange={v => setItem(i, 'mode', v)}
                    options={[['carton', 'Cartones'], ['unit', 'Unidades']]} />
                  <Input label={`Cantidad (${it.mode === 'carton' ? 'cartones' : 'unidades'})`} type="number" min="1"
                    value={it.quantity} onChange={v => setItem(i, 'quantity', v)} />
                  <Input label="Costo por cartón (RD$)" type="number" step="0.01" min="0"
                    value={it.costPerCarton} onChange={v => setItem(i, 'costPerCarton', v)} />
                  {it.costPerCarton > 0 && (
                    <div className="item-calc">
                      Subtotal: <strong>{money(
                        it.mode === 'carton'
                          ? Number(it.quantity) * Number(it.costPerCarton)
                          : Number(it.quantity) * (Number(it.costPerCarton) / EGG_PER_CARTON)
                      )}</strong>
                    </div>
                  )}
                </div>
              ))}

              <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
                <Plus size={15} /> Agregar otro tipo
              </button>

              <Select label="Método de pago" value={form.paymentMethod}
                onChange={v => setForm({ ...form, paymentMethod: v })} options={PAYMENT_METHODS} />

              {!isCredit && (
                <Input label="Monto pagado (RD$)" type="number" step="0.01" min="0"
                  value={form.paid} onChange={v => setForm({ ...form, paid: v })} />
              )}

              {(isCredit || (paid > 0 && paid < total)) && (
                <Input label="Fecha límite de pago" type="date"
                  value={form.dueDate} onChange={v => setForm({ ...form, dueDate: v })} />
              )}

              <Textarea label="Notas" value={form.notes} onChange={v => setForm({ ...form, notes: v })} rows={2} />

              <div className="info-box info-amber">
                <div>Total compra: <strong>{money(total)}</strong></div>
                <div>Pagado: <strong>{money(isCredit ? 0 : paid)}</strong></div>
                <div>Pendiente: <strong>{money(total - (isCredit ? 0 : paid))}</strong></div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg">Registrar compra</button>
            </Form>
          </Section>

          <Section title="Resumen de compra">
            <table className="pl-table">
              <tbody>
                {form.items.map((it, i) => {
                  const et = state.eggTypes.find(e => e.id === it.eggTypeId);
                  const qty = Number(it.quantity) || 0;
                  const cost = Number(it.costPerCarton) || 0;
                  const sub = it.mode === 'carton' ? qty * cost : qty * (cost / EGG_PER_CARTON);
                  const units = it.mode === 'carton' ? qty * EGG_PER_CARTON : qty;
                  return (
                    <tr key={i}>
                      <td>{et?.name}</td>
                      <td style={{ color: '#64748b' }}>{units.toLocaleString()} huevos</td>
                      <td className="td-right">{money(sub)}</td>
                    </tr>
                  );
                })}
                <tr className="tr-bold tr-border-top"><td colSpan={2}>TOTAL</td><td className="td-right">{money(total)}</td></tr>
              </tbody>
            </table>
            <div className="info-box info-blue" style={{ marginTop: 14 }}>
              <strong>¿Qué pasa al registrar?</strong>
              <ul style={{ margin: '8px 0 0 16px', fontSize: 13 }}>
                <li>Se crea un lote nuevo por cada tipo de huevo</li>
                <li>El costo queda guardado en el lote</li>
                <li>Si no está pagado, va a Cuentas por Pagar</li>
              </ul>
            </div>
          </Section>
        </Two>
      )}

      {tab === 'lista' && (
        <Section title="Historial de compras">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Proveedor</th><th>Fecha</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Método</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {state.purchases.map(pur => {
                  const sup = state.suppliers.find(s => s.id === pur.supplierId);
                  return (
                    <tr key={pur.id}>
                      <td><strong>{pur.number}</strong></td>
                      <td>{sup?.name || '—'}</td>
                      <td>{fmtDateTime(pur.date)}</td>
                      <td>{money(pur.total)}</td>
                      <td style={{ color: '#16a34a' }}>{money(pur.paid)}</td>
                      <td style={{ color: pur.total - pur.paid > 0 ? '#dc2626' : '#16a34a' }}>{money(pur.total - pur.paid)}</td>
                      <td>{pur.paymentMethod}</td>
                      <td><StatusBadge status={pur.status} /></td>
                      <td>
                        <button className="btn btn-ghost btn-xs" onClick={() => printPurchase(pur)}>
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
