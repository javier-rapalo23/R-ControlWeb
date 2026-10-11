'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CompanySettingsDTO, MaterialCargaDTO, MaterialDTO, MaterialStockDTO } from '@/types/domain';
import { usePrintMode } from '@/lib/use-print-mode';
import { printInventoryInBrowser } from '@/lib/print-html';
import { errorMessage, parseApiResponse, PRINTER_TIMEOUT_MESSAGE } from '@/lib/api-client';
import { useToast } from '@/components/toast';

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type MaterialStock = {
  material: MaterialDTO;
  stock: MaterialStockDTO | null;
  ultimaCarga: MaterialCargaDTO | null;
};

export default function InventoryPanel() {
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, MaterialStock>>({});
  const [cargas, setCargas] = useState<MaterialCargaDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [company, setCompany] = useState<CompanySettingsDTO | null>(null);
  const [printMode, setPrintMode] = usePrintMode();
  const [printing, setPrinting] = useState(false);

  // Form state
  const [formMaterialId, setFormMaterialId] = useState('');
  const [formDate, setFormDate] = useState(todayDateString());
  const [formLibras, setFormLibras] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const matsResponse = await fetch('/api/materials', { cache: 'no-store' });
      const mats = await parseApiResponse<MaterialDTO[]>(matsResponse);
      setMaterials(mats);

      if (mats.length > 0 && !formMaterialId) {
        setFormMaterialId(mats[0].id);
      }

      // Fetch stock and cargas for each material in parallel
      type StockApiData = { filters: unknown; ultimaCarga: MaterialCargaDTO | null; data: MaterialStockDTO };

      const stockResults = await Promise.all(
        mats.map(async (mat) => {
          const [stockRes, cargasRes] = await Promise.all([
            fetch(`/api/materials/stock?materialId=${mat.id}`, { cache: 'no-store' }),
            fetch(`/api/material-cargas?materialId=${mat.id}`, { cache: 'no-store' }),
          ]);

          const stockBody = (await stockRes.json()) as { ok: boolean; data?: StockApiData };
          const cargasBody = (await cargasRes.json()) as { ok: boolean; data?: MaterialCargaDTO[] };

          const stock = stockBody.ok && stockBody.data ? stockBody.data.data : null;
          const ultimaCarga = stockBody.ok && stockBody.data ? stockBody.data.ultimaCarga : null;
          const matCargas = cargasBody.ok && cargasBody.data ? cargasBody.data : [];

          return { mat, stock, ultimaCarga, matCargas };
        }),
      );

      const newStockMap: Record<string, MaterialStock> = {};
      const allCargas: MaterialCargaDTO[] = [];

      for (const { mat, stock, ultimaCarga, matCargas } of stockResults) {
        newStockMap[mat.id] = { material: mat, stock, ultimaCarga };
        allCargas.push(...matCargas);
      }

      setStockMap(newStockMap);
      allCargas.sort((a, b) => b.businessDate.localeCompare(a.businessDate));
      setCargas(allCargas);
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo cargar el inventario');
    } finally {
      setLoading(false);
    }
  }, [formMaterialId, toast]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetch('/api/settings/company', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: { ok: boolean; data?: CompanySettingsDTO }) => {
        if (body.ok && body.data) setCompany(body.data);
      })
      .catch(() => undefined);
  }, []);

  async function printInventory() {
    try {
      setPrinting(true);

      if (printMode === 'browser') {
        printInventoryInBrowser({
          companyNombre: company?.nombre ?? '',
          generatedAt: todayDateString(),
          materials: materials.map((mat) => ({
            materialNombre: mat.nombre,
            libras: stockMap[mat.id]?.stock?.totalLibras ?? 0,
          })),
        });
        return;
      }

      if (printMode === 'rawbt') {
        const { payloadB64 } = await fetch('/api/print/inventory/data', { cache: 'no-store' }).then(
          parseApiResponse<{ payloadB64: string }>,
        );
        window.location.href = `rawbt:base64,${payloadB64}`;
        return;
      }

      const { jobId } = await fetch('/api/print/inventory', { method: 'POST' }).then(
        parseApiResponse<{ jobId: string; status: string }>,
      );

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
        toast.success('Inventario impreso');
      } else if (status === 'error') {
        toast.error(jobError || 'La impresora reportó un error.', 'No se pudo imprimir el inventario');
      } else if (status !== 'done') {
        toast.error(PRINTER_TIMEOUT_MESSAGE, 'No se pudo imprimir el inventario');
      }
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo imprimir el inventario');
    } finally {
      setPrinting(false);
    }
  }

  async function registrarCarga(event: React.FormEvent) {
    event.preventDefault();
    if (!formMaterialId) return;
    try {
      setLoading(true);
      await fetch('/api/material-cargas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessDate: formDate,
          materialId: formMaterialId,
          libras: formLibras ? Number(formLibras) : null,
          descripcion: formDescripcion || null,
        }),
      }).then(parseApiResponse);

      setFormLibras('');
      setFormDescripcion('');
      toast.success('Envío a venta registrado');
      await fetchAll();
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo registrar el envío a venta');
      setLoading(false);
    }
  }

  async function eliminarCarga(id: string) {
    try {
      setLoading(true);
      await fetch(`/api/material-cargas/${id}`, { method: 'DELETE' }).then(parseApiResponse);
      toast.success('Envío eliminado');
      await fetchAll();
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo eliminar el envío');
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <h1>Inventario</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label className="inline-field">
              Impresión en este dispositivo
              <select value={printMode} onChange={(e) => setPrintMode(e.target.value as typeof printMode)}>
                <option value="queue">Impresora de red (sin vista previa)</option>
                <option value="rawbt">RawBT (Android)</option>
                <option value="browser">Diálogo del navegador (con vista previa)</option>
              </select>
            </label>
            <button className="btn-primary" type="button" disabled={printing} onClick={() => void printInventory()}>
              {printing ? 'Imprimiendo...' : 'Imprimir inventario'}
            </button>
          </div>
        </div>
        <p>
          Stock actual por material: compras acumuladas menos envíos a venta. Registra cuándo mandas a vender un lote
          y solo se rebajará esa cantidad (si dejas las libras en blanco, se asume que se envió todo el stock).
        </p>
      </section>

      <section className="card-grid">
        {/* Stock cards por material */}
        {materials.map((mat) => {
          const entry = stockMap[mat.id];
          const totalLibras = entry?.stock?.totalLibras ?? 0;
          const ultimaCarga = entry?.ultimaCarga ?? null;

          return (
            <article key={mat.id} className="card third kpi">
              <div className="label">{mat.nombre}</div>
              <div className="value">{totalLibras.toFixed(2)} lb</div>
              {ultimaCarga ? (
                <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>
                  Último envío: {ultimaCarga.businessDate}
                  {ultimaCarga.libras !== null ? ` · ${ultimaCarga.libras.toFixed(2)} lb` : ''}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4 }}>Sin envíos registrados</div>
              )}
            </article>
          );
        })}

        {/* Formulario registrar envío a venta */}
        <article className="card half">
          <h3>Registrar envío a venta</h3>
          <form onSubmit={(event) => void registrarCarga(event)} className="row" style={{ marginTop: 10 }}>
            <label style={{ gridColumn: 'span 12' }}>
              Material
              <select value={formMaterialId} onChange={(event) => setFormMaterialId(event.target.value)} required>
                {materials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ gridColumn: 'span 6' }}>
              Fecha de envío
              <input type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} required />
            </label>
            <label style={{ gridColumn: 'span 6' }}>
              Libras enviadas
              <input
                type="number"
                step="0.01"
                placeholder="Vacío = se envió todo el stock"
                value={formLibras}
                onChange={(event) => setFormLibras(event.target.value)}
              />
            </label>
            <label style={{ gridColumn: 'span 12' }}>
              Descripción
              <input
                placeholder="Opcional (ej: enviado a Fundidora XYZ)"
                value={formDescripcion}
                onChange={(event) => setFormDescripcion(event.target.value)}
              />
            </label>
            <div style={{ gridColumn: 'span 12' }}>
              <button className="btn-primary" type="submit" disabled={loading || !formMaterialId}>
                Registrar envío
              </button>
            </div>
          </form>
        </article>

        {/* Historial de cargas */}
        <article className="card wide">
          <h3>Historial de envíos a venta</h3>
          {cargas.length === 0 ? (
            <p style={{ color: 'var(--text-soft)', marginTop: 8 }}>No hay envíos registrados aún.</p>
          ) : (
            <table className="table-like" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Material</th>
                  <th>Libras</th>
                  <th>Descripción</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {cargas.map((carga) => (
                  <tr key={carga.id}>
                    <td>{carga.businessDate}</td>
                    <td>{carga.materialNombre}</td>
                    <td>{carga.libras !== null ? `${carga.libras.toFixed(2)} lb` : '—'}</td>
                    <td>{carga.descripcion ?? '—'}</td>
                    <td>
                      <button
                        className="btn-danger"
                        type="button"
                        onClick={() => void eliminarCarga(carga.id)}
                        disabled={loading}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>

      {loading ? <p className="status-line">Sincronizando…</p> : null}
    </main>
  );
}
