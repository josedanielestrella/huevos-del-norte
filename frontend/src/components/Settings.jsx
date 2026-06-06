import React from 'react';
import { Section, Two } from './ui.jsx';
import { money } from '../utils/money.js';

export default function Settings({ state }) {
  const c = state.company;
  const totalStock = state.batches.filter(b => b.remainingUnits > 0).reduce((s, b) => s + b.remainingUnits, 0);
  const totalInventoryValue = state.batches.filter(b => b.remainingUnits > 0).reduce((s, b) => s + b.remainingUnits * b.costPerUnit, 0);

  return (
    <Two>
      <Section title="Información de la empresa">
        <table className="pl-table">
          <tbody>
            <tr><td>Empresa</td><td className="td-right"><strong>{c.name}</strong></td></tr>
            <tr><td>Teléfono</td><td className="td-right">{c.phone}</td></tr>
            <tr><td>Dirección</td><td className="td-right">{c.address}</td></tr>
            <tr><td>RNC</td><td className="td-right">{c.rnc || 'N/A'}</td></tr>
            <tr><td>Moneda</td><td className="td-right">{c.currency}</td></tr>
            <tr><td>Huevos por cartón</td><td className="td-right">{c.eggPerCarton}</td></tr>
            <tr><td>ITBIS / Impuesto</td><td className="td-right">{c.taxRate > 0 ? `${c.taxRate * 100}%` : 'Exento (0%)'}</td></tr>
          </tbody>
        </table>

        <div className="info-box info-blue" style={{ marginTop: 16 }}>
          <strong>Para cambiar los datos de la empresa</strong>, modifica el objeto <code>company</code> en el archivo <code>backend/src/data/store.js</code> y reinicia el servidor.
        </div>
      </Section>

      <Section title="Resumen del sistema">
        <table className="pl-table">
          <tbody>
            <tr><td>Tipos de huevo</td><td className="td-right">{state.eggTypes.length}</td></tr>
            <tr><td>Proveedores</td><td className="td-right">{state.suppliers.length}</td></tr>
            <tr><td>Clientes</td><td className="td-right">{state.clients.length}</td></tr>
            <tr><td>Camiones</td><td className="td-right">{state.trucks.length}</td></tr>
            <tr><td>Rutas registradas</td><td className="td-right">{state.routes.length}</td></tr>
            <tr><td>Facturas emitidas</td><td className="td-right">{state.invoices.length}</td></tr>
            <tr><td>Compras registradas</td><td className="td-right">{state.purchases.length}</td></tr>
            <tr><td>Lotes activos</td><td className="td-right">{state.batches.filter(b => b.remainingUnits > 0).length}</td></tr>
            <tr className="tr-bold tr-border-top"><td>Huevos en inventario</td><td className="td-right">{totalStock.toLocaleString()}</td></tr>
            <tr><td>Valor inventario (costo)</td><td className="td-right">{money(totalInventoryValue)}</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Cómo conectar una base de datos real" className="">
        <div className="info-box info-blue">
          <p style={{ marginBottom: 8 }}><strong>Estructura preparada para base de datos.</strong></p>
          <p style={{ marginBottom: 8 }}>El sistema usa datos en memoria (<code>store.js</code>). Para conectar una base de datos real:</p>
          <ol style={{ paddingLeft: 18, lineHeight: 2 }}>
            <li>Instala el driver: <code>npm install pg</code> (PostgreSQL) o <code>npm install mysql2</code></li>
            <li>Reemplaza las funciones en <code>storeService.js</code> con queries SQL</li>
            <li>Cada método (<code>createInvoice</code>, <code>createPurchase</code>, etc.) es un servicio independiente</li>
            <li>La lógica FIFO y de negocio se mantiene igual</li>
          </ol>
        </div>
      </Section>

      <Section title="Tipos de huevo registrados">
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Nombre</th><th>Precio Unidad</th><th>Precio Cartón</th></tr></thead>
            <tbody>
              {state.eggTypes.map(et => (
                <tr key={et.id}>
                  <td><code>{et.id}</code></td>
                  <td><strong>{et.name}</strong></td>
                  <td>{money(et.unitPrice)}</td>
                  <td>{money(et.cartonPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Para editar precios, ve al módulo Inventario → Precios.</p>
      </Section>
    </Two>
  );
}
