import React, { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Section, StatusBadge } from './ui.jsx';
import { money, toCartons, fmtDate, fmtDateTime } from '../utils/money.js';
import { printWindow } from '../utils/print.js';

export default function Reports({ state, reports }) {
  const isVendor = reports?.vendorScope === true;
  const [tab, setTab] = useState('pl');
  if (!reports) return null;

  const tabs = isVendor
    ? [
      { id: 'pl', label: 'Resumen' },
      { id: 'ventas', label: 'Ventas' },
      { id: 'gastos', label: 'Gastos' },
      { id: 'inventario', label: 'Inventario' },
      { id: 'rutas', label: 'Rutas' },
    ]
    : [
      { id: 'pl', label: 'P&L' },
      { id: 'ventas', label: 'Ventas' },
      { id: 'compras', label: 'Compras' },
      { id: 'gastos', label: 'Gastos' },
      { id: 'inventario', label: 'Inventario' },
      { id: 'rutas', label: 'Rutas' },
      { id: 'cxc', label: 'CxC' },
      { id: 'cxp', label: 'CxP' },
    ];

  const printTable = (title, headers, rows) => {
    const thead = `<thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>`;
    printWindow(title, `<h1>${title}</h1><table>${thead}${tbody}</table>`);
  };

  const pl = reports.profitLoss;
  const pendingClients = useMemo(() => state.clients.filter(client => client.balance > 0), [state.clients]);

  return (
    <div>
      <div className="tab-bar" style={{ flexWrap: 'wrap' }}>
        {tabs.map(item => (
          <button key={item.id} className={`tab-btn${tab === item.id ? ' tab-active' : ''}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'pl' && (
        <Section title={isVendor ? 'Resumen de tu operacion' : 'Estado de resultados'} action={
          <button className="btn btn-ghost btn-sm" onClick={() => printWindow('Estado de resultados', `
            <h1>${isVendor ? 'Resumen de vendedor' : 'Estado de resultados'}</h1>
            <table>
              <tbody>
                <tr><td>Ventas</td><td style="text-align:right">${money(pl.revenue)}</td></tr>
                <tr><td>Costo</td><td style="text-align:right">(${money(pl.cogs)})</td></tr>
                <tr><td>Ganancia bruta</td><td style="text-align:right">${money(pl.grossProfit)}</td></tr>
                <tr><td>Gastos</td><td style="text-align:right">(${money(pl.expenses)})</td></tr>
                <tr><td>Ganancia neta</td><td style="text-align:right">${money(pl.netProfit)}</td></tr>
              </tbody>
            </table>
          `)}>
            <Printer size={15} /> Imprimir
          </button>
        }>
          <table className="pl-table">
            <tbody>
              <tr><td>Ventas brutas</td><td className="td-right">{money(pl.revenue)}</td></tr>
              <tr className="tr-sub"><td>Costo mercancia vendida</td><td className="td-right text-red">({money(pl.cogs)})</td></tr>
              <tr className="tr-bold tr-border-top"><td>Ganancia bruta</td><td className="td-right">{money(pl.grossProfit)}</td></tr>
              <tr><td style={{ paddingLeft: 16, color: '#64748b', fontSize: 12 }}>Margen bruto</td><td className="td-right" style={{ fontSize: 12, color: '#64748b' }}>{pl.grossMargin}%</td></tr>
              <tr className="tr-sub"><td>Gastos operativos</td><td className="td-right text-red">({money(pl.expenses)})</td></tr>
              <tr className="tr-bold tr-border-top tr-highlight"><td>Ganancia neta</td><td className="td-right">{money(pl.netProfit)}</td></tr>
              <tr><td style={{ paddingLeft: 16, color: '#64748b', fontSize: 12 }}>Margen neto</td><td className="td-right" style={{ fontSize: 12, color: '#64748b' }}>{pl.netMargin}%</td></tr>
            </tbody>
          </table>
        </Section>
      )}

      {tab === 'ventas' && (
        <Section title="Reporte de ventas" action={
          <button className="btn btn-ghost btn-sm" onClick={() => printTable('Reporte de ventas', ['#', 'Cliente', 'Fecha', 'Total', 'Pagado', 'Pendiente', 'Estado'], state.invoices.map(invoice => [invoice.number, invoice.clientName, fmtDateTime(invoice.date), money(invoice.total), money(invoice.paid), money(invoice.total - invoice.paid), invoice.status]))}>
            <Printer size={15} /> Imprimir
          </button>
        }>
          <ReportSalesTable state={state} />
        </Section>
      )}

      {tab === 'compras' && !isVendor && (
        <Section title="Reporte de compras" action={
          <button className="btn btn-ghost btn-sm" onClick={() => printTable('Reporte de compras', ['#', 'Proveedor', 'Fecha', 'Total', 'Pagado', 'Estado'], state.purchases.map(purchase => {
            const supplier = state.suppliers.find(item => item.id === purchase.supplierId);
            return [purchase.number, supplier?.name || '-', fmtDate(purchase.date), money(purchase.total), money(purchase.paid), purchase.status];
          }))}>
            <Printer size={15} /> Imprimir
          </button>
        }>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Proveedor</th><th>Fecha</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Estado</th></tr></thead>
              <tbody>
                {state.purchases.map(purchase => {
                  const supplier = state.suppliers.find(item => item.id === purchase.supplierId);
                  return (
                    <tr key={purchase.id}>
                      <td>{purchase.number}</td>
                      <td><strong>{supplier?.name || '-'}</strong></td>
                      <td>{fmtDateTime(purchase.date)}</td>
                      <td>{money(purchase.total)}</td>
                      <td style={{ color: '#16a34a' }}>{money(purchase.paid)}</td>
                      <td style={{ color: purchase.total - purchase.paid > 0 ? '#dc2626' : '#16a34a' }}>{money(purchase.total - purchase.paid)}</td>
                      <td><StatusBadge status={purchase.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === 'gastos' && (
        <Section title="Reporte de gastos" action={
          <button className="btn btn-ghost btn-sm" onClick={() => printTable('Reporte de gastos', ['Fecha', 'Categoria', 'Descripcion', 'Monto', 'Ruta'], state.expenses.map(expense => {
            const route = state.routes.find(item => item.id === expense.routeId);
            return [fmtDateTime(expense.date), expense.category, expense.description, money(expense.amount), route?.name || '-'];
          }))}>
            <Printer size={15} /> Imprimir
          </button>
        }>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Categoria</th><th>Descripcion</th><th>Monto</th><th>Ruta</th><th>Camion</th><th>Responsable</th></tr></thead>
              <tbody>
                {state.expenses.map(expense => {
                  const route = state.routes.find(item => item.id === expense.routeId);
                  const truck = state.trucks.find(item => item.id === expense.truckId);
                  return (
                    <tr key={expense.id}>
                      <td>{fmtDateTime(expense.date)}</td>
                      <td><span className="badge badge-yellow">{expense.category}</span></td>
                      <td>{expense.description}</td>
                      <td><strong>{money(expense.amount)}</strong></td>
                      <td>{route?.name || '-'}</td>
                      <td>{truck?.code || '-'}</td>
                      <td>{expense.seller || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === 'inventario' && (
        <Section title="Reporte de inventario" action={
          <button className="btn btn-ghost btn-sm" onClick={() => printTable('Inventario', ['Tipo', 'Fecha', 'Comprado', 'Restante', 'Costo/u'], state.batches.map(batch => {
            const eggType = state.eggTypes.find(item => item.id === batch.eggTypeId);
            return [eggType?.name || batch.eggTypeId, fmtDate(batch.purchaseDate || batch.createdAt), `${toCartons(batch.quantityUnits || batch.loadedUnits || 0).decimal} ctn`, `${toCartons(batch.remainingUnits || 0).decimal} ctn`, money(batch.costPerUnit)];
          }))}>
            <Printer size={15} /> Imprimir
          </button>
        }>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tipo</th><th>Fecha</th><th>Comprado/Cargado</th><th>Restante</th><th>Vendido</th><th>Costo/u</th><th>Valor restante</th></tr></thead>
              <tbody>
                {state.batches.map(batch => {
                  const eggType = state.eggTypes.find(item => item.id === batch.eggTypeId);
                  const initialUnits = batch.quantityUnits || batch.loadedUnits || 0;
                  const sold = initialUnits - (batch.remainingUnits || 0);
                  return (
                    <tr key={batch.id}>
                      <td><strong>{eggType?.name || batch.eggTypeId}</strong></td>
                      <td>{fmtDate(batch.purchaseDate || batch.createdAt)}</td>
                      <td>{toCartons(initialUnits).decimal} ctn</td>
                      <td>{toCartons(batch.remainingUnits || 0).decimal} ctn</td>
                      <td>{toCartons(sold).decimal} ctn</td>
                      <td>{money(batch.costPerUnit)}</td>
                      <td>{money((batch.remainingUnits || 0) * batch.costPerUnit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === 'rutas' && (
        <Section title="Reporte de rutas" action={
          <button className="btn btn-ghost btn-sm" onClick={() => printTable('Reporte de rutas', ['Ruta', 'Cargado', 'Vendido', 'Ventas', 'Gastos', 'Ganancia', 'Estado'], reports.routeProfit.map(route => [route.name, `${toCartons(route.loadedUnits).decimal} ctn`, `${toCartons(route.soldUnits).decimal} ctn`, money(route.totalSold), money(route.expenses), money(route.profit), route.status]))}>
            <Printer size={15} /> Imprimir
          </button>
        }>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ruta</th><th>Camion</th><th>Cargado</th><th>Vendido</th><th>Ventas</th><th>Costo</th><th>Gastos</th><th>Ganancia</th><th>Estado</th></tr></thead>
              <tbody>
                {reports.routeProfit.map(route => (
                  <tr key={route.id}>
                    <td><strong>{route.name}</strong></td>
                    <td>{route.truckCode}</td>
                    <td>{toCartons(route.loadedUnits).decimal} ctn</td>
                    <td>{toCartons(route.soldUnits).decimal} ctn</td>
                    <td>{money(route.totalSold)}</td>
                    <td style={{ color: '#dc2626' }}>{money(route.totalCOGS)}</td>
                    <td style={{ color: '#dc2626' }}>{money(route.expenses)}</td>
                    <td style={{ color: route.profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{money(route.profit)}</td>
                    <td><StatusBadge status={route.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === 'cxc' && !isVendor && (
        <Section title="Cuentas por cobrar">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cliente</th><th>Ruta</th><th>Balance</th><th>Facturas pendientes</th></tr></thead>
              <tbody>
                {pendingClients.map(client => {
                  const route = state.routes.find(item => item.id === client.routeId);
                  const pendingInvoices = state.invoices.filter(invoice => invoice.clientId === client.id && invoice.status !== 'pagada');
                  return (
                    <tr key={client.id}>
                      <td><strong>{client.name}</strong></td>
                      <td>{route?.name || '-'}</td>
                      <td style={{ color: '#dc2626', fontWeight: 700 }}>{money(client.balance)}</td>
                      <td>{pendingInvoices.map(invoice => invoice.number).join(', ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === 'cxp' && !isVendor && (
        <Section title="Cuentas por pagar">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Proveedor</th><th>Compra</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Vence</th><th>Estado</th></tr></thead>
              <tbody>
                {state.payables.map(payable => {
                  const supplier = state.suppliers.find(item => item.id === payable.supplierId);
                  const purchase = state.purchases.find(item => item.id === payable.purchaseId);
                  return (
                    <tr key={payable.id}>
                      <td><strong>{supplier?.name || '-'}</strong></td>
                      <td>{purchase?.number || '-'}</td>
                      <td>{money(payable.amount)}</td>
                      <td style={{ color: '#16a34a' }}>{money(payable.paid)}</td>
                      <td style={{ color: payable.amount - payable.paid > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{money(payable.amount - payable.paid)}</td>
                      <td>{payable.dueDate}</td>
                      <td><StatusBadge status={payable.status} /></td>
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

function ReportSalesTable({ state }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Metodo</th><th>Estado</th><th>Ruta</th></tr>
        </thead>
        <tbody>
          {state.invoices.map(invoice => {
            const route = state.routes.find(item => item.id === invoice.routeId);
            return (
              <tr key={invoice.id}>
                <td>{invoice.number}</td>
                <td>{invoice.clientName}{invoice.isFree && <span className="badge badge-gray" style={{ marginLeft: 4 }}>Libre</span>}</td>
                <td>{fmtDateTime(invoice.date)}</td>
                <td>{money(invoice.total)}</td>
                <td style={{ color: '#16a34a' }}>{money(invoice.paid)}</td>
                <td style={{ color: invoice.total - invoice.paid > 0 ? '#dc2626' : '#16a34a' }}>{money(invoice.total - invoice.paid)}</td>
                <td>{invoice.paymentMethod}</td>
                <td><StatusBadge status={invoice.status} /></td>
                <td>{route?.name || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
