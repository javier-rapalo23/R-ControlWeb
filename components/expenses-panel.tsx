'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LedgerDTO } from '@/types/domain';
import { errorMessage, parseApiResponse } from '@/lib/api-client';
import { useToast } from '@/components/toast';

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ExpensesPanel() {
  const [businessDate, setBusinessDate] = useState(todayDateString());
  const [ledger, setLedger] = useState<LedgerDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const [expenseCategory, setExpenseCategory] = useState('Operativo');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

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

  async function createExpense(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessDate, categoria: expenseCategory, descripcion: expenseDescription, monto: Number(expenseAmount) }),
      }).then(parseApiResponse);
      setExpenseDescription('');
      setExpenseAmount('');
      toast.success('Gasto registrado');
      await fetchLedger();
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo registrar el gasto');
    } finally {
      setLoading(false);
    }
  }

  async function removeEntry(id: string) {
    try {
      setLoading(true);
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' }).then(parseApiResponse);
      toast.success('Gasto eliminado');
      await fetchLedger();
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo eliminar el gasto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <h1>Reportar gastos</h1>
      <p>Registrar gastos y ver el histórico del día seleccionado.</p>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <label style={{ gridColumn: 'span 4' }}>
            Fecha de negocio
            <input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
          </label>
          <div style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
            <button className="btn-primary" type="button" onClick={() => void fetchLedger()}>
              Recargar
            </button>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <form onSubmit={(e) => void createExpense(e)} className="row">
          <label style={{ gridColumn: 'span 12' }}>
            Categoria
            <input value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} required />
          </label>
          <label style={{ gridColumn: 'span 12' }}>
            Descripcion
            <input value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} required />
          </label>
          <label style={{ gridColumn: 'span 12' }}>
            Monto
            <input value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} type="number" step="0.01" required />
          </label>
          <div style={{ gridColumn: 'span 12', marginTop: 8 }}>
            <button className="btn-primary" type="submit">
              Registrar gasto
            </button>
          </div>
        </form>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h3>Gastos del día</h3>
        <table className="table-like" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Monto</th>
              <th>Acción</th>
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
                  <button className="btn-danger" onClick={() => void removeEntry(item.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {loading ? <p className="status-line">Sincronizando…</p> : null}
    </main>
  );
}
