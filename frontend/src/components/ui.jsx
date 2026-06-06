import React from 'react';

export function Card({ label, value, sub, icon: Icon, color = 'amber' }) {
  return (
    <div className={`card card-${color}`}>
      <div className="card-body">
        <span className="card-label">{label}</span>
        <strong className="card-value">{value}</strong>
        {sub && <small className="card-sub">{sub}</small>}
      </div>
      {Icon && <div className="card-icon"><Icon size={26} /></div>}
    </div>
  );
}

export function Section({ title, children, action, className = '' }) {
  return (
    <section className={`section ${className}`}>
      <div className="section-head">
        <h2>{title}</h2>
        {action && <div className="section-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function Table({ rows, emptyMsg = 'Sin datos.' }) {
  if (!rows?.length) return <p className="muted">{emptyMsg}</p>;
  const keys = Object.keys(rows[0]);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{keys.map(k => <th key={k}>{k}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{keys.map(k => <td key={k}>{r[k]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Form({ children, onSubmit, className = '' }) {
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className={`form ${className}`}>
      {children}
    </form>
  );
}

export function Input({ label, value, onChange, type = 'text', placeholder, required, min, max, step }) {
  return (
    <label className="field">
      {label}
      <input
        type={type} value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        min={min} max={max} step={step}
      />
    </label>
  );
}

export function Select({ label, value, onChange, options, required }) {
  return (
    <label className="field">
      {label}
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} required={required}>
        {options.map(o =>
          Array.isArray(o)
            ? <option key={o[0]} value={o[0]}>{o[1]}</option>
            : <option key={o} value={o}>{o}</option>
        )}
      </select>
    </label>
  );
}

export function Textarea({ label, value, onChange, rows = 3 }) {
  return (
    <label className="field">
      {label}
      <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} rows={rows} />
    </label>
  );
}

export function StatusBadge({ status }) {
  const map = {
    pagada: 'green', pagado: 'green',
    pendiente: 'yellow', parcial: 'blue',
    Abierta: 'yellow', 'En proceso': 'green',
    Cerrada: 'gray', 'En ruta': 'blue',
    Disponible: 'green', Mantenimiento: 'red',
    activo: 'green', inactivo: 'gray',
  };
  return <span className={`badge badge-${map[status] || 'gray'}`}>{status}</span>;
}

export function Grid({ children, cols = 4 }) {
  return <div className={`grid grid-${cols}`}>{children}</div>;
}

export function Two({ children }) {
  return <div className="two">{children}</div>;
}

export function Btn({ children, onClick, variant = 'primary', type = 'button', size = 'md', disabled }) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function InfoBox({ children, color = 'amber' }) {
  return <div className={`info-box info-${color}`}>{children}</div>;
}

export function Row({ children }) {
  return <div className="form-row">{children}</div>;
}
