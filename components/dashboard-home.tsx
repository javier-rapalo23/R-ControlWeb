'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import type { ApiResponse } from '@/types/api';
import type { CompanySettingsDTO, LedgerDTO, MaterialDTO } from '@/types/domain';
import { useRoleGuard } from '@/lib/use-role-guard';
import { usePrintMode } from '@/lib/use-print-mode';
import { printSummaryInBrowser } from '@/lib/print-html';
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

type ImportApiData = {
  imported: {
    importedDays: number;
    importedMaterials: number;
    importedPurchases: number;
    importedSales: number;
    importedExpenses: number;
  };
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

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

type WeeklyPivotRow = { materialNombre: string; byDay: Record<string, number>; total: number };
type WeeklyPivot = {
  days: ReturnType<typeof getWeekDays>;
  rows: WeeklyPivotRow[];
  dailyTotals: Record<string, number>;
  grandTotal: number;
};

function buildWeeklyPivot(
  purchases: Array<{ businessDate: string; materialNombre: string; libras: number }>,
  days: ReturnType<typeof getWeekDays>,
): WeeklyPivot {
  const byMaterial: Record<string, WeeklyPivotRow> = {};
  const dailyTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const day of days) {
    dailyTotals[day.businessDate] = 0;
  }

  for (const p of purchases) {
    if (!byMaterial[p.materialNombre]) {
      byMaterial[p.materialNombre] = { materialNombre: p.materialNombre, byDay: {}, total: 0 };
    }
    const row = byMaterial[p.materialNombre];
    row.byDay[p.businessDate] = (row.byDay[p.businessDate] ?? 0) + p.libras;
    row.total += p.libras;

    if (p.businessDate in dailyTotals) {
      dailyTotals[p.businessDate] += p.libras;
    }
    grandTotal += p.libras;
  }

  const rows = Object.values(byMaterial).sort((a, b) => b.total - a.total);
  return { days, rows, dailyTotals, grandTotal };
}

export default function DashboardHome() {
  const roleGuardStatus = useRoleGuard((role) => role !== 'comprador', '/purchases');
  const [businessDate, setBusinessDate] = useState(todayDateString());
  const [ledger, setLedger] = useState<LedgerDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importUserId, setImportUserId] = useState('admin');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [materialQuery, setMaterialQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('2026-05-25');
  const [toDate, setToDate] = useState<string>(todayDateString());
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockResult, setStockResult] = useState<StockResult | null>(null);
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [company, setCompany] = useState<CompanySettingsDTO | null>(null);
  const [printMode, setPrintMode] = usePrintMode();
  const [printingSummary, setPrintingSummary] = useState(false);
  const [weeklyPivot, setWeeklyPivot] = useState<WeeklyPivot | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  const fetchWeeklyPivot = useCallback(async () => {
    try {
      setWeeklyLoading(true);
      setWeeklyError(null);
      const days = getWeekDays(businessDate);
      const qs = new URLSearchParams({ from: days[0].businessDate, to: days[6].businessDate });
      const res = await fetch(`/api/materials/stock?${qs.toString()}`, { cache: 'no-store' });
      const body = await parseApiResponse<{
        data?: {
          purchases?: Array<{ businessDate: string; materialNombre: string; libras: number }>;
        };
      }>(res);
      setWeeklyPivot(buildWeeklyPivot(body.data?.purchases ?? [], days));
    } catch (err) {
      setWeeklyError(err instanceof Error ? err.message : 'Error cargando el resumen semanal');
    } finally {
      setWeeklyLoading(false);
    }
  }, [businessDate]);

  useEffect(() => {
    void fetchWeeklyPivot();
  }, [fetchWeeklyPivot]);

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ledger?businessDate=${businessDate}`, { cache: 'no-store' });
      const data = await parseApiResponse<LedgerDTO>(res);
      setLedger(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [businessDate]);

  useEffect(() => {
    void fetchLedger();
  }, [fetchLedger]);

  async function printSummary() {
    try {
      setError(null);
      setPrintingSummary(true);

      if (printMode === 'browser') {
        printSummaryInBrowser({
          companyNombre: company?.nombre ?? '',
          businessDate,
          materials: dailyPurchasesSummary,
          totalCompras: ledger?.totals.totalCompras ?? 0,
          totalVentas: ledger?.totals.totalVentas ?? 0,
          totalGastos: ledger?.totals.totalGastos ?? 0,
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

      if (status === 'error') {
        setError(jobError || 'Error imprimiendo resumen');
      } else if (status !== 'done') {
        setError('La impresora no respondió a tiempo. Verifica que esté encendida y conectada a la red.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error imprimiendo resumen');
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {items.map((item) => {
          const pct = max > 0 ? (item.value / max) * 100 : 0;
          return (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 130, textAlign: 'right', fontSize: 13, color: 'var(--text-soft)', flexShrink: 0 }}>
                {item.label}
              </div>
              <div style={{ flex: 1, background: 'var(--border-color)', borderRadius: 4, height: 22 }}>
                <div
                  style={{
                    width: `${pct}%`,
                    background: 'var(--primary, #2563eb)',
                    borderRadius: 4,
                    height: '100%',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <div style={{ width: 100, fontSize: 13, flexShrink: 0 }}>
                {item.value.toLocaleString('es-HN')} lb
              </div>
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

  async function importData(event: React.FormEvent) {
    event.preventDefault();

    if (!importFile) {
      setImportError('Selecciona un archivo .txt o .json para importar.');
      setImportSuccess(null);
      return;
    }

    if (!importUserId.trim()) {
      setImportError('Ingresa el usuario autorizado para importar.');
      setImportSuccess(null);
      return;
    }

    try {
      setImporting(true);
      setImportError(null);
      setImportSuccess(null);

      const raw = await importFile.text();
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'x-user-id': importUserId.trim(),
        },
        body: raw,
      });

      const data = await parseApiResponse<ImportApiData>(response);
      setImportSuccess(
        `Importación lista: ${data.imported.importedDays} días, ${data.imported.importedPurchases} compras, ${data.imported.importedSales} ventas, ${data.imported.importedExpenses} gastos.`,
      );
      setImportFile(null);
      await fetchLedger();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'No fue posible importar el archivo.');
    } finally {
      setImporting(false);
    }
  }

  if (roleGuardStatus !== 'allowed') return null;

  return (
    <main className="page-shell">
      <section className="hero hero--brand">
        <Image src={rControlLogo} width={132} height={132} className="hero-logo" alt="R Control" priority />
        <div>
          <h1>Control Diario — Resumen</h1>
          {company?.nombre ? <h2 style={{ fontWeight: 600, marginBottom: 2 }}>{company.nombre}</h2> : null}
          <p>Resumen rápido del día y accesos a los módulos de Compras, Ventas y Gastos.</p>
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
            <div style={{ gridColumn: 'span 6', alignSelf: 'end', textAlign: 'right' }}>
              <a href={`/api/export?businessDate=${businessDate}`} target="_blank" rel="noreferrer">
                <button className="btn-primary" type="button">
                  Exportar JSON
                </button>
              </a>
            </div>
          </div>
          {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3>Resumen de compras del día</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-soft)' }}>
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
          <table className="table-like" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Material</th>
                <th>Libras</th>
                <th>Total (L)</th>
              </tr>
            </thead>
            <tbody>
              {dailyPurchasesSummary.map((item) => (
                <tr key={item.materialNombre}>
                  <td>{item.materialNombre}</td>
                  <td>{item.libras.toLocaleString('es-HN')} lb</td>
                  <td>L {item.total.toFixed(2)}</td>
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
          <h3>Compras de la semana por material</h3>
          <p style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 4 }}>
            Semana del {weeklyPivot ? weeklyPivot.days[0].businessDate : ''} al{' '}
            {weeklyPivot ? weeklyPivot.days[6].businessDate : ''} (libras compradas por material y día).
          </p>
          {weeklyError ? <p style={{ color: 'var(--danger)' }}>{weeklyError}</p> : null}
          {weeklyLoading ? <p style={{ color: 'var(--text-soft)' }}>Cargando...</p> : null}
          {weeklyPivot ? (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table className="table-like">
                <thead>
                  <tr>
                    <th>Material</th>
                    {weeklyPivot.days.map((day) => (
                      <th key={day.businessDate} style={{ textAlign: 'right' }}>
                        {day.label} {day.dayNumber}
                      </th>
                    ))}
                    <th style={{ textAlign: 'right' }}>Total semana</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyPivot.rows.map((row) => (
                    <tr key={row.materialNombre}>
                      <td>{row.materialNombre}</td>
                      {weeklyPivot.days.map((day) => (
                        <td key={day.businessDate} style={{ textAlign: 'right' }}>
                          {row.byDay[day.businessDate] ? row.byDay[day.businessDate].toLocaleString('es-HN') : '—'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.total.toLocaleString('es-HN')}</td>
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
                      <td style={{ fontWeight: 700 }}>Total día</td>
                      {weeklyPivot.days.map((day) => (
                        <td key={day.businessDate} style={{ textAlign: 'right', fontWeight: 700 }}>
                          {weeklyPivot.dailyTotals[day.businessDate].toLocaleString('es-HN')}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{weeklyPivot.grandTotal.toLocaleString('es-HN')}</td>
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
                    setStockError(null);
                    setStockResult(null);
                    const qs = new URLSearchParams();
                    if (materialQuery.trim()) qs.set('materialId', materialQuery.trim());
                    if (fromDate) qs.set('from', fromDate);
                    if (toDate) qs.set('to', toDate);
                    const res = await fetch(`/api/materials/stock?${qs.toString()}`, { cache: 'no-store' });
                    const body = await parseApiResponse<StockResult>(res);
                    setStockResult(body);
                  } catch (err) {
                    setStockError(err instanceof Error ? err.message : 'Error consultando stock');
                  } finally {
                    setStockLoading(false);
                  }
                }}
              >
                {stockLoading ? 'Consultando...' : 'Consultar'}
              </button>
            </div>
          </div>

          {stockError ? <p style={{ color: 'var(--danger)' }}>{stockError}</p> : null}
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

        <article className="card wide">
          <h3>Importar TXT/JSON</h3>
          <form onSubmit={(event) => void importData(event)} className="row" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 3' }}>
              Usuario (admin)
              <input
                value={importUserId}
                onChange={(event) => setImportUserId(event.target.value)}
                placeholder="admin"
                required
              />
            </label>
            <label style={{ gridColumn: 'span 7' }}>
              Archivo
              <input
                type="file"
                accept=".txt,.json,text/plain,application/json"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                required
              />
            </label>
            <div style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
              <button className="btn-primary" type="submit" disabled={importing}>
                {importing ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </form>
          {importSuccess ? <p style={{ color: 'var(--ok)' }}>{importSuccess}</p> : null}
          {importError ? <p style={{ color: 'var(--danger)' }}>{importError}</p> : null}
        </article>
      </section>

      {loading ? <p style={{ color: 'var(--text-soft)', marginTop: 12 }}>Cargando...</p> : null}
    </main>
  );
}
