import React from 'react';
import {
  Receipt, DollarSign, BarChart3, Boxes, Route, Truck, FileText,
  TrendingUp, TrendingDown, CreditCard, ShoppingCart, Wallet,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, Section, Two, Grid } from './ui.jsx';
import { money } from '../utils/money.js';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Dashboard({ dash, reports, state, navigate }) {
  if (!dash || !reports) return null;
  if (dash.role === 'vendedor') return <VendorDashboard dash={dash} state={state} navigate={navigate} />;
  return <AdminDashboard dash={dash} reports={reports} state={state} />;
}

function AdminDashboard({ dash, reports, state }) {
  const pl = reports.profitLoss;

  return (
    <div>
      <Grid cols={4}>
        <Card label="Ventas hoy" value={money(dash.salesToday)} sub={`Cobrado: ${money(dash.cashToday)}`} icon={Receipt} color="amber" />
        <Card label="Gastos hoy" value={money(dash.expensesToday)} sub="Operaciones del dia" icon={DollarSign} color="red" />
        <Card label="Ganancia bruta total" value={money(pl.grossProfit)} sub={`Margen: ${pl.grossMargin}%`} icon={TrendingUp} color="green" />
        <Card label="Ganancia neta total" value={money(pl.netProfit)} sub={`Margen: ${pl.netMargin}%`} icon={BarChart3} color="purple" />
        <Card label="Inventario total" value={`${dash.stockCartons.decimalCartons} ctn`} sub={`${dash.stockUnits.toLocaleString()} huevos`} icon={Boxes} color="amber" />
        <Card label="CxC" value={money(dash.pendingBalance)} sub="Clientes con balance" icon={FileText} color="orange" />
        <Card label="CxP" value={money(dash.totalPayable)} sub="Deuda a proveedores" icon={CreditCard} color="red" />
        <Card label="Total compras" value={money(dash.totalPurchases)} sub="Compras registradas" icon={ShoppingCart} color="blue" />
        <Card label="Ventas totales" value={money(pl.revenue)} sub="Periodo completo" icon={Receipt} color="green" />
        <Card label="Costo de venta" value={money(pl.cogs)} sub="CMV real" icon={TrendingDown} color="red" />
        <Card label="Rutas abiertas" value={dash.activeRoutes} sub="En proceso" icon={Route} color="blue" />
        <Card label="Camiones disponibles" value={dash.availableTrucks} sub={`de ${state.trucks.length} en flota`} icon={Truck} color="green" />
      </Grid>

      <Two>
        <Section title="Ventas por dia">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={reports.salesByDay} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={value => money(value)} />
              <Bar dataKey="total" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Ventas" />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Gastos por categoria">
          {reports.expensesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={reports.expensesByCategory}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {reports.expensesByCategory.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={value => money(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="muted">Sin gastos registrados.</p>}
        </Section>
      </Two>

      <Two>
        <Section title="Inventario por tipo">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Huevos</th><th>Cartones</th><th>P. unidad</th><th>P. carton</th></tr>
              </thead>
              <tbody>
                {dash.stockByType.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.stockUnits.toLocaleString()}</td>
                    <td>{item.stockCartons.decimalCartons}</td>
                    <td>{money(item.unitPrice)}</td>
                    <td>{money(item.cartonPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Estado financiero">
          <table className="pl-table">
            <tbody>
              <tr><td>Ventas brutas</td><td className="td-right">{money(pl.revenue)}</td></tr>
              <tr className="tr-sub"><td>Costo mercancia vendida</td><td className="td-right text-red">({money(pl.cogs)})</td></tr>
              <tr className="tr-bold tr-border-top"><td>Ganancia bruta</td><td className="td-right">{money(pl.grossProfit)}</td></tr>
              <tr><td style={{ paddingLeft: 16, fontSize: 12, color: '#64748b' }}>Margen bruto</td><td className="td-right" style={{ fontSize: 12, color: '#64748b' }}>{pl.grossMargin}%</td></tr>
              <tr className="tr-sub"><td>Gastos operativos</td><td className="td-right text-red">({money(pl.expenses)})</td></tr>
              <tr className="tr-bold tr-border-top tr-highlight"><td>Ganancia neta</td><td className="td-right">{money(pl.netProfit)}</td></tr>
              <tr><td style={{ paddingLeft: 16, fontSize: 12, color: '#64748b' }}>Margen neto</td><td className="td-right" style={{ fontSize: 12, color: '#64748b' }}>{pl.netMargin}%</td></tr>
            </tbody>
          </table>
        </Section>
      </Two>
    </div>
  );
}

function VendorDashboard({ dash, state, navigate }) {
  const activeRouteName = dash.activeRoute?.name || 'Sin ruta activa';
  const truckName = dash.truck ? `${dash.truck.code} - ${dash.truck.plate}` : 'Sin camion asignado';

  return (
    <div>
      <Section title="Acciones principales">
        <div className="vendor-hero-actions">
          <button className="vendor-hero-btn vendor-hero-btn-sale" onClick={() => navigate('sales')}>
            <span className="vendor-hero-icon"><Receipt size={28} /></span>
            <span className="vendor-hero-copy">
              <strong>Nueva venta</strong>
              <small>Facturar desde tu ruta activa y descontar inventario del camion</small>
            </span>
          </button>

          <button className="vendor-hero-btn vendor-hero-btn-expense" onClick={() => navigate('expenses')}>
            <span className="vendor-hero-icon"><DollarSign size={28} /></span>
            <span className="vendor-hero-copy">
              <strong>Registrar gasto</strong>
              <small>Combustible, comida, peajes y gastos operativos de la ruta</small>
            </span>
          </button>
        </div>

        <div className="vendor-secondary-actions">
          <button className="btn btn-ghost" onClick={() => navigate('receivables')}>Ver cuentas por cobrar</button>
          <button className="btn btn-ghost" onClick={() => navigate('reports')}>Imprimir ventas</button>
          <button className="btn btn-ghost" onClick={() => navigate('inventory')}>Imprimir inventario</button>
        </div>
      </Section>

      <Grid cols={4}>
        <Card label="Ruta activa" value={activeRouteName} sub={dash.activeRoute?.status || 'Sin ruta'} icon={Route} color="blue" />
        <Card label="Camion" value={truckName} sub={dash.truck?.status || 'No asignado'} icon={Truck} color="amber" />
        <Card label="Huevos cargados" value={dash.loadedUnits.toLocaleString()} sub="Inventario subido al camion" icon={Boxes} color="orange" />
        <Card label="Huevos vendidos" value={dash.soldUnits.toLocaleString()} sub={`${dash.salesCount} venta(s)`} icon={Receipt} color="green" />
        <Card label="Huevos disponibles" value={dash.availableUnits.toLocaleString()} sub="Restante en ruta" icon={Boxes} color="blue" />
        <Card label="Ventas de la ruta" value={money(dash.totalSales)} sub="Facturacion acumulada" icon={Wallet} color="green" />
        <Card label="Gastos registrados" value={money(dash.totalExpenses)} sub={`${dash.expensesCount} gasto(s)`} icon={DollarSign} color="red" />
        <Card label="Rutas asignadas" value={dash.routeCount} sub="Solo tus rutas" icon={Route} color="purple" />
        <Card label="Efectivo" value={money(dash.totalCash)} sub="Cobrado en mano" icon={Wallet} color="amber" />
        <Card label="Transferencia" value={money(dash.totalTransfer)} sub="Cobrado por banco" icon={BarChart3} color="blue" />
        <Card label="Credito" value={money(dash.totalCredit)} sub="Pendiente de cobro" icon={FileText} color="orange" />
      </Grid>

      <Two>
        <Section title="Inventario cargado por tipo">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Cargado</th><th>Vendido</th><th>Disponible</th><th>P. unidad</th></tr>
              </thead>
              <tbody>
                {dash.stockByType.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.loadedUnits.toLocaleString()}</td>
                    <td>{item.soldUnits.toLocaleString()}</td>
                    <td>{item.stockUnits.toLocaleString()}</td>
                    <td>{money(item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Clientes visibles en tu operacion">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Ruta</th><th>Estado</th><th>Balance</th></tr>
              </thead>
              <tbody>
                {state.clients.map(client => {
                  const route = state.routes.find(item => item.id === client.routeId);
                  return (
                    <tr key={client.id}>
                      <td><strong>{client.name}</strong></td>
                      <td>{route?.name || '-'}</td>
                      <td>{client.status}</td>
                      <td>{money(client.balance || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </Two>
    </div>
  );
}
