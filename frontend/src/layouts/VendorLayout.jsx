import React from 'react';
import {
  Home, Boxes, Users, Receipt, DollarSign, Route, BarChart3, Wifi, FileText,
} from 'lucide-react';
import AppShell from './AppShell.jsx';

const MENU = [
  { id: 'dashboard', label: 'Mi ruta', Icon: Home, group: 'Principal' },
  { id: 'sales', label: 'Vender', Icon: Receipt, group: 'Principal' },
  { id: 'expenses', label: 'Gastos', Icon: DollarSign, group: 'Principal' },
  { id: 'receivables', label: 'CxC', Icon: FileText, group: 'Principal' },
  { id: 'inventory', label: 'Inventario', Icon: Boxes, group: 'Principal' },
  { id: 'clients', label: 'Clientes', Icon: Users, group: 'Principal' },
  { id: 'routes', label: 'Rutas', Icon: Route, group: 'Principal' },
  { id: 'reports', label: 'Reportes', Icon: BarChart3, group: 'Principal' },
  { id: 'sync', label: 'Sincronizacion', Icon: Wifi, group: 'Sistema' },
];

const GROUPS = ['Principal', 'Sistema'];

export default function VendorLayout(props) {
  const current = MENU.find(item => item.id === props.page);
  return (
    <AppShell
      menu={MENU}
      groups={GROUPS}
      page={props.page}
      setPage={props.setPage}
      currentLabel={current?.label || 'Mi ruta'}
      subtitle={`${props.session.user?.displayName} · Vendedor`}
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
