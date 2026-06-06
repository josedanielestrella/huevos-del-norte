import React from 'react';
import {
  Home, Boxes, ShoppingCart, Users, Truck, Receipt,
  DollarSign, FileText, BarChart3, Settings,
  Building2, Route, CreditCard, Wifi, ShieldCheck,
} from 'lucide-react';
import AppShell from './AppShell.jsx';

const MENU = [
  { id: 'dashboard', label: 'Dashboard', Icon: Home, group: 'Principal' },
  { id: 'users', label: 'Usuarios', Icon: ShieldCheck, group: 'Principal' },
  { id: 'inventory', label: 'Inventario', Icon: Boxes, group: 'Principal' },
  { id: 'purchases', label: 'Compras', Icon: ShoppingCart, group: 'Principal' },
  { id: 'suppliers', label: 'Proveedores', Icon: Building2, group: 'Principal' },
  { id: 'sales', label: 'Ventas', Icon: Receipt, group: 'Ventas' },
  { id: 'clients', label: 'Clientes', Icon: Users, group: 'Ventas' },
  { id: 'routes', label: 'Rutas', Icon: Route, group: 'Logistica' },
  { id: 'trucks', label: 'Camiones', Icon: Truck, group: 'Logistica' },
  { id: 'expenses', label: 'Gastos', Icon: DollarSign, group: 'Finanzas' },
  { id: 'receivables', label: 'CxC', Icon: FileText, group: 'Finanzas' },
  { id: 'payables', label: 'CxP', Icon: CreditCard, group: 'Finanzas' },
  { id: 'reports', label: 'Reportes', Icon: BarChart3, group: 'Sistema' },
  { id: 'settings', label: 'Configuracion', Icon: Settings, group: 'Sistema' },
  { id: 'sync', label: 'Sincronizacion', Icon: Wifi, group: 'Sistema' },
];

const GROUPS = ['Principal', 'Ventas', 'Logistica', 'Finanzas', 'Sistema'];

export default function AdminLayout(props) {
  const current = MENU.find(item => item.id === props.page);
  return (
    <AppShell
      menu={MENU}
      groups={GROUPS}
      page={props.page}
      setPage={props.setPage}
      currentLabel={current?.label || 'Dashboard'}
      subtitle={`${props.session.user?.displayName} · Administrador`}
      online={props.online}
      pending={props.pending}
      onRefresh={props.onRefresh}
      onLogout={props.onLogout}
      toast={props.toast}
    >
      {props.children}
    </AppShell>
  );
}
