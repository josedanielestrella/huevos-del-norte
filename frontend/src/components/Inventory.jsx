import React, { useState } from 'react';
import { Section, Two, Input, Select, Form } from './ui.jsx';
import { money, toCartons, fmtDate } from '../utils/money.js';

export default function Inventory({ state, submit }) {
  const isAdmin = state.currentUser?.role === 'admin';
  const tabs = isAdmin ? ['resumen', 'lotes', 'precios'] : ['resumen', 'lotes'];
  const [tab, setTab] = useState('resumen');
  const [prices, setPrices] = useState(state.eggTypes[0]);

  return (
    <div>
      <div className="tab-bar">
        {tabs.map(item => (
          <button key={item} className={`tab-btn${tab === item ? ' tab-active' : ''}`} onClick={() => setTab(item)}>
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'resumen' && <InventoryResumen state={state} isAdmin={isAdmin} />}
      {tab === 'lotes' && <InventoryLotes state={state} isAdmin={isAdmin} />}
      {tab === 'precios' && isAdmin && prices && (
        <Two>
          <Section title="Precios de venta actuales">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tipo</th><th>P. unidad</th><th>P. carton</th><th>Stock</th></tr></thead>
                <tbody>
                  {state.eggTypes.map(eggType => {
                    const stock = state.batches
                      .filter(batch => batch.eggTypeId === eggType.id && batch.remainingUnits > 0)
                      .reduce((sum, batch) => sum + batch.remainingUnits, 0);
                    return (
                      <tr key={eggType.id}>
                        <td><strong>{eggType.name}</strong></td>
                        <td>{money(eggType.unitPrice)}</td>
                        <td>{money(eggType.cartonPrice)}</td>
                        <td>{toCartons(stock).decimal} ctn</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Editar precio de venta">
            <Form onSubmit={() => submit(`/egg-types/${prices.id}`, prices, 'PUT')}>
              <Select
                label="Tipo de huevo"
                value={prices.id}
                onChange={id => setPrices(state.eggTypes.find(item => item.id === id))}
                options={state.eggTypes.map(item => [item.id, item.name])}
              />
              <Input label="Precio por unidad" type="number" step="0.01" value={prices.unitPrice} onChange={value => setPrices({ ...prices, unitPrice: value })} />
              <Input label="Precio por carton" type="number" step="0.01" value={prices.cartonPrice} onChange={value => setPrices({ ...prices, cartonPrice: value })} />
              <button type="submit" className="btn btn-primary">Actualizar precios</button>
            </Form>
          </Section>
        </Two>
      )}
    </div>
  );
}

function InventoryResumen({ state, isAdmin }) {
  const stockByType = state.eggTypes.map(eggType => {
    const units = state.batches
      .filter(batch => batch.eggTypeId === eggType.id && batch.remainingUnits > 0)
      .reduce((sum, batch) => sum + batch.remainingUnits, 0);

    const relevant = state.batches.filter(batch => batch.eggTypeId === eggType.id && batch.remainingUnits > 0);
    const totalCost = relevant.reduce((sum, batch) => sum + batch.remainingUnits * batch.costPerUnit, 0);
    const avgCost = units > 0 ? totalCost / units : 0;

    return { ...eggType, units, cartons: toCartons(units), avgCost };
  });

  const totalUnits = stockByType.reduce((sum, item) => sum + item.units, 0);
  const totalValue = stockByType.reduce((sum, item) => sum + item.units * item.avgCost, 0);

  return (
    <Section title={isAdmin ? `Inventario general - ${toCartons(totalUnits).decimal} cartones` : `Inventario cargado - ${toCartons(totalUnits).decimal} cartones`}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Huevos</th>
              <th>Cartones</th>
              <th>Resto</th>
              <th>Costo prom/u</th>
              <th>Valor</th>
              <th>P. unidad</th>
              <th>P. carton</th>
            </tr>
          </thead>
          <tbody>
            {stockByType.map(item => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td>{item.units.toLocaleString()}</td>
                <td>{item.cartons.cartons}</td>
                <td>{item.cartons.rest} u</td>
                <td>{money(item.avgCost)}</td>
                <td>{money(item.units * item.avgCost)}</td>
                <td>{money(item.unitPrice)}</td>
                <td>{money(item.cartonPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
              <td>TOTAL</td>
              <td>{totalUnits.toLocaleString()}</td>
              <td>{toCartons(totalUnits).decimal}</td>
              <td colSpan={2}></td>
              <td>{money(totalValue)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Section>
  );
}

function InventoryLotes({ state, isAdmin }) {
  const [filterType, setFilterType] = useState('');
  const batches = state.batches
    .filter(batch => !filterType || batch.eggTypeId === filterType)
    .sort((a, b) => new Date(a.purchaseDate || a.createdAt) - new Date(b.purchaseDate || b.createdAt));

  return (
    <Section title={isAdmin ? 'Inventario por lotes' : 'Inventario cargado por ruta'}>
      <div style={{ marginBottom: 14 }}>
        <Select
          label="Filtrar por tipo"
          value={filterType}
          onChange={setFilterType}
          options={[['', 'Todos los tipos'], ...state.eggTypes.map(item => [item.id, item.name])]}
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{isAdmin ? 'Origen' : 'Ruta'}</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Cargado</th>
              <th>Restante</th>
              <th>Vendido</th>
              <th>Costo/u</th>
              <th>Valor restante</th>
            </tr>
          </thead>
          <tbody>
            {batches.map(batch => {
              const supplier = state.suppliers.find(item => item.id === batch.supplierId);
              const route = state.routes.find(item => item.id === batch.routeId);
              const eggType = state.eggTypes.find(item => item.id === batch.eggTypeId);
              const sold = (batch.quantityUnits || batch.loadedUnits || 0) - (batch.remainingUnits || 0);
              const quantityUnits = batch.quantityUnits || batch.loadedUnits || 0;
              return (
                <tr key={batch.id} style={{ opacity: batch.remainingUnits === 0 ? 0.55 : 1 }}>
                  <td>
                    {batch.sourceType === 'route-return'
                      ? `Huevos devueltos${route ? ` - ${route.name}` : ''}`
                      : (isAdmin ? (supplier?.name || '-') : (route?.name || '-'))}
                  </td>
                  <td><strong>{eggType?.name || batch.eggTypeId}</strong></td>
                  <td>{fmtDate(batch.purchaseDate || batch.createdAt)}</td>
                  <td>{toCartons(quantityUnits).decimal} ctn</td>
                  <td><strong>{toCartons(batch.remainingUnits || 0).decimal} ctn</strong></td>
                  <td>{toCartons(sold).decimal} ctn</td>
                  <td>{money(batch.costPerUnit)}</td>
                  <td>{money((batch.remainingUnits || 0) * batch.costPerUnit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isAdmin && Array.isArray(state.inventoryReturns) && state.inventoryReturns.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Registro</th><th>Fecha</th><th>Ruta</th><th>Tipo</th><th>Devueltos</th><th>Rotos</th></tr></thead>
              <tbody>
                {state.inventoryReturns.map(item => {
                  const route = state.routes.find(value => value.id === item.routeId);
                  const eggType = state.eggTypes.find(value => value.id === item.eggTypeId);
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.returnNumber}</strong></td>
                      <td>{fmtDate(item.returnDate)}</td>
                      <td>{route?.name || '-'}</td>
                      <td>{eggType?.name || item.eggTypeId}</td>
                      <td>{toCartons(item.returnedUnits).decimal} ctn</td>
                      <td>{toCartons(item.brokenUnits || 0).decimal} ctn</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}
