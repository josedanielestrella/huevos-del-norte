import React, { useState } from 'react';
import { Section, Two, Input, Select, Form, StatusBadge } from './ui.jsx';
import { money, fmtDateTime } from '../utils/money.js';

const METHODS = ['efectivo', 'transferencia', 'mixto'];

export default function Receivables({ state, submit }) {
  const isVendor = state.currentUser?.role === 'vendedor';
  const pendingInvoices = state.invoices.filter(invoice => invoice.status !== 'pagada');
  const [form, setForm] = useState({
    invoiceId: pendingInvoices[0]?.id || '',
    amount: '',
    method: 'efectivo',
    note: '',
  });
  const setField = key => value => setForm(current => ({ ...current, [key]: value }));

  const selectedInvoice = state.invoices.find(invoice => invoice.id === form.invoiceId);
  const pending = selectedInvoice ? selectedInvoice.total - selectedInvoice.paid : 0;

  const handleSave = () => {
    if (!form.invoiceId) return;
    submit('/payments', { ...form, amount: Number(form.amount) });
    setForm({ invoiceId: pendingInvoices[0]?.id || '', amount: '', method: 'efectivo', note: '' });
  };

  const totalPending = state.clients.reduce((sum, client) => sum + (client.balance || 0), 0);

  return (
    <div>
      <Two>
        <Section title={isVendor ? 'Registrar cobro' : 'Registrar abono'}>
          {pendingInvoices.length === 0 ? (
            <div className="info-box info-green">No hay facturas pendientes. Todas estan pagadas.</div>
          ) : (
            <Form onSubmit={handleSave}>
              <Select
                label="Factura pendiente *"
                value={form.invoiceId}
                onChange={value => setForm({ ...form, invoiceId: value, amount: '' })}
                options={pendingInvoices.map(invoice => [
                  invoice.id,
                  `${invoice.number} - ${invoice.clientName} - Pendiente: ${money(invoice.total - invoice.paid)}`,
                ])}
              />

              {selectedInvoice && (
                <div className="info-box info-orange">
                  <div><strong>{selectedInvoice.clientName}</strong></div>
                  <div>Total factura: {money(selectedInvoice.total)}</div>
                  <div>Pagado: {money(selectedInvoice.paid)}</div>
                  <div>Pendiente: <strong>{money(pending)}</strong></div>
                </div>
              )}

              <Input label={`Monto del ${isVendor ? 'cobro' : 'abono'} (RD$) *`} type="number" step="0.01" min="0.01" max={pending} value={form.amount} onChange={setField('amount')} required />
              <Select label="Metodo de pago" value={form.method} onChange={setField('method')} options={METHODS} />
              <Input label="Nota" value={form.note} onChange={setField('note')} placeholder="Opcional" />

              <button type="submit" className="btn btn-primary btn-lg" disabled={!form.invoiceId || !form.amount}>
                {isVendor ? 'Registrar cobro' : 'Registrar abono'}
              </button>
            </Form>
          )}
        </Section>

        <Section title={`${isVendor ? 'Mis cuentas por cobrar' : 'CxC'} - Total pendiente: ${money(totalPending)}`}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Ruta</th><th>Balance</th><th>Facturas pend.</th></tr>
              </thead>
              <tbody>
                {state.clients.filter(client => client.balance > 0).map(client => {
                  const route = state.routes.find(item => item.id === client.routeId);
                  const clientPending = state.invoices.filter(invoice => invoice.clientId === client.id && invoice.status !== 'pagada').length;
                  return (
                    <tr key={client.id}>
                      <td>
                        <strong>{client.name}</strong>
                        <br /><small style={{ color: '#64748b' }}>{client.phone}</small>
                      </td>
                      <td>{route?.name || '-'}</td>
                      <td style={{ color: '#dc2626', fontWeight: 700 }}>{money(client.balance)}</td>
                      <td>{clientPending}</td>
                    </tr>
                  );
                })}
                {!state.clients.some(client => client.balance > 0) && (
                  <tr><td colSpan={4}><p className="muted">Sin clientes con balance pendiente.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </Two>

      <Section title={isVendor ? 'Facturas pendientes de tus clientes' : 'Facturas pendientes de cobro'}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Metodo</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {pendingInvoices.map(invoice => (
                <tr key={invoice.id}>
                  <td><strong>{invoice.number}</strong></td>
                  <td>{invoice.clientName}</td>
                  <td>{fmtDateTime(invoice.date)}</td>
                  <td>{money(invoice.total)}</td>
                  <td style={{ color: '#16a34a' }}>{money(invoice.paid)}</td>
                  <td style={{ color: '#dc2626', fontWeight: 700 }}>{money(invoice.total - invoice.paid)}</td>
                  <td>{invoice.paymentMethod}</td>
                  <td><StatusBadge status={invoice.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={isVendor ? 'Historial de cobros registrados' : 'Historial de pagos recibidos'}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Cliente</th><th>Factura</th><th>Monto</th><th>Metodo</th><th>Nota</th></tr>
            </thead>
            <tbody>
              {state.payments.slice().reverse().map(payment => {
                const client = state.clients.find(item => item.id === payment.clientId);
                const invoice = state.invoices.find(item => item.id === payment.invoiceId);
                return (
                  <tr key={payment.id}>
                    <td>{fmtDateTime(payment.date)}</td>
                    <td>{client?.name || invoice?.clientName || '-'}</td>
                    <td>{invoice?.number || '-'}</td>
                    <td><strong style={{ color: '#16a34a' }}>{money(payment.amount)}</strong></td>
                    <td>{payment.method}</td>
                    <td>{payment.note || '-'}</td>
                  </tr>
                );
              })}
              {!state.payments.length && (
                <tr><td colSpan={6}><p className="muted">Sin pagos registrados.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
