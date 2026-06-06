import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Printer } from 'lucide-react';
import { Section, Two, Input, Select, Form, StatusBadge } from './ui.jsx';
import { money, toCartons, fmtDateTime } from '../utils/money.js';
import { printInvoice } from '../utils/print.js';

const PAYMENT_METHODS = ['efectivo', 'transferencia', 'credito', 'mixto'];
const EMPTY_ITEM = { eggTypeId: 'grande', mode: 'carton', quantity: 1 };

function getDefaultRoute(routes, isAdmin) {
  if (!routes.length) return '';
  if (isAdmin) return routes[0].id;
  return routes.find(route => route.status === 'En proceso')?.id || routes[0].id;
}

export default function Sales({ state, submit }) {
  const isAdmin = state.currentUser?.role === 'admin';
  const routeOptions = useMemo(() => {
    if (isAdmin) return state.routes.filter(route => route.status !== 'Cerrada' || route.id === 'r-free');
    return state.routes.filter(route => route.status === 'En proceso' || route.id === 'r-free');
  }, [isAdmin, state.routes]);

  const [tab, setTab] = useState('lista');
  const [isFree, setIsFree] = useState(false);
  const [form, setForm] = useState({
    clientId: state.clients[0]?.id || '',
    freeClientName: '',
    routeId: getDefaultRoute(routeOptions, isAdmin),
    sellerId: '',
    items: [{ ...EMPTY_ITEM }],
    paid: '',
    paymentMethod: 'efectivo',
  });

  const setItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => setForm(current => ({ ...current, items: [...current.items, { ...EMPTY_ITEM }] }));
  const removeItem = index => setForm(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));

  const selectedRoute = routeOptions.find(route => route.id === form.routeId) || routeOptions[0] || null;
  const customerOptions = state.clients.filter(client => isFree || client.isGeneralCustomer || !selectedRoute || client.routeId === selectedRoute.id || client.routeId === 'r-free');

  const getStock = (eggTypeId, routeId) => {
    const routeLoads = state.routeLoads.filter(load => load.productId === eggTypeId && (!routeId || load.routeId === routeId));
    if (routeLoads.length > 0) return routeLoads.reduce((sum, load) => sum + load.remainingUnits, 0);
    return state.batches
      .filter(batch => batch.eggTypeId === eggTypeId && batch.remainingUnits > 0)
      .reduce((sum, batch) => sum + batch.remainingUnits, 0);
  };

  const calcLineTotal = item => {
    const eggType = state.eggTypes.find(value => value.id === item.eggTypeId);
    if (!eggType) return 0;
    return item.mode === 'carton'
      ? Number(item.quantity) * eggType.cartonPrice
      : Number(item.quantity) * eggType.unitPrice;
  };

  const total = form.items.reduce((sum, item) => sum + calcLineTotal(item), 0);
  const paid = Number(form.paid) || 0;
  const pending = total - (form.paymentMethod === 'credito' ? 0 : paid);

  const handleSubmit = async () => {
    const items = form.items.map(item => {
      const eggType = state.eggTypes.find(value => value.id === item.eggTypeId);
      return {
        eggTypeId: item.eggTypeId,
        mode: item.mode,
        quantity: Number(item.quantity),
        unitPrice: eggType?.unitPrice,
        cartonPrice: eggType?.cartonPrice,
      };
    });

    const createdInvoice = await submit('/invoices', {
      clientId: isFree ? null : form.clientId,
      clientName: isFree ? (form.freeClientName || 'Cliente General') : null,
      routeId: form.routeId || null,
      sellerId: isAdmin ? form.sellerId : state.currentUser?.employeeId,
      items,
      paid: form.paymentMethod === 'credito' ? 0 : paid,
      paymentMethod: form.paymentMethod,
      isFree,
    });

    if (!createdInvoice) return;

    if (!createdInvoice.queued) {
      printInvoice(createdInvoice, state);
    }

    setForm({
      clientId: state.clients[0]?.id || '',
      freeClientName: '',
      routeId: getDefaultRoute(routeOptions, isAdmin),
      sellerId: '',
      items: [{ ...EMPTY_ITEM }],
      paid: '',
      paymentMethod: 'efectivo',
    });
    setTab('lista');
  };

  return (
    <div>
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'lista' ? ' tab-active' : ''}`} onClick={() => setTab('lista')}>Facturas</button>
        <button className={`tab-btn${tab === 'nueva' ? ' tab-active' : ''}`} onClick={() => setTab('nueva')}>+ Nueva venta</button>
      </div>

      {tab === 'nueva' && (
        <Two>
          <Section title={isAdmin ? 'Registrar venta' : 'Vender desde ruta activa'}>
            <Form onSubmit={handleSubmit}>
              <div className="toggle-row">
                <label className="toggle-label">
                  <input type="checkbox" checked={isFree} onChange={event => setIsFree(event.target.checked)} />
                  <span>Venta libre</span>
                </label>
              </div>

              {isFree ? (
                <Input label="Nombre del cliente" value={form.freeClientName} onChange={value => setForm({ ...form, freeClientName: value })} placeholder="Cliente General" />
              ) : (
                <Select
                  label="Cliente *"
                  value={form.clientId}
                  onChange={value => setForm({ ...form, clientId: value })}
                  options={customerOptions.map(client => [client.id, `${client.name}${client.balance > 0 ? ` (debe ${money(client.balance)})` : ''}`])}
                />
              )}

              <Select
                label="Ruta"
                value={form.routeId}
                onChange={value => setForm({ ...form, routeId: value })}
                options={[...(isFree ? [['', 'Sin ruta - Venta Libre']] : []), ...routeOptions.map(route => [route.id, `${route.name} - ${route.status}`])]}
              />

              {isAdmin && (
                <Input label="Vendedor / empleado" value={form.sellerId} onChange={value => setForm({ ...form, sellerId: value })} placeholder="Usuario o empleado" />
              )}

              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>Productos</div>
              {form.items.map((item, index) => {
                const eggType = state.eggTypes.find(value => value.id === item.eggTypeId);
                const stock = getStock(item.eggTypeId, form.routeId);
                const lineTotal = calcLineTotal(item);
                return (
                  <div key={index} className="item-block">
                    <div className="item-block-head">
                      <span>Producto {index + 1}</span>
                      {form.items.length > 1 && (
                        <button type="button" className="btn btn-danger btn-xs" onClick={() => removeItem(index)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <Select label="Tipo" value={item.eggTypeId} onChange={value => setItem(index, 'eggTypeId', value)} options={state.eggTypes.map(value => [value.id, value.name])} />
                    <Select label="Vender por" value={item.mode} onChange={value => setItem(index, 'mode', value)} options={[['carton', 'Cartones'], ['unit', 'Unidades']]} />
                    <Input label={`Cantidad (${item.mode === 'carton' ? 'cartones' : 'unidades'})`} type="number" min="1" value={item.quantity} onChange={value => setItem(index, 'quantity', value)} />
                    <div className="item-calc">
                      <span>Disponible: <strong>{toCartons(stock).decimal} ctn</strong></span>
                      <span>Precio: <strong>{money(item.mode === 'carton' ? eggType?.cartonPrice : eggType?.unitPrice)}</strong></span>
                      <span>Total: <strong>{money(lineTotal)}</strong></span>
                    </div>
                  </div>
                );
              })}

              <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
                <Plus size={15} /> Agregar producto
              </button>

              <Select label="Metodo de pago" value={form.paymentMethod} onChange={value => setForm({ ...form, paymentMethod: value })} options={PAYMENT_METHODS} />

              {form.paymentMethod !== 'credito' && (
                <Input label="Monto pagado" type="number" step="0.01" min="0" value={form.paid} onChange={value => setForm({ ...form, paid: value })} />
              )}

              <div className={`info-box ${pending > 0 ? 'info-orange' : 'info-green'}`}>
                <div>Total: <strong>{money(total)}</strong></div>
                <div>Pagado: <strong>{money(form.paymentMethod === 'credito' ? 0 : paid)}</strong></div>
                {pending > 0 && <div>Pendiente: <strong>{money(pending)}</strong></div>}
              </div>

              <button type="submit" className="btn btn-primary btn-lg">Venta</button>
            </Form>
          </Section>

          <Section title="Resumen">
            <table className="pl-table">
              <tbody>
                {form.items.map((item, index) => {
                  const eggType = state.eggTypes.find(value => value.id === item.eggTypeId);
                  return (
                    <tr key={index}>
                      <td>{eggType?.name}</td>
                      <td style={{ color: '#64748b' }}>
                        {item.mode === 'carton'
                          ? `${item.quantity} ctn x ${money(eggType?.cartonPrice)}`
                          : `${item.quantity} u x ${money(eggType?.unitPrice)}`}
                      </td>
                      <td className="td-right">{money(calcLineTotal(item))}</td>
                    </tr>
                  );
                })}
                <tr className="tr-bold tr-border-top"><td colSpan={2}>TOTAL</td><td className="td-right">{money(total)}</td></tr>
              </tbody>
            </table>
          </Section>
        </Two>
      )}

      {tab === 'lista' && (
        <Section title={isAdmin ? 'Facturas emitidas' : 'Ventas realizadas'}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Metodo</th><th>Estado</th><th>Ruta</th><th></th></tr>
              </thead>
              <tbody>
                {state.invoices.map(invoice => {
                  const route = state.routes.find(item => item.id === invoice.routeId);
                  return (
                    <tr key={invoice.id}>
                      <td><strong>{invoice.number}</strong></td>
                      <td>{invoice.clientName}{invoice.isFree && <span className="badge badge-gray" style={{ marginLeft: 6 }}>Libre</span>}</td>
                      <td>{fmtDateTime(invoice.date)}</td>
                      <td><strong>{money(invoice.total)}</strong></td>
                      <td style={{ color: '#16a34a' }}>{money(invoice.paid)}</td>
                      <td style={{ color: invoice.total - invoice.paid > 0 ? '#dc2626' : '#16a34a' }}>{money(invoice.total - invoice.paid)}</td>
                      <td>{invoice.paymentMethod}</td>
                      <td><StatusBadge status={invoice.status} /></td>
                      <td>{route?.name || '-'}</td>
                      <td>
                        <button className="btn btn-ghost btn-xs" onClick={() => printInvoice(invoice, state)}>
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
