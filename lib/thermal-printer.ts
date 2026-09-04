import { Socket } from 'net';
import iconv from 'iconv-lite';

const ESC = 0x1b;
const GS = 0x1d;
const LINE_WIDTH = 32;

// PC850 (Multilingual) covers Spanish accents/ñ and is supported by virtually
// every ESC/POS-compatible printer, including generic clones.
const CODEPAGE = 'cp850';
const CODEPAGE_TABLE_INDEX = 2;

function text(value = '') {
  return iconv.encode(`${value}\n`, CODEPAGE);
}

function selectCodepage() {
  return Buffer.from([ESC, 0x74, CODEPAGE_TABLE_INDEX]);
}

function align(mode: 'left' | 'center') {
  return Buffer.from([ESC, 0x61, mode === 'center' ? 0x01 : 0x00]);
}

function bold(on: boolean) {
  return Buffer.from([ESC, 0x45, on ? 1 : 0]);
}

function charSize(heightMultiplier: number, widthMultiplier: number) {
  const n = ((widthMultiplier - 1) << 4) | (heightMultiplier - 1);
  return Buffer.from([GS, 0x21, n]);
}

// GS V 65 n — feed n lines then perform a full cut, as a single atomic
// command. This is more reliable than sending a separate "feed n lines"
// command followed by a plain cut: some cheap ESC/POS clones don't fully
// finish the feed motor movement before starting the cut when those are
// two discrete commands, which cuts through the last printed line(s).
function cut(feedLines = 4) {
  return Buffer.from([GS, 0x56, 0x41, feedLines]);
}

function init() {
  return Buffer.concat([Buffer.from([ESC, 0x40]), selectCodepage()]);
}

function padRight(value: string, width: number) {
  return value.length >= width ? value.slice(0, width) : value + ' '.repeat(width - value.length);
}

function padLeft(value: string, width: number) {
  return value.length >= width ? value.slice(0, width) : ' '.repeat(width - value.length) + value;
}

function twoColumns(left: string, right: string) {
  if (left.length + right.length + 1 <= LINE_WIDTH) {
    return `${padRight(left, LINE_WIDTH - right.length)}${right}`;
  }
  return `${left}\n${padLeft(right, LINE_WIDTH)}`;
}

const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function formatLongDateEs(businessDate: string) {
  const [year, month, day] = businessDate.split('-').map(Number);
  const mes = MESES_ES[month - 1] ?? businessDate;
  return `${day} ${mes} ${year}`;
}

// The material name gets its own full-width line (so long names never get
// truncated); only Lb / Precio-lb / Total share the aligned columns below it.
// Widths sum to LINE_WIDTH: Lb(6) + gap(1) + Precio/lb(11) + gap(1) + Total(13) = 32
const ITEM_COL_LB = 6;
const ITEM_COL_PRECIO = 11;
const ITEM_COL_TOTAL = 13;

function itemNumbersRow(lb: string, precio: string, total: string) {
  return [padRight(lb, ITEM_COL_LB), padLeft(precio, ITEM_COL_PRECIO), padLeft(total, ITEM_COL_TOTAL)].join(' ');
}

export type TicketData = {
  company: { nombre: string; rtn: string; telefono: string; direccion: string };
  businessDate: string;
  clientNombre: string;
  items: Array<{ materialNombre: string; libras: number; precioPorLibra: number; total: number }>;
  total: number;
};

export function buildTicketBuffer(data: TicketData): Buffer {
  const dash = '-'.repeat(LINE_WIDTH);
  const doubleDash = '='.repeat(LINE_WIDTH);
  const chunks: Buffer[] = [init(), align('center'), bold(true), charSize(2, 1), text(data.company.nombre || 'R-CONTROL'), bold(false)];
    chunks.push(charSize(1, 1));
  chunks.push(text('Comprobante de Compra'));
  if (data.company.rtn) chunks.push(text(`RTN: ${data.company.rtn}`));
  if (data.company.telefono) chunks.push(text(`Tel: ${data.company.telefono}`));
  if (data.company.direccion) chunks.push(text(data.company.direccion));
  chunks.push(charSize(1, 1));

  chunks.push(text(dash));
  // Padded to the full line width so centered alignment has no room to shift
  // them — they land flush at the start of the line without switching modes.
  chunks.push(text(padRight(`Fecha: ${formatLongDateEs(data.businessDate)}`, LINE_WIDTH)));
  chunks.push(text(padRight(`Cliente: ${data.clientNombre}`, LINE_WIDTH)));
  chunks.push(text(dash));

  chunks.push(text(itemNumbersRow('Lb', 'P/Lb', 'Total')));
  chunks.push(text(doubleDash));
  data.items.forEach((item, index) => {
    chunks.push(text(item.materialNombre));
    chunks.push(
      text(itemNumbersRow(item.libras.toFixed(2), `L${item.precioPorLibra.toFixed(2)}`, `L${item.total.toFixed(2)}`)),
    );
    if (index < data.items.length - 1) chunks.push(text());
  });

  chunks.push(text(dash));
  chunks.push(align('center'));
  chunks.push(bold(true));
  chunks.push(charSize(2, 1));
  chunks.push(text(`TOTAL: L ${data.total.toFixed(2)}`));
  chunks.push(charSize(1, 1));
  chunks.push(bold(false));

  chunks.push(text(doubleDash));
  chunks.push(text('¡Gracias por su visita!'));
  chunks.push(align('center'));
  chunks.push(cut(4));

  return Buffer.concat(chunks);
}

export type SummaryData = {
  company: { nombre: string; rtn: string; telefono: string; direccion: string };
  businessDate: string;
  materials: Array<{ materialNombre: string; libras: number; total: number }>;
  totalCompras: number;
  totalVentas: number;
  totalGastos: number;
  saldoInicial: number;
  saldoActual: number;
};

export function buildSummaryBuffer(data: SummaryData): Buffer {
  const dash = '-'.repeat(LINE_WIDTH);
  const chunks: Buffer[] = [init(), align('center'), bold(true), text(data.company.nombre || 'R-CONTROL'), bold(false)];

  chunks.push(text('Resumen del Dia'));
  if (data.company.rtn) chunks.push(text(`RTN: ${data.company.rtn}`));
  if (data.company.telefono) chunks.push(text(`Tel: ${data.company.telefono}`));
  if (data.company.direccion) chunks.push(text(data.company.direccion));

  chunks.push(align('left'));
  chunks.push(text(dash));
  chunks.push(text(`Fecha: ${formatLongDateEs(data.businessDate)}`));
  chunks.push(text(dash));

  chunks.push(bold(true));
  chunks.push(text('COMPRAS POR MATERIAL'));
  chunks.push(bold(false));
  if (data.materials.length === 0) {
    chunks.push(text('Sin compras registradas'));
  }
  for (const item of data.materials) {
    chunks.push(text(item.materialNombre));
    chunks.push(text(twoColumns(`${item.libras.toFixed(2)} lb`, `L ${item.total.toFixed(2)}`)));
  }

  chunks.push(text(dash));
  chunks.push(text(twoColumns('Total Compras:', `L ${data.totalCompras.toFixed(2)}`)));
  chunks.push(text(twoColumns('Total Ventas:', `L ${data.totalVentas.toFixed(2)}`)));
  chunks.push(text(twoColumns('Total Gastos:', `L ${data.totalGastos.toFixed(2)}`)));
  chunks.push(text(dash));
  chunks.push(text(twoColumns('Saldo inicial:', `L ${data.saldoInicial.toFixed(2)}`)));

  chunks.push(align('center'));
  chunks.push(bold(true));
  chunks.push(charSize(2, 1));
  chunks.push(text(`CIERRE EST. CAJA: L ${data.saldoActual.toFixed(2)}`));
  chunks.push(charSize(1, 1));
  chunks.push(bold(false));

  chunks.push(cut(4));

  return Buffer.concat(chunks);
}

export function sendToPrinter(ip: string, port: number, buffer: Buffer, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.once('timeout', () => finish(new Error(`Tiempo de espera agotado conectando a la impresora ${ip}:${port}`)));
    socket.once('error', (err) => finish(new Error(`No se pudo conectar a la impresora (${ip}:${port}): ${err.message}`)));

    socket.connect(port, ip, () => {
      socket.write(buffer, (err) => {
        if (err) finish(new Error(`Error enviando datos a la impresora: ${err.message}`));
        else finish();
      });
    });
  });
}
