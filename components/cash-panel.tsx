'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CashMovementTipo, LedgerDTO } from '@/types/domain';
import { errorMessage, parseApiResponse } from '@/lib/api-client';
import { useRoleGuard } from '@/lib/use-role-guard';
import { useToast } from '@/components/toast';

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDateString() {
  return toDateString(new Date());
}

function addDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return toDateString(new Date(year, month - 1, day + days));
}

function money(value: number) {
  return `L ${value.toFixed(2)}`;
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
}

const TIPO_LABEL: Record<CashMovementTipo, string> = {
  ingreso: 'Ingreso a caja',
  salida: 'Salida de efectivo',
};

export default function CashPanel() {
  const roleGuardStatus = useRoleGuard((role) => role === 'admin');
  const toast = useToast();
  const [businessDate, setBusinessDate] = useState(todayDateString());
  const [ledger, setLedger] = useState<LedgerDTO | null>(null);
  const [loading, setLoading] = useState(false);

  const [saldoInicial, setSaldoInicial] = useState('');
  const [tipo, setTipo] = useState<CashMovementTipo>('ingreso');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');

  const run = useCallback(
    async (action: () => Promise<void>, errorTitle: string, successMessage?: string) => {
      try {
        setLoading(true);
        await action();
        if (successMessage) toast.success(successMessage);
      } catch (err) {
        toast.error(errorMessage(err), errorTitle);
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const fetchLedger = useCallback(async () => {
    const data = await fetch(`/api/ledger?businessDate=${businessDate}`, { cache: 'no-store' }).then((res) =>
      parseApiResponse<LedgerDTO>(res),
    );
    setLedger(data);
    setSaldoInicial(data.balance.saldoInicial.toFixed(2));
  }, [businessDate]);

  useEffect(() => {
    if (roleGuardStatus !== 'allowed') return;
    void run(fetchLedger, 'No se pudo cargar la caja');
  }, [roleGuardStatus, run, fetchLedger]);

  async function send(url: string, method: string, body?: unknown) {
    return fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then((res) => parseApiResponse(res));
  }

  function saveSaldoInicial(event: React.FormEvent) {
    event.preventDefault();
    void run(
      async () => {
        await send('/api/ledger/initial-balance', 'POST', { businessDate, saldoInicial: Number(saldoInicial) });
        await fetchLedger();
      },
      'No se pudo guardar el inicio de caja',
      'Inicio de caja guardado',
    );
  }

  function createMovement(event: React.FormEvent) {
    event.preventDefault();
    void run(
      async () => {
        await send('/api/cash-movements', 'POST', { businessDate, tipo, concepto, monto: Number(monto) });
        setConcepto('');
        setMonto('');
        await fetchLedger();
      },
      'No se pudo registrar el movimiento',
      tipo === 'ingreso' ? 'Ingreso registrado' : 'Salida registrada',
    );
  }

  function removeMovement(id: string) {
    if (!window.confirm('¿Eliminar este movimiento de caja?')) return;
    void run(
      async () => {
        await send(`/api/cash-movements/${id}`, 'DELETE');
        await fetchLedger();
      },
      'No se pudo eliminar el movimiento',
      'Movimiento eliminado',
    );
  }

  if (roleGuardStatus !== 'allowed') {
    return (
      <main className="page-shell">
        <p className="status-line">Verificando permisos…</p>
      </main>
    );
  }

  const totals = ledger?.totals;
  const summary: Array<{ label: string; value: number; sign: '+' | '−' | '' }> = [
    { label: 'Inicio de caja', value: ledger?.balance.saldoInicial ?? 0, sign: '' },
    { label: 'Ventas', value: totals?.totalVentas ?? 0, sign: '+' },
    { label: 'Ingresos a caja', value: totals?.totalIngresos ?? 0, sign: '+' },
    { label: 'Compras', value: totals?.totalCompras ?? 0, sign: '−' },
    { label: 'Gastos', value: totals?.totalGastos ?? 0, sign: '−' },
    { label: 'Salidas de efectivo', value: totals?.totalSalidas ?? 0, sign: '−' },
  ];

  return (
    <main className="page-shell">
      <section className="hero">
        <h1>Caja</h1>
        <p>Inicio de caja, ingresos y salidas de efectivo del día.</p>
      </section>

      <section className="card-grid">
        <article className="card wide">
          <div className="card-head">
            <label className="inline-field">
              Fecha de negocio
              <input type="date" value={businessDate} onChange={(e) => e.target.value && setBusinessDate(e.target.value)} />
            </label>
            <div className="card-actions">
              <button type="button" className="btn-secondary" onClick={() => setBusinessDate(addDays(businessDate, -1))}>
                ← Día anterior
              </button>
              <button type="button" className="btn-secondary" onClick={() => setBusinessDate(todayDateString())}>
                Hoy
              </button>
              <button type="button" className="btn-secondary" onClick={() => setBusinessDate(addDays(businessDate, 1))}>
                Día siguiente →
              </button>
            </div>
          </div>
        </article>

        <article className="card half">
          <h3>Inicio de caja</h3>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            Efectivo con el que abre la caja el {businessDate}.
          </p>
          <form onSubmit={saveSaldoInicial} className="row" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 8' }}>
              Monto
              <input
                type="number"
                step="0.01"
                min="0"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                required
              />
            </label>
            <div style={{ gridColumn: 'span 4', alignSelf: 'end' }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                Guardar
              </button>
            </div>
          </form>
        </article>

        <article className="card half">
          <h3>Resumen del día</h3>
          <table className="table-like">
            <tbody>
              {summary.map((row) => (
                <tr key={row.label}>
                  <td>
                    {row.sign ? <span className="muted">{row.sign} </span> : null}
                    {row.label}
                  </td>
                  <td className="num">{money(row.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Saldo actual</td>
                <td className="num">{money(totals?.saldoActual ?? 0)}</td>
              </tr>
            </tfoot>
          </table>
        </article>

        <article className="card wide">
          <h3>Registrar movimiento</h3>
          <form onSubmit={createMovement} className="row" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 3' }}>
              Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value as CashMovementTipo)}>
                <option value="ingreso">{TIPO_LABEL.ingreso}</option>
                <option value="salida">{TIPO_LABEL.salida}</option>
              </select>
            </label>
            <label style={{ gridColumn: 'span 5' }}>
              Concepto
              <input
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder={tipo === 'ingreso' ? 'Ej. Aporte del dueño' : 'Ej. Depósito al banco'}
                required
              />
            </label>
            <label style={{ gridColumn: 'span 2' }}>
              Monto
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </label>
            <div style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                Registrar
              </button>
            </div>
          </form>
        </article>

        <article className="card wide">
          <h3>Movimientos del día</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-like">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th className="num">Monto</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {ledger?.cashMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{timeOf(movement.createdAt)}</td>
                    <td>{TIPO_LABEL[movement.tipo]}</td>
                    <td>{movement.concepto}</td>
                    <td
                      className="num"
                      style={{ color: movement.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)' }}
                    >
                      {movement.tipo === 'ingreso' ? '+' : '−'} {money(movement.monto)}
                    </td>
                    <td>
                      <button type="button" className="btn-danger" onClick={() => removeMovement(movement.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {ledger && ledger.cashMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Sin ingresos ni salidas registrados este día.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {loading ? <p className="status-line">Sincronizando…</p> : null}
    </main>
  );
}
