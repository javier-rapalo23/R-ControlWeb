'use client';

const TICKET_STYLES = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:12px;padding:20px;max-width:320px;margin:auto}
  h1{text-align:center;font-size:15px;letter-spacing:2px;margin-bottom:2px}
  .sub{text-align:center;font-size:11px;color:#555;margin-bottom:8px}
  .dash{border:none;border-top:1px dashed #000;margin:8px 0}
  p{margin:2px 0;font-size:12px}
  table{width:100%;border-collapse:collapse;margin:6px 0}
  th{font-size:10px;padding-bottom:3px;border-bottom:1px solid #000}
  td{font-size:11px;padding:2px 0}
  .r{text-align:right}
  th.r{text-align:right}
  .total{font-size:14px;font-weight:bold;text-align:right;margin-top:6px}
  .footer{text-align:center;font-size:11px;margin-top:14px;color:#555}
  @media print{body{padding:0}}
`;

function openPrintWindow(title: string, bodyHtml: string) {
  const win = window.open('', '_blank', 'width=420,height=650');
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>${TICKET_STYLES}</style>
</head>
<body>
  ${bodyHtml}
  <script>window.onload=function(){window.print();window.close()}<\/script>
</body>
</html>`);
  win.document.close();
}

export type BrowserTicketData = {
  company: { nombre: string; rtn?: string | null; telefono?: string | null; direccion?: string | null };
  businessDate: string;
  clientNombre: string;
  items: Array<{ materialNombre: string; libras: number; precioPorLibra: number; total: number }>;
  total: number;
};

export function printTicketInBrowser(data: BrowserTicketData) {
  const rows = data.items
    .map(
      (item) => `
      <tr>
        <td>${item.materialNombre}</td>
        <td class="r">${item.libras.toFixed(2)}</td>
        <td class="r">L ${item.precioPorLibra.toFixed(2)}</td>
        <td class="r">L ${item.total.toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  const body = `
    <h1>${data.company.nombre || 'R-CONTROL'}</h1>
    <p class="sub">Comprobante de Compra</p>
    ${data.company.rtn ? `<p class="sub">RTN: ${data.company.rtn}</p>` : ''}
    ${data.company.telefono ? `<p class="sub">Tel: ${data.company.telefono}</p>` : ''}
    ${data.company.direccion ? `<p class="sub">${data.company.direccion}</p>` : ''}
    <hr class="dash"/>
    <p>Fecha: ${data.businessDate}</p>
    <p>Cliente: ${data.clientNombre}</p>
    <hr class="dash"/>
    <table>
      <thead>
        <tr>
          <th>Material</th>
          <th class="r">Lb</th>
          <th class="r">L/lb</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <hr class="dash"/>
    <p class="total">TOTAL: L ${data.total.toFixed(2)}</p>
    <p class="footer">— Gracias por su visita —</p>
  `;

  openPrintWindow('Ticket', body);
}

export type BrowserSummaryData = {
  companyNombre: string;
  businessDate: string;
  materials: Array<{ materialNombre: string; libras: number; total: number }>;
  totalCompras: number;
  totalVentas: number;
  totalGastos: number;
  saldoInicial: number;
  saldoActual: number;
};

export function printSummaryInBrowser(data: BrowserSummaryData) {
  const rows = data.materials
    .map(
      (item) => `
      <tr>
        <td>${item.materialNombre}</td>
        <td class="r">${item.libras.toFixed(2)}</td>
        <td class="r">L ${item.total.toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  const body = `
    <h1>${data.companyNombre || 'R-CONTROL'}</h1>
    <p class="sub">Resumen del Día</p>
    <hr class="dash"/>
    <p>Fecha: ${data.businessDate}</p>
    <hr class="dash"/>
    <table>
      <thead>
        <tr>
          <th>Material</th>
          <th class="r">Lb</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="3">Sin compras registradas</td></tr>'}</tbody>
    </table>
    <hr class="dash"/>
    <p>Total Compras: <span class="r">L ${data.totalCompras.toFixed(2)}</span></p>
    <p>Total Ventas: <span class="r">L ${data.totalVentas.toFixed(2)}</span></p>
    <p>Total Gastos: <span class="r">L ${data.totalGastos.toFixed(2)}</span></p>
    <hr class="dash"/>
    <p>Saldo inicial: L ${data.saldoInicial.toFixed(2)}</p>
    <p class="total">CIERRE EST. CAJA: L ${data.saldoActual.toFixed(2)}</p>
  `;

  openPrintWindow('Resumen del día', body);
}
