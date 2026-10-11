'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import type { CompanySettingsDTO, LedgerDTO, MaterialDTO } from '@/types/domain';
import { useRoleGuard } from '@/lib/use-role-guard';
import { usePrintMode } from '@/lib/use-print-mode';
import { printSummaryInBrowser, printWeeklySummaryInBrowser } from '@/lib/print-html';
import { errorMessage, parseApiResponse, PRINTER_TIMEOUT_MESSAGE } from '@/lib/api-client';
import { useToast } from '@/components/toast';
import rControlLogo from '../R-CONTROL.png';

type DailyStockEntry = { businessDate: string; libras: number };
type MaterialStockSummary = { materialId: string; materialNombre: string; totalLibras: number };
type StockResult = {
  data?: {
    materialId?: string;
    totalLibras?: number;
    daily?: DailyStockEntry[];
    materials?: MaterialStockSummary[];
  };
};

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getWeekDays(dateStr: string) {
  const date = parseLocalDate(dateStr);
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { businessDate: formatLocalDate(d), label: WEEKDAY_LABELS[i], dayNumber: d.getDate() };
  });
}

type DayCell = { libras: number; monto: number };
type WeeklyPivotRow = {
  materialNombre: string;
  byDay: Record<string, DayCell>;
  totalLibras: number;
  totalMonto: number;
};
type WeeklyPivot = {
  days: ReturnType<typeof getWeekDays>;
  rows: WeeklyPivotRow[];
  dailyTotals: Record<string, DayCell>;
  grandTotalLibras: number;
  grandTotalMonto: number;
};

function buildWeeklyPivot(
  purchases: Array<{ businessDate: string; materialNombre: string; libras: number; total: number }>,
  days: ReturnType<typeof getWeekDays>,
): WeeklyPivot {
  const byMaterial: Record<string, WeeklyPivotRow> = {};
  const dailyTotals: Record<string, DayCell> = {};
  let grandTotalLibras = 0;
  let grandTotalMonto = 0;

  for (const day of days) {
    dailyTotals[day.businessDate] = { libras: 0, monto: 0 };
  }

  for (const p of purchases) {
    if (!byMaterial[p.materialNombre]) {
      byMaterial[p.materialNombre] = { materialNombre: p.materialNombre, byDay: {}, totalLibras: 0, totalMonto: 0 };
    }
    const row = byMaterial[p.materialNombre];
    const cell = row.byDay[p.businessDate] ?? { libras: 0, monto: 0 };
    cell.libras += p.libras;
    cell.monto += p.total;
    row.byDay[p.businessDate] = cell;
    row.totalLibras += p.libras;
    row.totalMonto += p.total;

    if (p.businessDate in dailyTotals) {
      dailyTotals[p.businessDate].libras += p.libras;
      dailyTotals[p.businessDate].monto += p.total;
    }
    grandTotalLibras += p.libras;
    grandTotalMonto += p.total;
  }

  const rows = Object.values(byMaterial).sort((a, b) => b.totalMonto - a.totalMonto);
  return { days, rows, dailyTotals, grandTotalLibras, grandTotalMonto };
}

export default function DashboardHome() {
  const roleGuardStatus = useRoleGuard((role) => role !== 'comprador', '/purchases');
  const [businessDate, setBusinessDate] = useState(todayDateString());
  const [ledger, setLedger] = useState<LedgerDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [materialQuery, setMaterialQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('2026-05-25');
  const [toDate, setToDate] = useState<string>(todayDateString());
  const [stockLoading, setStockLoading] = useState(false);
  const [stockResult, setStockResult] = useState<StockResult | null>(null);
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [company, setCompany] = useState<CompanySettingsDTO | null>(null);
  const [printMode, setPrintMode] = usePrintMode();
  const [printingSummary, setPrintingSummary] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState(todayDateString());
  const [weeklyPivot, setWeeklyPivot] = useState<WeeklyPivot | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [printingWeekly, setPrintingWeekly] = useState(false);

  const fetchWeeklyPivot = useCallback(async () => {
    try {
      setWeeklyLoading(true);
      const days = getWeekDays(weekAnchor);
      const qs = new URLSearchParams({ from: days[0].businessDate, to: days[6].businessDate });
      const res = await fetch(`/api/materials/stock?${qs.toString()}`, { cache: 'no-store' });
      const body = await parseApiResponse<{
        data?: {
          purchases?: Array<{ businessDate: string; materialNombre: string; libras: number; total: number }>;
        };
      }>(res);
      setWeeklyPivot(buildWeeklyPivot(body.data?.purchases ?? [], days));
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo cargar el resumen semanal');
    } finally {
      setWeeklyLoading(false);
    }
  }, [weekAnchor, toast]);

  useEffect(() => {
    void fetchWeeklyPivot();
  }, [fetchWeeklyPivot]);

  function shiftWeek(deltaWeeks: number) {
    const current = parseLocalDate(weekAnchor);
    current.setDate(current.getDate() + deltaWeeks * 7);
    setWeekAnchor(formatLocalDate(current));
  }

  async function printWeeklySummary() {
    if (!weeklyPivot) return;
    const from = weeklyPivot.days[0].businessDate;
    const to = weeklyPivot.days[6].businessDate;

    try {
      setPrintingWeekly(true);

      if (printMode === 'browser') {
        printWeeklySummaryInBrowser({
          companyNombre: company?.nombre ?? '',
          weekStart: from,
          weekEnd: to,
          materials: weeklyPivot.rows.map((row) => ({
            materialNombre: row.materialNombre,
            libras: row.totalLibras,
            total: row.totalMonto,
          })),
        });
        return;
      }

      if (printMode === 'rawbt') {
        const { payloadB64 } = await fetch(`/api/print/weekly/data?from=${from}&to=${to}`, {
          cache: 'no-store',
        }).then(parseApiResponse<{ payloadB64: string }>);
        window.location.href = `rawbt:base64,${payloadB64}`;
        return;
      }

      const { jobId } = await fetch('/api/print/weekly', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from, to }),
      }).then(parseApiResponse<{ jobId: string; status: string }>);

      const deadline = Date.now() + 20000;
      let status = 'pending';
      let jobError: string | null = null;

      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const job = await fetch(`/api/print/jobs/${jobId}`, { cache: 'no-store' }).then(
          parseApiResponse<{ status: string; error: string | null }>,
        );
        status = job.status;
        jobError = job.error;
        if (status === 'done' || status === 'error') break;
      }

      if (status === 'done') {
        toast.success('Resumen semanal impreso');
      } else if (status === 'error') {
        toast.error(jobError || 'La impresora reportó un error.', 'No se pudo imprimir el resumen semanal');
      } else if (status !== 'done') {
        toast.error(PRINTER_TIMEOUT_MESSAGE, 'No se pudo imprimir el resumen semanal');
      }
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo imprimir el resumen semanal');
    } finally {
      setPrintingWeekly(false);
    }
  }

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ledger?businessDate=${businessDate}`, { cache: 'no-store' });
      const data = await parseApiResponse<LedgerDTO>(res);
      setLedger(data);
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo cargar el día');
    } finally {
      setLoading(false);
    }
  }, [businessDate, toast]);

  useEffect(() => {
    void fetchLedger();
  }, [fetchLedger]);

  async function printSummary() {
    try {
      setPrintingSummary(true);

      if (printMode === 'browser') {
        printSummaryInBrowser({
          companyNombre: company?.nombre ?? '',
          businessDate,
          materials: dailyPurchasesSummary,
          totalCompras: ledger?.totals.totalCompras ?? 0,
          totalVentas: ledger?.totals.totalVentas ?? 0,
          totalGastos: ledger?.totals.totalGastos ?? 0,
          totalIngresos: ledger?.totals.totalIngresos ?? 0,
          totalSalidas: ledger?.totals.totalSalidas ?? 0,
          saldoInicial: ledger?.balance.saldoInicial ?? 0,
          saldoActual: ledger?.totals.saldoActual ?? 0,
        });
        return;
      }

      if (printMode === 'rawbt') {
        const { payloadB64 } = await fetch(`/api/print/summary/data?businessDate=${businessDate}`, {
          cache: 'no-store',
        }).then(parseApiResponse<{ payloadB64: string }>);
        window.location.href = `rawbt:base64,${payloadB64}`;
        return;
      }

      const { jobId } = await fetch('/api/print/summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessDate }),
      }).then(parseApiResponse<{ jobId: string; status: string }>);

      const deadline = Date.now() + 20000;
      let status = 'pending';
      let jobError: string | null = null;

      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const job = await fetch(`/api/print/jobs/${jobId}`, { cache: 'no-store' }).then(
          parseApiResponse<{ status: string; error: string | null }>,
        );
        status = job.status;
        jobError = job.error;
        if (status === 'done' || status === 'error') break;
      }

      if (status === 'done') {
        toast.success('Resumen impreso');
      } else if (status === 'error') {
        toast.error(jobError || 'La impresora reportó un error.', 'No se pudo imprimir el resumen');
      } else if (status !== 'done') {
        toast.error(PRINTER_TIMEOUT_MESSAGE, 'No se pudo imprimir el resumen');
      }
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo imprimir el resumen');
    } finally {
      setPrintingSummary(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/settings/company', { cache: 'no-store' });
        const data = await parseApiResponse<CompanySettingsDTO>(res);
        if (mounted) setCompany(data);
      } catch {
        // ignore errors fetching company settings
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setMaterialsLoading(true);
        const res = await fetch('/api/materials', { cache: 'no-store' });
        const list = await parseApiResponse<MaterialDTO[]>(res);
        if (mounted) setMaterials(list);
      } catch {
        // ignore errors fetching materials for the select
      } finally {
        if (mounted) setMaterialsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const BarList = ({ items }: { items: { key: string; label: string; value: number }[] }) => {
    if (!items || items.length === 0) return null;
    const max = Math.max(...items.map((i) => i.value), 0);
    return (
      <div className="bar-list">
        {items.map((item) => {
          const pct = max > 0 ? (item.value / max) * 100 : 0;
          return (
            <div key={item.key} className="bar-list__row">
              <div className="bar-list__label" title={item.label}>
                {item.label}
              </div>
              <div className="bar-list__track">
                <div className="bar-list__fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="bar-list__value">{item.value.toLocaleString('es-HN')} lb</div>
            </div>
          );
        })}
      </div>
    );
  };

  const dailyPurchasesSummary = (() => {
    if (!ledger) return [];
    const byMaterial: Record<string, { materialNombre: string; libras: number; total: number }> = {};
    for (const p of ledger.purchases) {
      if (!byMaterial[p.materialId]) byMaterial[p.materialId] = { materialNombre: p.materialNombre, libras: 0, total: 0 };
      byMaterial[p.materialId].libras += p.libras;
      byMaterial[p.materialId].total += p.total;
    }
    return Object.values(byMaterial).sort((a, b) => b.total - a.total);
  })();

  if (roleGuardStatus !== 'allowed') return null;

  return (
    <main className="page-shell">
      <section className="hero hero--brand">
        <Image src={rControlLogo} width={132} height={132} className="hero-logo" alt="R Control" priority />
        <div>
          <h1>Resumen del día</h1>
          {company?.nombre ? <h2>{company.nombre}</h2> : null}
          <p>Saldo, compras y movimientos de la fecha seleccionada.</p>
        </div>
      </section>

      <section className="card-grid">
        <article className="card wide">
          <div className="row">
            <label style={{ gridColumn: 'span 4' }}>
              Fecha de negocio
              <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
            </label>
            <div style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
              <button className="btn-primary" onClick={() => void fetchLedger()}>
                Recargar
              </button>
            </div>
          </div>
        </article>

        <article className="card third kpi">
          <div className="label">Saldo actual</div>
          <div className="value">L {ledger?.totals.saldoActual.toFixed(2) ?? '0.00'}</div>
        </article>
        <article className="card third kpi">
          <div className="label">Compras del día</div>
          <div className="value">L {ledger?.totals.totalCompras.toFixed(2) ?? '0.00'}</div>
        </article>
        <article className="card third kpi">
          <div className="label">Movimientos</div>
          <div className="value"> {ledger ? ledger.purchases.length + ledger.sales.length + ledger.expenses.length : 0}</div>
        </article>

        <article className="card wide">
          <div className="card-head">
            <h3>Resumen de compras del día</h3>
            <div className="card-actions">
              <label className="inline-field">
                Impresión en este dispositivo
                <select value={printMode} onChange={(e) => setPrintMode(e.target.value as typeof printMode)}>
                  <option value="queue">Impresora de red (sin vista previa)</option>
                  <option value="rawbt">RawBT (Android)</option>
                  <option value="browser">Diálogo del navegador (con vista previa)</option>
                </select>
              </label>
              <button className="btn-primary" type="button" disabled={printingSummary} onClick={() => void printSummary()}>
                {printingSummary ? 'Imprimiendo...' : 'Imprimir resumen del día'}
              </button>
            </div>
          </div>
          <table className="table-like" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Material</th>
                <th className="num">Libras</th>
                <th className="num">Total (L)</th>
              </tr>
            </thead>
            <tbody>
              {dailyPurchasesSummary.map((item) => (
                <tr key={item.materialNombre}>
                  <td>{item.materialNombre}</td>
                  <td className="num">{item.libras.toLocaleString('es-HN')} lb</td>
                  <td className="num">L {item.total.toFixed(2)}</td>
                </tr>
              ))}
              {dailyPurchasesSummary.length === 0 ? (
                <tr>
                  <td colSpan={3}>No hay compras registradas para este día.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </article>

        <article className="card wide">
          <div className="card-head">
            <h3>Compras de la semana por material</h3>
            <div className="card-actions">
              <button className="btn-secondary" type="button" onClick={() => shiftWeek(-1)}>
                ◀ Semana anterior
              </button>
              <button className="btn-secondary" type="button" onClick={() => setWeekAnchor(todayDateString())}>
                Esta semana
              </button>
              <button className="btn-secondary" type="button" onClick={() => shiftWeek(1)}>
                Semana siguiente ▶
              </button>
              <button
                className="btn-primary"
                type="button"
                disabled={printingWeekly || !weeklyPivot}
                onClick={() => void printWeeklySummary()}
              >
                {printingWeekly ? 'Imprimiendo...' : 'Imprimir resumen semanal'}
              </button>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
            Semana del {weeklyPivot ? weeklyPivot.days[0].businessDate : ''} al{' '}
            {weeklyPivot ? weeklyPivot.days[6].businessDate : ''} (libras y dinero comprado por material y día).
          </p>
          {weeklyLoading ? <p className="status-line">Cargando semana…</p> : null}
          {weeklyPivot ? (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table className="table-like">
                <thead>
                  <tr>
                    <th>Material</th>
                    {weeklyPivot.days.map((day) => (
                      <th key={day.businessDate} className="num">
                        {day.label} {day.dayNumber}
                      </th>
                    ))}
                    <th className="num">Total semana</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyPivot.rows.map((row) => (
                    <tr key={row.materialNombre}>
                      <td>{row.materialNombre}</td>
                      {weeklyPivot.days.map((day) => {
                        const cell = row.byDay[day.businessDate];
                        return (
                          <td key={day.businessDate} className="num">
                            {cell ? (
                              <>
                                <div>{cell.libras.toLocaleString('es-HN')} lb</div>
                                <div className="sub-num">L {cell.monto.toFixed(2)}</div>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                        );
                      })}
                      <td className="num" style={{ fontWeight: 650 }}>
                        <div>{row.totalLibras.toLocaleString('es-HN')} lb</div>
                        <div className="sub-num">
                          L {row.totalMonto.toFixed(2)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {weeklyPivot.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9}>No hay compras registradas esta semana.</td>
                    </tr>
                  ) : null}
                </tbody>
                {weeklyPivot.rows.length > 0 ? (
                  <tfoot>
                    <tr>
                      <td>Total día</td>
                      {weeklyPivot.days.map((day) => {
                        const cell = weeklyPivot.dailyTotals[day.businessDate];
                        return (
                          <td key={day.businessDate} className="num" style={{ fontWeight: 650 }}>
                            L {cell.monto.toFixed(2)}
                          </td>
                        );
                      })}
                      <td className="num" style={{ fontWeight: 650 }}>
                        L {weeklyPivot.grandTotalMonto.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          ) : null}
        </article>

        <article className="card wide">
          <h3>Consultar stock por material</h3>
          <div className="row" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 3' }}>
              Material
              <select value={materialQuery} onChange={(e) => setMaterialQuery(e.target.value)}>
                <option value="">-- Todos --</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              {materialsLoading ? <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>Cargando materiales...</div> : null}
            </label>
            <label style={{ gridColumn: 'span 3' }}>
              Desde
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label style={{ gridColumn: 'span 3' }}>
              Hasta
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
            <div style={{ gridColumn: 'span 3', alignSelf: 'end' }}>
              <button
                className="btn-primary"
                type="button"
                disabled={stockLoading}
                onClick={async () => {
                  try {
                    setStockLoading(true);
                    setStockResult(null);
                    const qs = new URLSearchParams();
                    if (materialQuery.trim()) qs.set('materialId', materialQuery.trim());
                    if (fromDate) qs.set('from', fromDate);
                    if (toDate) qs.set('to', toDate);
                    const res = await fetch(`/api/materials/stock?${qs.toString()}`, { cache: 'no-store' });
                    const body = await parseApiResponse<StockResult>(res);
                    setStockResult(body);
                  } catch (err) {
                    toast.error(errorMessage(err), 'No se pudo consultar el stock');
                  } finally {
                    setStockLoading(false);
                  }
                }}
              >
                {stockLoading ? 'Consultando...' : 'Consultar'}
              </button>
            </div>
          </div>

          {stockResult ? (
            <div style={{ marginTop: 12 }}>
              {stockResult.data?.materialId ? (
                <div>
                  <div><strong>Total libras:</strong> {stockResult.data.totalLibras ?? 0}</div>
                  <h4>Desglose diario</h4>
                  <BarList
                    items={(stockResult.data.daily ?? []).map((d: DailyStockEntry) => ({
                      key: d.businessDate,
                      label: d.businessDate,
                      value: Number(d.libras) || 0,
                    }))}
                  />
                </div>
              ) : (
                <div>
                  <h4>Totales por material</h4>
                  <BarList
                    items={(stockResult.data?.materials ?? []).map((m: MaterialStockSummary) => ({
                      key: m.materialId,
                      label: m.materialNombre,
                      value: Number(m.totalLibras) || 0,
                    }))}
                  />
                </div>
              )}
            </div>
          ) : null}
        </article>
      </section>

      {loading ? <p className="status-line">Cargando…</p> : null}
    </main>
  );
}
