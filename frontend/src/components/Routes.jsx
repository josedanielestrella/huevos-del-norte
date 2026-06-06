import React, { useMemo, useState } from 'react';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { Section, Two, Input, Select, Form, StatusBadge } from './ui.jsx';
import { money, toCartons, fmtDateTime, EGG_PER_CARTON } from '../utils/money.js';
import { printWindow } from '../utils/print.js';

const STATUSES = ['Abierta', 'En proceso', 'Cerrada'];
const LOAD_TEMPLATE = { eggTypeId: 'grande', mode: 'carton', quantity: 1, inventoryLotId: '' };

function emptyForm(state) {
  const defaultVendor = state.users.find(user => user.role === 'vendedor')?.id || '';
  return {
    name: '',
    truckId: '',
    assignedUserId: defaultVendor,
    driver: '',
    status: 'Abierta',
    startDate: '',
    loadItems: [{ ...LOAD_TEMPLATE }],
  };
}

export default function Routes({ state, submit }) {
  const isAdmin = state.currentUser?.role === 'admin';
  const [tab, setTab] = useState('lista');
  const [cuadre, setCuadre] = useState(null);
  const [form, setForm] = useState(() => emptyForm(state));
  const vendorUsers = useMemo(() => state.users.filter(user => user.role === 'vendedor'), [state.users]);
  const availableTrucks = state.trucks.filter(truck => truck.status === 'Disponible' || truck.status === 'En ruta');
  const handlePrintCuadre = route => printRouteCuadre(route, state);

  const setField = key => value => setForm(current => ({ ...current, [key]: value }));
  const setLoadItem = (index, key, value) => {
    setForm(current => {
      const loadItems = [...current.loadItems];
      loadItems[index] = { ...loadItems[index], [key]: value };
      if (key === 'eggTypeId') loadItems[index].inventoryLotId = '';
      return { ...current, loadItems };
    });
  };
  const addLoadItem = () => setForm(current => ({ ...current, loadItems: [...current.loadItems, { ...LOAD_TEMPLATE }] }));
  const removeLoadItem = index => setForm(current => ({ ...current, loadItems: current.loadItems.filter((_, itemIndex) => itemIndex !== index) }));

  const totalLoadedUnits = form.loadItems.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    return sum + (item.mode === 'carton' ? quantity * EGG_PER_CARTON : quantity);
  }, 0);

  const handleCreate = () => {
    submit('/routes', {
      ...form,
      loadedUnits: totalLoadedUnits,
      sellerId: form.assignedUserId,
      assignedUserId: form.assignedUserId,
      loadItems: form.loadItems.map(item => ({
        eggTypeId: item.eggTypeId,
        mode: item.mode,
        quantity: Number(item.quantity),
        inventoryLotId: item.inventoryLotId || null,
      })),
    });
    setForm(emptyForm(state));
    setTab('lista');
  };

  const closeRoute = route => {
    if (window.confirm(`Cerrar la ruta "${route.name}"?`)) {
      submit(`/routes/${route.id}`, { ...route, status: 'Cerrada' }, 'PUT');
    }
  };

  const activateRoute = route => {
    submit(`/routes/${route.id}`, { ...route, status: 'En proceso' }, 'PUT');
  };

  if (!isAdmin) {
    return (
      <VendorRoutes
        state={state}
        submit={submit}
        printCuadre={handlePrintCuadre}
        setCuadre={setCuadre}
        cuadre={cuadre}
        tab={tab}
        setTab={setTab}
      />
    );
  }

  return (
    <div>
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'lista' ? ' tab-active' : ''}`} onClick={() => setTab('lista')}>Rutas</button>
        <button className={`tab-btn${tab === 'nueva' ? ' tab-active' : ''}`} onClick={() => setTab('nueva')}>+ Nueva ruta</button>
        {cuadre && <button className={`tab-btn${tab === 'cuadre' ? ' tab-active' : ''}`} onClick={() => setTab('cuadre')}>Cuadre: {cuadre.name}</button>}
      </div>

      {tab === 'nueva' && (
        <Two>
          <Section title="Crear nueva ruta con carga real">
            <Form onSubmit={handleCreate}>
              <Input label="Nombre de la ruta *" value={form.name} onChange={setField('name')} required placeholder="Ej: Dajabon" />
              <Select label="Camion" value={form.truckId} onChange={setField('truckId')} options={[['', '- Sin camion asignado -'], ...availableTrucks.map(truck => [truck.id, `${truck.code} - ${truck.plate} (${truck.capacityCartons} ctn)`])]} />
              <Select label="Vendedor" value={form.assignedUserId} onChange={setField('assignedUserId')} options={vendorUsers.map(user => [user.id, user.displayName])} />
              <Input label="Chofer o nota operativa" value={form.driver} onChange={setField('driver')} />
              <Input label="Fecha de salida" type="datetime-local" value={form.startDate} onChange={setField('startDate')} />
              <Select label="Estado inicial" value={form.status} onChange={setField('status')} options={STATUSES} />

              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>Carga del camion</div>
              {form.loadItems.map((item, index) => {
                const lots = state.batches.filter(batch => batch.eggTypeId === item.eggTypeId && batch.remainingUnits > 0);
                const stockUnits = state.batches.filter(batch => batch.eggTypeId === item.eggTypeId && batch.remainingUnits > 0).reduce((sum, batch) => sum + batch.remainingUnits, 0);
                const truck = state.trucks.find(value => value.id === form.truckId);
                const requestedUnits = item.mode === 'carton' ? (Number(item.quantity) || 0) * EGG_PER_CARTON : (Number(item.quantity) || 0);
                return (
                  <div key={index} className="item-block">
                    <div className="item-block-head">
                      <span>Carga {index + 1}</span>
                      {form.loadItems.length > 1 && (
                        <button type="button" className="btn btn-danger btn-xs" onClick={() => removeLoadItem(index)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <Select label="Tipo de huevo" value={item.eggTypeId} onChange={value => setLoadItem(index, 'eggTypeId', value)} options={state.eggTypes.map(eggType => [eggType.id, eggType.name])} />
                    <Select label="Unidad" value={item.mode} onChange={value => setLoadItem(index, 'mode', value)} options={[['carton', 'Cartones'], ['unit', 'Unidades']]} />
                    <Input label={`Cantidad (${item.mode === 'carton' ? 'cartones' : 'unidades'})`} type="number" min="1" value={item.quantity} onChange={value => setLoadItem(index, 'quantity', value)} />
                    <Select label="Lote origen (opcional)" value={item.inventoryLotId} onChange={value => setLoadItem(index, 'inventoryLotId', value)} options={[['', 'FIFO automatico'], ...lots.map(lot => [lot.id, `${fmtDateTime(lot.purchaseDate || lot.createdAt)} - ${toCartons(lot.remainingUnits).decimal} ctn`])]} />
                    <div className={`info-box ${requestedUnits > stockUnits ? 'info-red' : 'info-blue'}`}>
                      Disponible en inventario general: <strong>{toCartons(stockUnits).decimal} ctn</strong>
                      {requestedUnits > stockUnits ? ` - Excede por ${(requestedUnits - stockUnits).toLocaleString()} huevos` : ''}
                      {truck && ` - Capacidad camion: ${truck.capacityCartons} ctn`}
                    </div>
                  </div>
                );
              })}

              <button type="button" className="btn btn-ghost btn-sm" onClick={addLoadItem}>
                <Plus size={15} /> Agregar tipo de huevo
              </button>

              {form.truckId && (
                <div className={`info-box ${(() => {
                  const truck = state.trucks.find(value => value.id === form.truckId);
                  return totalLoadedUnits > (truck?.capacityUnits || 0) ? 'info-red' : 'info-green';
                })()}`}>
                  Carga total: <strong>{toCartons(totalLoadedUnits).decimal} ctn</strong>
                  {(() => {
                    const truck = state.trucks.find(value => value.id === form.truckId);
                    if (!truck) return null;
                    return ` - Capacidad: ${truck.capacityCartons} ctn (${truck.capacityUnits.toLocaleString()} huevos)`;
                  })()}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg">Crear ruta</button>
            </Form>
          </Section>

          <Section title="Inventario general disponible">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tipo</th><th>Disponible</th><th>Precio carton</th></tr></thead>
                <tbody>
                  {state.eggTypes.map(eggType => {
                    const stockUnits = state.batches.filter(batch => batch.eggTypeId === eggType.id && batch.remainingUnits > 0).reduce((sum, batch) => sum + batch.remainingUnits, 0);
                    return (
                      <tr key={eggType.id}>
                        <td><strong>{eggType.name}</strong></td>
                        <td>{toCartons(stockUnits).decimal} ctn</td>
                        <td>{money(eggType.cartonPrice)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </Two>
      )}

      {tab === 'lista' && (
        <RouteList
          state={state}
          routes={state.routes}
          printCuadre={handlePrintCuadre}
          setCuadre={setCuadre}
          setTab={setTab}
          activateRoute={activateRoute}
          closeRoute={closeRoute}
          adminMode
        />
      )}

      {tab === 'cuadre' && cuadre && <RouteCuadre route={cuadre} state={state} submit={submit} printCuadre={handlePrintCuadre} />}
    </div>
  );
}

function VendorRoutes({ state, submit, printCuadre, setCuadre, cuadre, tab, setTab }) {
  return (
    <div>
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'lista' ? ' tab-active' : ''}`} onClick={() => setTab('lista')}>Mis rutas</button>
        {cuadre && <button className={`tab-btn${tab === 'cuadre' ? ' tab-active' : ''}`} onClick={() => setTab('cuadre')}>Cuadre: {cuadre.name}</button>}
      </div>
      {tab === 'lista' && <RouteList state={state} routes={state.routes} printCuadre={printCuadre} setCuadre={setCuadre} setTab={setTab} />}
      {tab === 'cuadre' && cuadre && <RouteCuadre route={cuadre} state={state} submit={submit} printCuadre={printCuadre} />}
    </div>
  );
}

function RouteList({ state, routes, printCuadre, setCuadre, setTab, activateRoute, closeRoute, adminMode = false }) {
  return (
    <div>
      {['En proceso', 'Abierta', 'Cerrada'].map(status => {
        const filtered = routes.filter(route => route.status === status);
        if (!filtered.length) return null;
        return (
          <Section key={status} title={`Rutas ${status}`}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Nombre</th><th>Vendedor</th><th>Camion</th><th>Cargado</th><th>Vendido</th><th>Devuelto</th><th>Rotos</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(route => {
                    const truck = state.trucks.find(item => item.id === route.truckId);
                    const seller = state.users.find(item => item.id === route.assignedUserId);
                    const routeInvoices = state.invoices.filter(invoice => invoice.routeId === route.id);
                    const totalSold = routeInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
                    return (
                      <tr key={route.id}>
                        <td>
                          <strong>{route.name}</strong>
                          {totalSold > 0 && <div style={{ fontSize: 12, color: '#64748b' }}>{money(totalSold)} en ventas</div>}
                        </td>
                        <td>{seller?.displayName || route.driver || '-'}</td>
                        <td>{truck ? `${truck.code} - ${truck.plate}` : '-'}</td>
                        <td>{toCartons(route.loadedUnits).decimal} ctn</td>
                        <td>{toCartons(route.soldUnits).decimal} ctn</td>
                        <td>{toCartons(route.returnedUnits || 0).decimal} ctn</td>
                        <td>{toCartons(route.brokenUnits || 0).decimal} ctn</td>
                        <td><StatusBadge status={route.status} /></td>
                        <td className="action-cell">
                          <button className="btn btn-ghost btn-xs" onClick={() => { setCuadre(route); setTab('cuadre'); }}>Cuadre</button>
                          <button className="btn btn-ghost btn-xs" onClick={() => printCuadre(route)}><Printer size={13} /></button>
                          {adminMode && route.status === 'Abierta' && <button className="btn btn-ghost btn-xs" onClick={() => activateRoute(route)}>Iniciar</button>}
                          {adminMode && route.status === 'En proceso' && <button className="btn btn-danger btn-xs" onClick={() => closeRoute(route)}>Cerrar</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        );
      })}
    </div>
  );
}

function RouteCuadre({ route, state, submit, printCuadre }) {
  const routeInvoices = state.invoices.filter(invoice => invoice.routeId === route.id);
  const routeLoads = state.routeLoads.filter(load => load.routeId === route.id);
  const totalSold = routeInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const totalCash = routeInvoices.reduce((sum, invoice) => sum + invoice.paid, 0);
  const totalCredit = totalSold - totalCash;
  const expenses = state.expenses.filter(expense => expense.routeId === route.id).reduce((sum, expense) => sum + expense.amount, 0);
  const truck = state.trucks.find(item => item.id === route.truckId);
  const clients = state.clients.filter(client => client.routeId === route.id);
  const netProfit = totalSold - expenses;
  const remaining = routeLoads.reduce((sum, load) => sum + (load.remainingUnits || 0), 0);
  const [brokenMap, setBrokenMap] = useState(() => Object.fromEntries(routeLoads.map(load => [load.id, 0])));

  const processReturn = () => {
    const items = routeLoads
      .filter(load => (load.remainingUnits || 0) > 0)
      .map(load => {
        const brokenUnits = Math.min(Number(brokenMap[load.id]) || 0, load.remainingUnits || 0);
        return {
          routeLoadId: load.id,
          brokenUnits,
          returnedUnits: Math.max(0, (load.remainingUnits || 0) - brokenUnits),
        };
      })
      .filter(item => item.returnedUnits > 0 || item.brokenUnits > 0);

    if (!items.length) return;
    submit(`/routes/${route.id}/returns`, { items }, 'POST');
  };

  const isAdmin = state.currentUser?.role === 'admin';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>{route.name}</h2>
          <p style={{ margin: 0, color: '#64748b' }}>{route.driver || '-'} - {truck ? `${truck.code} - ${truck.plate}` : 'Sin camion'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatusBadge status={route.status} />
          <button className="btn btn-ghost btn-sm" onClick={() => printCuadre(route)}>
            <Printer size={15} /> Imprimir cuadre
          </button>
        </div>
      </div>

      <Two>
        <Section title="Movimiento de carga">
          <table className="pl-table">
            <tbody>
              <tr><td>Cargado</td><td className="td-right">{toCartons(route.loadedUnits).decimal} ctn ({route.loadedUnits} u)</td></tr>
              <tr><td>Vendido</td><td className="td-right">{toCartons(route.soldUnits).decimal} ctn ({route.soldUnits} u)</td></tr>
              <tr><td>Huevos devueltos</td><td className="td-right">{toCartons(route.returnedUnits || 0).decimal} ctn ({route.returnedUnits || 0} u)</td></tr>
              <tr><td>Huevos rotos</td><td className="td-right">{toCartons(route.brokenUnits || 0).decimal} ctn ({route.brokenUnits || 0} u)</td></tr>
              <tr className="tr-bold tr-border-top"><td>Restante en camion</td><td className="td-right">{toCartons(remaining).decimal} ctn ({remaining} u)</td></tr>
            </tbody>
          </table>
        </Section>

        <Section title="Resumen financiero">
          <table className="pl-table">
            <tbody>
              <tr><td>Ventas totales</td><td className="td-right">{money(totalSold)}</td></tr>
              <tr><td>Cobrado</td><td className="td-right" style={{ color: '#16a34a' }}>{money(totalCash)}</td></tr>
              <tr><td>Credito</td><td className="td-right" style={{ color: '#dc2626' }}>{money(totalCredit)}</td></tr>
              <tr><td>Gastos</td><td className="td-right" style={{ color: '#dc2626' }}>({money(expenses)})</td></tr>
              <tr className="tr-bold tr-border-top tr-highlight"><td>Neto</td><td className="td-right">{money(netProfit)}</td></tr>
            </tbody>
          </table>
        </Section>
      </Two>

      {isAdmin && routeLoads.some(load => (load.remainingUnits || 0) > 0) && (
        <Section title="Agregar sobrantes al inventario general">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tipo</th><th>Restante en camion</th><th>Huevos rotos</th><th>Huevos devueltos</th></tr></thead>
              <tbody>
                {routeLoads.filter(load => (load.remainingUnits || 0) > 0).map(load => {
                  const eggType = state.eggTypes.find(item => item.id === load.eggTypeId);
                  const brokenUnits = Math.min(Number(brokenMap[load.id]) || 0, load.remainingUnits || 0);
                  const returnedUnits = Math.max(0, (load.remainingUnits || 0) - brokenUnits);
                  return (
                    <tr key={load.id}>
                      <td><strong>{eggType?.name || load.eggTypeId}</strong></td>
                      <td>{toCartons(load.remainingUnits || 0).decimal} ctn</td>
                      <td style={{ minWidth: 180 }}>
                        <Input type="number" min="0" max={load.remainingUnits || 0} value={brokenMap[load.id] || 0} onChange={value => setBrokenMap(current => ({ ...current, [load.id]: value }))} />
                      </td>
                      <td>{toCartons(returnedUnits).decimal} ctn ({returnedUnits} u)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-primary" onClick={processReturn}>Agregar a inventario general</button>
          </div>
        </Section>
      )}

      <Section title={`Facturas (${routeInvoices.length})`}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Estado</th></tr></thead>
            <tbody>
              {routeInvoices.map(invoice => (
                <tr key={invoice.id}>
                  <td>{invoice.number}</td>
                  <td>{invoice.clientName}{invoice.isFree && <span className="badge badge-gray" style={{ marginLeft: 6 }}>Libre</span>}</td>
                  <td>{money(invoice.total)}</td>
                  <td style={{ color: '#16a34a' }}>{money(invoice.paid)}</td>
                  <td style={{ color: invoice.total - invoice.paid > 0 ? '#dc2626' : '#16a34a' }}>{money(invoice.total - invoice.paid)}</td>
                  <td><StatusBadge status={invoice.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Two>
        <Section title="Clientes de la ruta">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cliente</th><th>Sector</th><th>Balance</th></tr></thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.id}>
                    <td><strong>{client.name}</strong><br /><small style={{ color: '#64748b' }}>{client.phone}</small></td>
                    <td>{client.sector}</td>
                    <td style={{ color: client.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{client.balance > 0 ? money(client.balance) : 'Al dia'}</td>
                  </tr>
                ))}
                {!clients.length && <tr><td colSpan={3}><span className="muted">Sin clientes asignados.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Gastos de la ruta">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Categoria</th><th>Descripcion</th><th>Monto</th></tr></thead>
              <tbody>
                {state.expenses.filter(expense => expense.routeId === route.id).map(expense => (
                  <tr key={expense.id}>
                    <td><span className="badge badge-yellow">{expense.category}</span></td>
                    <td>{expense.description}</td>
                    <td>{money(expense.amount)}</td>
                  </tr>
                ))}
                {!state.expenses.filter(expense => expense.routeId === route.id).length && <tr><td colSpan={3}><span className="muted">Sin gastos registrados.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </Section>
      </Two>
    </div>
  );
}

function printRouteCuadre(route, state) {
  const routeInvoices = state.invoices.filter(invoice => invoice.routeId === route.id);
  const routeLoads = state.routeLoads.filter(load => load.routeId === route.id);
  const totalSold = routeInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const totalCash = routeInvoices.reduce((sum, invoice) => sum + invoice.paid, 0);
  const totalCredit = totalSold - totalCash;
  const expenses = state.expenses.filter(expense => expense.routeId === route.id).reduce((sum, expense) => sum + expense.amount, 0);
  const truck = state.trucks.find(item => item.id === route.truckId);
  const remaining = routeLoads.reduce((sum, load) => sum + (load.remainingUnits || 0), 0);

  const invoicesRows = routeInvoices.map(invoice => `<tr>
    <td>${invoice.number}</td>
    <td>${invoice.clientName}</td>
    <td>${money(invoice.total)}</td>
    <td>${money(invoice.paid)}</td>
    <td>${invoice.status}</td>
  </tr>`).join('');

  printWindow(`Cuadre ${route.name}`, `
    <div class="header">
      <div><h1>Cuadre de Ruta</h1><strong style="font-size:18px">${route.name}</strong></div>
      <div class="invoice-meta">
        Responsable: ${route.driver || '-'}<br>
        Camion: ${truck?.code || '-'} (${truck?.plate || '-'})<br>
        Inicio: ${fmtDateTime(route.startedAt)}<br>
        ${route.closedAt ? `Cierre: ${fmtDateTime(route.closedAt)}` : 'Ruta en curso'}
      </div>
    </div>
    <h2>Resumen de carga</h2>
    <table><tbody>
      <tr><td>Cargado</td><td>${toCartons(route.loadedUnits).decimal} cartones (${route.loadedUnits} u)</td></tr>
      <tr><td>Vendido</td><td>${toCartons(route.soldUnits).decimal} cartones (${route.soldUnits} u)</td></tr>
      <tr><td>Huevos devueltos</td><td>${toCartons(route.returnedUnits || 0).decimal} cartones (${route.returnedUnits || 0} u)</td></tr>
      <tr><td>Huevos rotos</td><td>${toCartons(route.brokenUnits || 0).decimal} cartones (${route.brokenUnits || 0} u)</td></tr>
      <tr><td>Restante en camion</td><td>${toCartons(remaining).decimal} cartones (${remaining} u)</td></tr>
    </tbody></table>
    <h2>Ventas (${routeInvoices.length})</h2>
    ${routeInvoices.length ? `<table><thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Pagado</th><th>Estado</th></tr></thead><tbody>${invoicesRows}</tbody></table>` : '<p>Sin ventas registradas.</p>'}
    <div class="total-section"><table class="total-box"><tbody>
      <tr><td>Ventas totales</td><td>${money(totalSold)}</td></tr>
      <tr><td>Cobrado</td><td>${money(totalCash)}</td></tr>
      <tr><td>Credito</td><td>${money(totalCredit)}</td></tr>
      <tr><td>Gastos</td><td>(${money(expenses)})</td></tr>
      <tr class="grand-total"><td>Neto</td><td>${money(totalSold - expenses)}</td></tr>
    </tbody></table></div>
  `);
}
