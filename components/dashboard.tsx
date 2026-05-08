'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiResponse } from '@/types/api';
import type { LedgerDTO, MaterialDTO } from '@/types/domain';

type RequestState = {
  loading: boolean;
  error: string | null;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.ok) {
    throw new Error(body.error.message);
  }

  return body.data;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function Dashboard() {
  const [businessDate, setBusinessDate] = useState(todayDateString());
  const [ledger, setLedger] = useState<LedgerDTO | null>(null);
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [state, setState] = useState<RequestState>({ loading: true, error: null });

  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialPrice, setNewMaterialPrice] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');

  const [purchaseMaterialId, setPurchaseMaterialId] = useState('');
  const [purchaseLibras, setPurchaseLibras] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');

  const [saleDescription, setSaleDescription] = useState('');
  const [saleAmount, setSaleAmount] = useState('');

  const [expenseCategory, setExpenseCategory] = useState('Operativo');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const fetchMaterials = useCallback(async () => {
    const response = await fetch('/api/materials', { cache: 'no-store' });
    const data = await parseApiResponse<MaterialDTO[]>(response);
    setMaterials(data);
    if (!purchaseMaterialId && data.length > 0) {
      setPurchaseMaterialId(data[0].id);
    }
  }, [purchaseMaterialId]);

  const fetchLedger = useCallback(async () => {
    const response = await fetch(`/api/ledger?businessDate=${businessDate}`, {
      cache: 'no-store',
    });
    const data = await parseApiResponse<LedgerDTO>(response);
    setLedger(data);
    setInitialBalance(String(data.balance.saldoInicial));
  }, [businessDate]);

  const refresh = useCallback(async () => {
    try {
      setState({ loading: true, error: null });
      await Promise.all([fetchMaterials(), fetchLedger()]);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : 'Unexpected error' });
    }
  }, [fetchLedger, fetchMaterials]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalItems = useMemo(() => {
    if (!ledger) {
      return 0;
    }

    return ledger.purchases.length + ledger.sales.length + ledger.expenses.length;
  }, [ledger]);

  async function createMaterial(event: React.FormEvent) {
    event.preventDefault();
    try {
      setState((current) => ({ ...current, loading: true }));
      await fetch('/api/materials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre: newMaterialName,
          precioPorLibra: Number(newMaterialPrice),
        }),
      }).then(parseApiResponse);
      setNewMaterialName('');
      setNewMaterialPrice('');
      await refresh();
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : 'Error creating material' });
    }
  }

  async function setDailyInitialBalance(event: React.FormEvent) {
    event.preventDefault();
    try {
      setState((current) => ({ ...current, loading: true }));
      await fetch('/api/ledger/initial-balance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessDate, saldoInicial: Number(initialBalance) }),
      }).then(parseApiResponse);
      await refresh();
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : 'Error setting balance' });
    }
  }

  async function createPurchase(event: React.FormEvent) {
    event.preventDefault();
    try {
      setState((current) => ({ ...current, loading: true }));
      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessDate,
          materialId: purchaseMaterialId,
          libras: Number(purchaseLibras),
          precioPorLibra: purchasePrice ? Number(purchasePrice) : undefined,
        }),
      }).then(parseApiResponse);
      setPurchaseLibras('');
      setPurchasePrice('');
      await refresh();
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : 'Error creating purchase' });
    }
  }

  async function createSale(event: React.FormEvent) {
    event.preventDefault();
    try {
      setState((current) => ({ ...current, loading: true }));
      await fetch('/api/sales', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessDate, descripcion: saleDescription, monto: Number(saleAmount) }),
      }).then(parseApiResponse);
      setSaleDescription('');
      setSaleAmount('');
      await refresh();
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : 'Error creating sale' });
    }
  }

  async function createExpense(event: React.FormEvent) {
    event.preventDefault();
    try {
      setState((current) => ({ ...current, loading: true }));
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessDate,
          categoria: expenseCategory,
          descripcion: expenseDescription,
          monto: Number(expenseAmount),
        }),
      }).then(parseApiResponse);
      setExpenseDescription('');
      setExpenseAmount('');
      await refresh();
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : 'Error creating expense' });
    }
  }

  async function removeEntry(endpoint: string, id: string) {
    try {
      setState((current) => ({ ...current, loading: true }));
      await fetch(`${endpoint}/${id}`, { method: 'DELETE' }).then(parseApiResponse);
      await refresh();
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : 'Error deleting entry' });
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <h1>Control Diario de Operaciones</h1>
        <p>Compras, ventas y gastos con balance recalculado en tiempo real.</p>
      </section>

      <section className="card-grid">
        <article className="card wide">
          <div className="row">
            <label style={{ gridColumn: 'span 4' }}>
              Fecha de negocio
              <input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
            </label>
            <div style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
              <button className="btn-primary" onClick={() => void refresh()}>
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
          {state.error ? <p style={{ color: 'var(--danger)' }}>{state.error}</p> : null}
        </article>

        <article className="card third kpi">
          <div className="label">Saldo actual</div>
          <div className="value">$ {ledger?.totals.saldoActual.toFixed(2) ?? '0.00'}</div>
        </article>
        <article className="card third kpi">
          <div className="label">Ventas del dia</div>
          <div className="value">$ {ledger?.totals.totalVentas.toFixed(2) ?? '0.00'}</div>
        </article>
        <article className="card third kpi">
          <div className="label">Movimientos</div>
          <div className="value">{totalItems}</div>
        </article>

        <article className="card half">
          <h3>Materiales</h3>
          <form onSubmit={(event) => void createMaterial(event)} className="row" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 6' }}>
              Nombre
              <input value={newMaterialName} onChange={(event) => setNewMaterialName(event.target.value)} required />
            </label>
            <label style={{ gridColumn: 'span 4' }}>
              Precio / libra
              <input
                value={newMaterialPrice}
                onChange={(event) => setNewMaterialPrice(event.target.value)}
                type="number"
                step="0.01"
                min="0"
                required
              />
            </label>
            <div style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
              <button className="btn-primary" type="submit">
                Crear
              </button>
            </div>
          </form>
        </article>

        <article className="card half">
          <h3>Saldo inicial</h3>
          <form onSubmit={(event) => void setDailyInitialBalance(event)} className="row" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 8' }}>
              Monto
              <input
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
                type="number"
                step="0.01"
              />
            </label>
            <div style={{ gridColumn: 'span 4', alignSelf: 'end' }}>
              <button className="btn-primary" type="submit">
                Actualizar
              </button>
            </div>
          </form>
        </article>

        <article className="card third">
          <h3>Nueva compra</h3>
          <form onSubmit={(event) => void createPurchase(event)} className="row" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 12' }}>
              Material
              <select value={purchaseMaterialId} onChange={(event) => setPurchaseMaterialId(event.target.value)} required>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.nombre} (${material.precioPorLibra.toFixed(2)})
                  </option>
                ))}
              </select>
            </label>
            <label style={{ gridColumn: 'span 6' }}>
              Libras
              <input
                value={purchaseLibras}
                onChange={(event) => setPurchaseLibras(event.target.value)}
                type="number"
                step="0.01"
                required
              />
            </label>
            <label style={{ gridColumn: 'span 6' }}>
              Precio manual
              <input
                value={purchasePrice}
                onChange={(event) => setPurchasePrice(event.target.value)}
                type="number"
                step="0.01"
                placeholder="Opcional"
              />
            </label>
            <div style={{ gridColumn: 'span 12' }}>
              <button className="btn-primary" type="submit">
                Registrar compra
              </button>
            </div>
          </form>
        </article>

        <article className="card third">
          <h3>Nueva venta</h3>
          <form onSubmit={(event) => void createSale(event)} className="row" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 12' }}>
              Descripcion
              <input value={saleDescription} onChange={(event) => setSaleDescription(event.target.value)} required />
            </label>
            <label style={{ gridColumn: 'span 12' }}>
              Monto
              <input
                value={saleAmount}
                onChange={(event) => setSaleAmount(event.target.value)}
                type="number"
                step="0.01"
                required
              />
            </label>
            <div style={{ gridColumn: 'span 12' }}>
              <button className="btn-primary" type="submit">
                Registrar venta
              </button>
            </div>
          </form>
        </article>

        <article className="card third">
          <h3>Nuevo gasto</h3>
          <form onSubmit={(event) => void createExpense(event)} className="row" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 12' }}>
              Categoria
              <input value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} required />
            </label>
            <label style={{ gridColumn: 'span 12' }}>
              Descripcion
              <input
                value={expenseDescription}
                onChange={(event) => setExpenseDescription(event.target.value)}
                required
              />
            </label>
            <label style={{ gridColumn: 'span 12' }}>
              Monto
              <input
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                type="number"
                step="0.01"
                required
              />
            </label>
            <div style={{ gridColumn: 'span 12' }}>
              <button className="btn-primary" type="submit">
                Registrar gasto
              </button>
            </div>
          </form>
        </article>

        <article className="card wide">
          <h3>Compras del dia</h3>
          <table className="table-like" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Material</th>
                <th>Libras</th>
                <th>Total</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {ledger?.purchases.map((item) => (
                <tr key={item.id}>
                  <td>{item.materialNombre}</td>
                  <td>{item.libras.toFixed(2)}</td>
                  <td>$ {item.total.toFixed(2)}</td>
                  <td>
                    <button className="btn-danger" onClick={() => void removeEntry('/api/purchases', item.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="card half">
          <h3>Ventas del dia</h3>
          <table className="table-like" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Descripcion</th>
                <th>Monto</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {ledger?.sales.map((item) => (
                <tr key={item.id}>
                  <td>{item.descripcion}</td>
                  <td>$ {item.monto.toFixed(2)}</td>
                  <td>
                    <button className="btn-danger" onClick={() => void removeEntry('/api/sales', item.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="card half">
          <h3>Gastos del dia</h3>
          <table className="table-like" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Monto</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {ledger?.expenses.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.categoria} - {item.descripcion}
                  </td>
                  <td>$ {item.monto.toFixed(2)}</td>
                  <td>
                    <button className="btn-danger" onClick={() => void removeEntry('/api/expenses', item.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      {state.loading ? <p style={{ color: '#fff', marginTop: 12 }}>Sincronizando datos...</p> : null}
    </main>
  );
}