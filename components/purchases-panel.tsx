'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ClientDTO, CompanySettingsDTO, LedgerDTO, MaterialDTO, PurchaseTransactionDTO } from '@/types/domain';
import { usePrintMode } from '@/lib/use-print-mode';
import { printTicketInBrowser } from '@/lib/print-html';
import { errorMessage, parseApiResponse, PRINTER_TIMEOUT_MESSAGE } from '@/lib/api-client';
import { useToast } from '@/components/toast';

type CartItem = {
  id: string;
  materialId: string;
  materialNombre: string;
  libras: string;
  precioPorLibra: string;
};

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function decimalOrZero(input: string) {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

export default function PurchasesPanel() {
  const [businessDate, setBusinessDate] = useState(todayDateString());
  const [ledger, setLedger] = useState<LedgerDTO | null>(null);
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [transactions, setTransactions] = useState<PurchaseTransactionDTO[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printMode, setPrintMode] = usePrintMode();
  const [company, setCompany] = useState<CompanySettingsDTO | null>(null);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');

  const [itemMaterialId, setItemMaterialId] = useState('');
  const [itemLibras, setItemLibras] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  const fetchMaterials = useCallback(async () => {
    const response = await fetch('/api/materials', { cache: 'no-store' });
    const data = await parseApiResponse<MaterialDTO[]>(response);
    setMaterials(data);

    if (!itemMaterialId && data.length > 0) {
      setItemMaterialId(data[0].id);
      setItemPrice(String(Number(data[0].precioPorLibra).toFixed(2)));
    }
  }, [itemMaterialId]);

  const fetchClients = useCallback(async () => {
    const response = await fetch('/api/clients', { cache: 'no-store' });
    const data = await parseApiResponse<ClientDTO[]>(response);
    setClients(data);

    if (!selectedClientId && data.length > 0) {
      setSelectedClientId(data[0].id);
    }
  }, [selectedClientId]);

  const fetchLedger = useCallback(async () => {
    const response = await fetch(`/api/ledger?businessDate=${businessDate}`, { cache: 'no-store' });
    const data = await parseApiResponse<LedgerDTO>(response);
    setLedger(data);
  }, [businessDate]);

  const fetchTransactions = useCallback(async () => {
    const response = await fetch(`/api/purchase-transactions?businessDate=${businessDate}`, { cache: 'no-store' });
    const data = await parseApiResponse<{ businessDate: string | null; transactions: PurchaseTransactionDTO[] }>(response);
    setTransactions(data.transactions);
  }, [businessDate]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchMaterials(), fetchClients(), fetchLedger(), fetchTransactions()]);
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudieron cargar las compras');
    } finally {
      setLoading(false);
    }
  }, [fetchClients, fetchLedger, fetchMaterials, fetchTransactions, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    fetch('/api/settings/company', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: { ok: boolean; data?: CompanySettingsDTO }) => {
        if (body.ok && body.data) setCompany(body.data);
      })
      .catch(() => undefined);
  }, []);

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const libras = decimalOrZero(item.libras);
        const precioPorLibra = decimalOrZero(item.precioPorLibra);
        return sum + libras * precioPorLibra;
      }, 0),
    [cart],
  );

  async function createClient(event: FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nombre: newClientName }),
      });
      const client = await parseApiResponse<ClientDTO>(response);
      setClients((current) => [client, ...current]);
      setSelectedClientId(client.id);
      setNewClientName('');
      toast.success(`Cliente ${client.nombre} creado`);
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo crear el cliente');
    } finally {
      setLoading(false);
    }
  }

  function addItemToCart(event: FormEvent) {
    event.preventDefault();

    const material = materials.find((entry) => entry.id === itemMaterialId);
    if (!material) {
      toast.error('Elige un material de la lista.', 'Selecciona un material válido');
      return;
    }

    const precioPorLibra = itemPrice || String(Number(material.precioPorLibra).toFixed(2));

    setCart((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        materialId: material.id,
        materialNombre: material.nombre,
        libras: itemLibras,
        precioPorLibra,
      },
    ]);

    setItemLibras('');
    setItemPrice(String(Number(material.precioPorLibra).toFixed(2)));
  }

  function updateCartItem(id: string, field: 'libras' | 'precioPorLibra', value: string) {
    setCart((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeCartItem(id: string) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  async function saveTransaction(event: FormEvent) {
    event.preventDefault();

    if (!selectedClientId) {
      toast.error('Elige el cliente de esta compra.', 'Selecciona un cliente');
      return;
    }

    if (cart.length === 0) {
      toast.error('El carrito está vacío.', 'Agrega al menos un material');
      return;
    }

    try {
      setLoading(true);
      await fetch('/api/purchase-transactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessDate,
          clientId: selectedClientId,
          items: cart.map((item) => ({
            materialId: item.materialId,
            libras: Number(item.libras),
            precioPorLibra: Number(item.precioPorLibra),
          })),
        }),
      }).then(parseApiResponse);

      setCart([]);
      toast.success('Compra guardada');
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo guardar la compra');
    } finally {
      setLoading(false);
    }
  }

  async function printTicket(transaction: PurchaseTransactionDTO) {
    try {
      setPrintingId(transaction.id);

      if (printMode === 'browser') {
        printTicketInBrowser({
          company: {
            nombre: company?.nombre ?? '',
            rtn: company?.rtn,
            telefono: company?.telefono,
            direccion: company?.direccion,
          },
          businessDate: transaction.businessDate,
          clientNombre: transaction.client.nombre,
          items: transaction.items.map((item) => ({
            materialNombre: item.materialNombre,
            libras: item.libras,
            precioPorLibra: item.precioPorLibra,
            total: item.total,
          })),
          total: transaction.total,
        });
        return;
      }

      if (printMode === 'rawbt') {
        const { payloadB64 } = await fetch(`/api/print/ticket/data?transactionId=${transaction.id}`, {
          cache: 'no-store',
        }).then(parseApiResponse<{ payloadB64: string }>);
        window.location.href = `rawbt:base64,${payloadB64}`;
        return;
      }

      const { jobId } = await fetch('/api/print/ticket', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionId: transaction.id }),
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
        toast.success('Ticket impreso');
      } else if (status === 'error') {
        toast.error(jobError || 'La impresora reportó un error.', 'No se pudo imprimir el ticket');
      } else if (status !== 'done') {
        toast.error(PRINTER_TIMEOUT_MESSAGE, 'No se pudo imprimir el ticket');
      }
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo imprimir el ticket');
    } finally {
      setPrintingId(null);
    }
  }

  async function deleteTransaction(id: string) {
    try {
      setLoading(true);
      await fetch(`/api/purchase-transactions/${id}`, { method: 'DELETE' }).then(parseApiResponse);
      await refresh();
      toast.success('Compra eliminada');
    } catch (err) {
      toast.error(errorMessage(err), 'No se pudo eliminar la compra');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <h1>Compras por cliente</h1>
        <p>Selecciona un cliente, agrega varios materiales al carrito y guarda la transacción completa.</p>
      </section>

      <section className="card-grid">
        <article className="card wide">
          <div className="row">
            <label style={{ gridColumn: 'span 3' }}>
              Fecha de negocio
              <input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
            </label>
            <div style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
              <button className="btn-primary" onClick={() => void refresh()} type="button">
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
          <div className="label">Transacciones</div>
          <div className="value"> {transactions.length}</div>
        </article>

        <article className="card wide">
          <h3>Cliente</h3>
          <form onSubmit={(event) => void createClient(event)} className="row" style={{ marginTop: 8 }}>
            <label style={{ gridColumn: 'span 8' }}>
              Nuevo cliente
              <input value={newClientName} onChange={(event) => setNewClientName(event.target.value)} placeholder="Nombre del cliente" />
            </label>
            <div style={{ gridColumn: 'span 4', alignSelf: 'end' }}>
              <button className="btn-primary" type="submit">
                Crear cliente
              </button>
            </div>
          </form>
          <label style={{ marginTop: 12 }}>
            Cliente para la compra
            <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.esGeneral ? `${client.nombre} (general)` : client.nombre}
                </option>
              ))}
            </select>
          </label>
        </article>

        <article className="card wide">
          <h3>Agregar item al carrito</h3>

          <div className="material-grid">
            {materials.map((material) => {
              const selected = itemMaterialId === material.id;
              return (
                <button
                  key={material.id}
                  type="button"
                  className={`material-chip${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => {
                    setItemMaterialId(material.id);
                    setItemPrice(String(Number(material.precioPorLibra).toFixed(2)));
                  }}
                >
                  <span className="material-chip__name">{material.nombre}</span>
                  <span className="material-chip__price">L {Number(material.precioPorLibra).toFixed(2)} / lb</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={(event) => void addItemToCart(event)} className="row" style={{ marginTop: 14 }}>
            <label style={{ gridColumn: 'span 6' }}>
              Libras
              <input value={itemLibras} onChange={(event) => setItemLibras(event.target.value)} type="number" step="0.01" required />
            </label>
            <label style={{ gridColumn: 'span 6' }}>
              Precio por libra
              <input value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} type="number" step="0.01" required />
            </label>
            <div style={{ gridColumn: 'span 12' }}>
              <button className="btn-primary" type="submit" disabled={!itemMaterialId}>
                Agregar al carrito
              </button>
            </div>
          </form>
        </article>

        <article className="card wide">
          <h3>Carrito de compra</h3>
          <div className="cart-list">
            {cart.length === 0 ? (
              <p className="empty-note">Elige un material y agrega las libras para empezar la compra.</p>
            ) : (
              cart.map((item) => {
                const subtotal = decimalOrZero(item.libras) * decimalOrZero(item.precioPorLibra);
                return (
                  <div key={item.id} className="cart-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <strong style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.materialNombre}</strong>
                      <button
                        className="btn-danger cart-item-remove"
                        onClick={() => removeCartItem(item.id)}
                        type="button"
                        style={{ flexShrink: 0, padding: '4px 10px', fontSize: 12 }}
                      >
                        Eliminar
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <label style={{ flex: '1 1 100px' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>Libras</span>
                        <input
                          value={item.libras}
                          onChange={(event) => updateCartItem(item.id, 'libras', event.target.value)}
                          type="number"
                          step="0.01"
                        />
                      </label>
                      <label style={{ flex: '1 1 100px' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>Precio / libra</span>
                        <input
                          value={item.precioPorLibra}
                          onChange={(event) => updateCartItem(item.id, 'precioPorLibra', event.target.value)}
                          type="number"
                          step="0.01"
                        />
                      </label>
                      <div style={{ flex: '1 1 80px', alignSelf: 'flex-end', paddingBottom: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>Subtotal</div>
                        <strong className="num">L {subtotal.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="cart-total">
            <div>
              <div className="label">Total carrito</div>
              <strong>L {cartTotal.toFixed(2)}</strong>
            </div>
            <button className="btn-primary" type="button" onClick={(event) => void saveTransaction(event as unknown as FormEvent)}>
              Guardar compra por cliente
            </button>
          </div>
        </article>

        <article className="card wide">
          <div className="card-head">
            <h3>Transacciones del día</h3>
            <label className="inline-field">
              Impresión en este dispositivo
              <select value={printMode} onChange={(e) => setPrintMode(e.target.value as typeof printMode)}>
                <option value="queue">Impresora de red (sin vista previa)</option>
                <option value="rawbt">RawBT (Android)</option>
                <option value="browser">Diálogo del navegador (con vista previa)</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            {transactions.length === 0 ? <p className="empty-note">No hay transacciones registradas para esta fecha.</p> : null}
            {transactions.map((transaction) => (
              <article key={transaction.id} className="card" style={{ background: 'var(--surface-alt)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{transaction.client.nombre}</strong>
                    <div style={{ color: 'var(--text-soft)' }}>{transaction.items.length} items</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong>L {transaction.total.toFixed(2)}</strong>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                      <button
                        className="btn-primary"
                        type="button"
                        disabled={printingId === transaction.id}
                        onClick={() => void printTicket(transaction)}
                      >
                        {printingId === transaction.id ? 'Imprimiendo...' : 'Imprimir'}
                      </button>
                      <button className="btn-danger" type="button" onClick={() => void deleteTransaction(transaction.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
                <table className="table-like" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Libras</th>
                      <th>Precio / libra</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaction.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.materialNombre}</td>
                        <td>{item.libras.toFixed(2)}</td>
                        <td>L {item.precioPorLibra.toFixed(2)}</td>
                        <td>L {item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
        </article>
      </section>

      {loading ? <p className="status-line">Sincronizando…</p> : null}
    </main>
  );
}
