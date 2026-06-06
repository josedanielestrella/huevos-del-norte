const BRAND_LOGO = `
  <svg
    viewBox="0 0 1368 795"
    role="img"
    aria-label="Huevos del Norte Siempre fresco"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid meet"
  >
    <rect width="1368" height="795" fill="#ffffff" />

    <g fill="#f9b233" font-family="'Cooper Black', 'Arial Black', Georgia, serif" font-weight="900" letter-spacing="-8">
      <text x="10" y="250" font-size="300">Huevos</text>
    </g>

    <g fill="#f9b233" font-family="'Cooper Black', 'Arial Black', Georgia, serif" font-weight="900" letter-spacing="-4">
      <text x="460" y="390" font-size="170">del</text>
    </g>

    <g fill="#e36b19" font-family="'Cooper Black', 'Arial Black', Georgia, serif" font-weight="900" letter-spacing="-10">
      <text x="85" y="635" font-size="430">Norte</text>
    </g>

    <g transform="translate(918 214)">
      <path
        d="M0 213 C52 192, 89 148, 132 108 C183 61, 238 34, 293 35 C352 36, 396 70, 410 126 C423 176, 411 233, 394 260 C373 241, 347 223, 309 218 C252 211, 198 225, 155 253 C116 279, 84 319, 56 357 C15 333, -5 279, 0 213 Z"
        fill="#e36b19"
      />
      <path
        d="M190 0 C165 5, 150 30, 151 60 C162 88, 179 111, 203 127 C211 93, 226 66, 251 43 C237 14, 216 -4, 190 0 Z"
        fill="#205f1d"
      />
      <path
        d="M252 0 C225 11, 210 39, 214 73 C229 101, 250 120, 277 131 C282 95, 298 66, 324 42 C309 12, 283 -4, 252 0 Z"
        fill="#205f1d"
      />
      <path
        d="M318 29 C347 37, 369 58, 380 88 C386 119, 380 148, 367 173 C344 142, 316 118, 279 105 C284 72, 296 47, 318 29 Z"
        fill="#205f1d"
      />
      <circle cx="210" cy="273" r="19" fill="#205f1d" />
    </g>

    <text
      x="320"
      y="750"
      fill="#205f1d"
      font-size="122"
      font-family="'Brush Script MT', 'Segoe Script', cursive"
    >
      Siempre fresco
    </text>
  </svg>
`;

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #111; font-size: 13px; padding: 24px; }
  h1 { font-size: 22px; }
  h2 { font-size: 16px; margin: 18px 0 8px; }
  p { line-height: 1.6; }
  .header { display: flex; justify-content: space-between; gap: 18px; padding-bottom: 14px; border-bottom: 2px solid #111; margin-bottom: 20px; }
  .brand-col { flex: 1; min-width: 0; }
  .brand-logo { width: 260px; max-width: 100%; margin-bottom: 10px; }
  .brand-logo svg { display: block; width: 100%; height: auto; }
  .company-info { font-size: 12px; color: #555; line-height: 1.6; }
  .invoice-meta { width: 260px; text-align: right; font-size: 12px; }
  .invoice-meta strong { font-size: 18px; display: block; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #f5f5f5; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; border: 1px solid #ddd; }
  td { padding: 8px; border: 1px solid #ddd; vertical-align: top; }
  .text-right { text-align: right; }
  .total-section { margin-top: 16px; display: flex; justify-content: flex-end; }
  .total-box { width: 260px; }
  .total-box tr td:first-child { color: #555; }
  .total-box tr td:last-child { text-align: right; font-weight: bold; }
  .total-box .grand-total td { font-size: 16px; border-top: 2px solid #111; padding-top: 8px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; }
  .badge-pagada, .badge-pagado { background: #dcfce7; color: #166534; }
  .badge-pendiente { background: #fef3c7; color: #92400e; }
  .badge-parcial { background: #dbeafe; color: #1e40af; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #666; text-align: center; }
  .no-print { display: none !important; }
  @media print {
    body { padding: 8px; }
  }
`;

export function printWindow(title, html) {
  const printWindowRef = window.open('', '_blank', 'width=900,height=700');
  if (!printWindowRef) {
    window.alert('No se pudo abrir la ventana de impresion. Revisa el bloqueo de ventanas emergentes.');
    return;
  }

  printWindowRef.document.write(`<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"><title>${title}</title>
    <style>${BASE_CSS}</style>
  </head><body>
    ${html}
    <div class="footer">Generado el ${new Date().toLocaleString('es-DO')} - Huevos del Norte</div>
    <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`);
  printWindowRef.document.close();
}

export function printInvoice(invoice, state) {
  const company = state.company || {};
  const client = state.clients.find(item => item.id === invoice.clientId);
  const route = state.routes.find(item => item.id === invoice.routeId);
  const eggName = id => state.eggTypes.find(item => item.id === id)?.name || id;
  const formatMoney = value => `RD$ ${Number(value || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  const status = invoice.status || 'pendiente';
  const paymentMethod = invoice.paymentMethod || '-';
  const sellerLabel = invoice.sellerId || invoice.sellerEmployeeId || invoice.sellerUserId || '-';

  const rows = invoice.items.map(item => `
    <tr>
      <td>${eggName(item.eggTypeId)}</td>
      <td>${item.mode === 'carton' ? `${item.quantity} cartones` : `${item.totalUnits} unidades`}</td>
      <td>${formatMoney(item.mode === 'carton' ? item.cartonPrice : item.unitPrice)}</td>
      <td class="text-right">${formatMoney(item.subtotal)}</td>
    </tr>
  `).join('');

  const html = `
    <div class="header">
      <div class="brand-col">
        <div class="brand-logo">${BRAND_LOGO}</div>
        <div class="company-info">
          ${company.address || ''}<br>
          Tel: ${company.phone || '-'}<br>
          RNC: ${company.rnc || 'N/A'}
        </div>
      </div>
      <div class="invoice-meta">
        <strong>${invoice.number}</strong>
        Fecha: ${new Date(invoice.date).toLocaleString('es-DO')}<br>
        Estado: <span class="badge badge-${status}">${status}</span><br>
        ${route ? `Ruta: ${route.name}<br>` : ''}
        Vendedor: ${sellerLabel}
      </div>
    </div>

    <h2>Cliente</h2>
    <p><strong>${invoice.clientName}</strong>${client?.phone ? ` - Tel: ${client.phone}` : ''}</p>
    ${client?.address ? `<p>${client.address}</p>` : ''}

    <h2>Productos</h2>
    <table>
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Cantidad</th>
          <th>Precio</th>
          <th class="text-right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="total-section">
      <table class="total-box">
        <tr><td>Subtotal</td><td>${formatMoney(invoice.subtotal)}</td></tr>
        ${invoice.tax > 0 ? `<tr><td>ITBIS</td><td>${formatMoney(invoice.tax)}</td></tr>` : ''}
        <tr class="grand-total"><td>Total</td><td>${formatMoney(invoice.total)}</td></tr>
        <tr><td>Pagado</td><td>${formatMoney(invoice.paid)}</td></tr>
        <tr><td>Pendiente</td><td>${formatMoney(invoice.total - invoice.paid)}</td></tr>
      </table>
    </div>

    <p style="margin-top:16px;font-size:12px;">Metodo de pago: <strong>${paymentMethod}</strong></p>
  `;

  printWindow(invoice.number, html);
}

export function printReport(title, tableHTML) {
  printWindow(title, `<h1>${title}</h1>${tableHTML}`);
}
