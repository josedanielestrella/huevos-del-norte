export const EGG_PER_CARTON = 30;

export const money = n =>
  `RD$ ${Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const toCartons = units => ({
  cartons: Math.floor(units / EGG_PER_CARTON),
  rest: units % EGG_PER_CARTON,
  decimal: (units / EGG_PER_CARTON).toFixed(2),
});

export const fmtDate = s => s ? new Date(s).toLocaleDateString('es-DO') : '—';

export const fmtDateTime = s =>
  s ? new Date(s).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const pct = (part, total) =>
  total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '0%';
