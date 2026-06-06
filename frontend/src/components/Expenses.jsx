import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Section, Two, Input, Select, Form } from './ui.jsx';
import { money, fmtDateTime } from '../utils/money.js';

const CATEGORIES = ['Combustible', 'Comida', 'Peajes', 'Reparaciones', 'Mantenimiento', 'Imprevistos', 'Otros'];
const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#ec4899', '#94a3b8'];

export default function Expenses({ state, submit }) {
  const isAdmin = state.currentUser?.role === 'admin';
  const routeOptions = state.routes;
  const defaultRoute = routeOptions.find(route => route.status === 'En proceso')?.id || routeOptions[0]?.id || '';
  const [tab, setTab] = useState('lista');
  const [form, setForm] = useState({
    category: 'Combustible',
    description: '',
    amount: '',
    routeId: defaultRoute,
    truckId: routeOptions.find(route => route.id === defaultRoute)?.truckId || '',
    seller: state.currentUser?.displayName || '',
    date: '',
  });

  const setField = key => value => setForm(current => {
    if (key === 'routeId') {
      const route = state.routes.find(item => item.id === value);
      return { ...current, routeId: value, truckId: route?.truckId || '', seller: current.seller || state.currentUser?.displayName || '' };
    }
    return { ...current, [key]: value };
  });

  const totalExpenses = state.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const byCategory = useMemo(() => CATEGORIES
    .map(category => ({
      category,
      total: state.expenses.filter(expense => expense.category === category).reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .filter(item => item.total > 0), [state.expenses]);

  const byDay = useMemo(() => Object.entries(
    state.expenses.reduce((accumulator, expense) => {
      const day = expense.date.slice(0, 10);
      accumulator[day] = (accumulator[day] || 0) + expense.amount;
      return accumulator;
    }, {}),
  ).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)).slice(-14), [state.expenses]);

  const handleSave = () => {
    submit('/expenses', {
      ...form,
      amount: Number(form.amount),
      seller: isAdmin ? form.seller : state.currentUser?.displayName,
    });
    setForm({
      category: 'Combustible',
      description: '',
      amount: '',
      routeId: defaultRoute,
      truckId: routeOptions.find(route => route.id === defaultRoute)?.truckId || '',
      seller: state.currentUser?.displayName || '',
      date: '',
    });
    setTab('lista');
  };

  return (
    <div>
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'lista' ? ' tab-active' : ''}`} onClick={() => setTab('lista')}>Lista de gastos</button>
        <button className={`tab-btn${tab === 'nuevo' ? ' tab-active' : ''}`} onClick={() => setTab('nuevo')}>+ Nuevo gasto</button>
        <button className={`tab-btn${tab === 'analisis' ? ' tab-active' : ''}`} onClick={() => setTab('analisis')}>Analisis</button>
      </div>

      {tab === 'nuevo' && (
        <Two>
          <Section title="Registrar gasto de ruta">
            <Form onSubmit={handleSave}>
              <Select label="Categoria *" value={form.category} onChange={setField('category')} options={CATEGORIES} />
              <Input label="Descripcion" value={form.description} onChange={setField('description')} placeholder="Detalle del gasto" />
              <Input label="Monto *" type="number" step="0.01" min="0" value={form.amount} onChange={setField('amount')} required />
              <Input label="Fecha y hora" type="datetime-local" value={form.date} onChange={setField('date')} />
              <Select label="Ruta" value={form.routeId} onChange={setField('routeId')} options={routeOptions.map(route => [route.id, `${route.name} - ${route.status}`])} />
              <Select label="Camion" value={form.truckId} onChange={setField('truckId')} options={[['', '- Sin camion -'], ...state.trucks.map(truck => [truck.id, `${truck.code} - ${truck.plate}`])]} />
              {isAdmin && <Input label="Vendedor / responsable" value={form.seller} onChange={setField('seller')} />}
              <button type="submit" className="btn btn-primary btn-lg">Registrar gasto</button>
            </Form>
          </Section>

          <Section title="Gastos recientes">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Categoria</th><th>Descripcion</th><th>Monto</th></tr></thead>
                <tbody>
                  {state.expenses.slice(0, 10).map(expense => (
                    <tr key={expense.id}>
                      <td><span className="badge badge-yellow">{expense.category}</span></td>
                      <td>{expense.description}</td>
                      <td style={{ fontWeight: 600 }}>{money(expense.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </Two>
      )}

      {tab === 'lista' && (
        <Section title={`Gastos registrados - Total: ${money(totalExpenses)}`}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Categoria</th><th>Descripcion</th><th>Monto</th><th>Ruta</th><th>Camion</th><th>Responsable</th></tr>
              </thead>
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

      {tab === 'analisis' && (
        <div>
          <Two>
            <Section title="Gastos por categoria">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {byCategory.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={value => money(value)} />
                </PieChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Gastos por dia">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byDay}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={date => date.slice(5)} />
                  <YAxis tickFormatter={value => `${(value / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={value => money(value)} />
                  <Bar dataKey="total" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </Two>
        </div>
      )}
    </div>
  );
}
