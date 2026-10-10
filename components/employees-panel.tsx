'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiResponse } from '@/types/api';
import type {
  AttendanceDTO,
  EmployeeAdvanceDTO,
  EmployeeDTO,
  EmployeePaymentDTO,
  PayrollDTO,
} from '@/types/domain';
import { useRoleGuard } from '@/lib/use-role-guard';

async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDateString() {
  return toDateString(new Date());
}

function parseLocalDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateStr: string, days: number) {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

function mondayOf(dateStr: string) {
  const dayOfWeek = parseLocalDate(dateStr).getDay();
  return addDays(dateStr, dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
}

function money(value: number) {
  return `L ${value.toFixed(2)}`;
}

type Section = 'planilla' | 'asistencia' | 'movimientos' | 'empleados';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'planilla', label: 'Planilla' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'movimientos', label: 'Adelantos y pagos' },
  { id: 'empleados', label: 'Empleados' },
];

type EmployeeForm = {
  nombre: string;
  puesto: string;
  telefono: string;
  salarioDiario: string;
  fechaIngreso: string;
};

const emptyEmployeeForm = (): EmployeeForm => ({
  nombre: '',
  puesto: '',
  telefono: '',
  salarioDiario: '',
  fechaIngreso: todayDateString(),
});

type MovementForm = {
  tipo: 'adelanto' | 'pago';
  employeeId: string;
  businessDate: string;
  monto: string;
  descripcion: string;
};

const emptyMovementForm = (): MovementForm => ({
  tipo: 'adelanto',
  employeeId: '',
  businessDate: todayDateString(),
  monto: '',
  descripcion: '',
});

type AttendanceDraft = { horaEntrada: string; horaSalida: string };

export default function EmployeesPanel() {
  const roleGuardStatus = useRoleGuard((role) => role === 'admin' || role === 'editor');
  const [section, setSection] = useState<Section>('planilla');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<EmployeeDTO[]>([]);

  // --- Planilla ---
  const [weekStart, setWeekStart] = useState(mondayOf(todayDateString()));
  const [payroll, setPayroll] = useState<PayrollDTO | null>(null);
  const [payDate, setPayDate] = useState(todayDateString());
  const [discounts, setDiscounts] = useState<Record<string, string>>({});

  // --- Asistencia ---
  const [attendanceDate, setAttendanceDate] = useState(todayDateString());
  const [attendances, setAttendances] = useState<AttendanceDTO[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({});

  // --- Movimientos ---
  const [movementForm, setMovementForm] = useState<MovementForm>(emptyMovementForm);
  const [advances, setAdvances] = useState<EmployeeAdvanceDTO[]>([]);
  const [payments, setPayments] = useState<EmployeePaymentDTO[]>([]);

  // --- Empleados ---
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(emptyEmployeeForm);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

  const activeEmployees = useMemo(() => employees.filter((e) => e.activo), [employees]);

  const run = useCallback(async (action: () => Promise<void>, fallback: string) => {
    try {
      setLoading(true);
      await action();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBase = useCallback(async () => {
    const data = await fetch('/api/employees', { cache: 'no-store' }).then((res) =>
      parseApiResponse<EmployeeDTO[]>(res),
    );
    setEmployees(data);
  }, []);

  const fetchPayroll = useCallback(async () => {
    const data = await fetch(`/api/payroll?periodoInicio=${weekStart}`, { cache: 'no-store' }).then((res) =>
      parseApiResponse<PayrollDTO>(res),
    );
    setPayroll(data);
    setDiscounts(Object.fromEntries(data.rows.map((row) => [row.employeeId, row.adelantosAplicables.toFixed(2)])));
  }, [weekStart]);

  const fetchAttendance = useCallback(async () => {
    const params = new URLSearchParams({ businessDate: attendanceDate });
    const data = await fetch(`/api/attendance?${params}`, { cache: 'no-store' }).then((res) =>
      parseApiResponse<AttendanceDTO[]>(res),
    );
    setAttendances(data);
    setDrafts(
      Object.fromEntries(
        data.map((item) => [item.employeeId, { horaEntrada: item.horaEntrada, horaSalida: item.horaSalida ?? '' }]),
      ),
    );
  }, [attendanceDate]);

  const fetchMovements = useCallback(async () => {
    const from = addDays(todayDateString(), -60);
    const [advancesData, paymentsData] = await Promise.all([
      fetch('/api/employee-advances', { cache: 'no-store' }).then((res) =>
        parseApiResponse<EmployeeAdvanceDTO[]>(res),
      ),
      fetch(`/api/employee-payments?from=${from}`, { cache: 'no-store' }).then((res) =>
        parseApiResponse<EmployeePaymentDTO[]>(res),
      ),
    ]);
    // Los adelantos ya saldados y antiguos no aportan nada a la vista.
    setAdvances(advancesData.filter((a) => a.pendiente > 0 || a.businessDate >= from));
    setPayments(paymentsData);
  }, []);

  useEffect(() => {
    if (roleGuardStatus !== 'allowed') return;
    void run(fetchBase, 'Error cargando empleados');
  }, [roleGuardStatus, run, fetchBase]);

  useEffect(() => {
    if (roleGuardStatus !== 'allowed') return;
    if (section === 'planilla') void run(fetchPayroll, 'Error cargando planilla');
    if (section === 'asistencia') void run(fetchAttendance, 'Error cargando asistencia');
    if (section === 'movimientos') void run(fetchMovements, 'Error cargando movimientos');
  }, [roleGuardStatus, section, run, fetchPayroll, fetchAttendance, fetchMovements]);

  async function send(url: string, method: string, body?: unknown) {
    return fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then((res) => parseApiResponse(res));
  }

  // --- Planilla ---

  function payEmployee(employeeId: string) {
    void run(async () => {
      await send('/api/payroll/pay', 'POST', {
        employeeId,
        periodoInicio: weekStart,
        businessDate: payDate,
        adelantosAplicar: Number(discounts[employeeId] || 0),
      });
      await fetchPayroll();
    }, 'Error pagando planilla');
  }

  function revertPayment(paymentId: string, after: () => Promise<void>) {
    if (!window.confirm('¿Revertir este pago? Se devolverán los adelantos descontados y se eliminará el gasto.')) return;
    void run(async () => {
      await send(`/api/employee-payments/${paymentId}`, 'DELETE');
      await after();
    }, 'Error revirtiendo pago');
  }

  const payrollTotals = useMemo(() => {
    const rows = payroll?.rows ?? [];
    return rows.reduce(
      (acc, row) => {
        const descuento = row.payment ? (row.payment.adelantosAplicados ?? 0) : Number(discounts[row.employeeId] || 0);
        acc.subtotal += row.payment ? (row.payment.subtotal ?? 0) : row.subtotal;
        acc.descuentos += descuento;
        acc.neto += row.payment ? row.payment.monto : row.subtotal - descuento;
        return acc;
      },
      { subtotal: 0, descuentos: 0, neto: 0 },
    );
  }, [payroll, discounts]);

  // --- Asistencia ---

  function saveAttendance(employeeId: string) {
    const draft = drafts[employeeId];
    if (!draft?.horaEntrada) {
      setError('Ingrese la hora de entrada');
      return;
    }
    void run(async () => {
      await send('/api/attendance', 'POST', {
        employeeId,
        businessDate: attendanceDate,
        horaEntrada: draft.horaEntrada,
        horaSalida: draft.horaSalida || null,
      });
      await fetchAttendance();
    }, 'Error guardando asistencia');
  }

  function removeAttendance(id: string) {
    void run(async () => {
      await send(`/api/attendance/${id}`, 'DELETE');
      await fetchAttendance();
    }, 'Error eliminando asistencia');
  }

  function setDraft(employeeId: string, patch: Partial<AttendanceDraft>) {
    setDrafts((current) => ({
      ...current,
      [employeeId]: { ...(current[employeeId] ?? { horaEntrada: '', horaSalida: '' }), ...patch },
    }));
  }

  // --- Movimientos ---

  function submitMovement(event: React.FormEvent) {
    event.preventDefault();
    const employee = employees.find((e) => e.id === movementForm.employeeId);
    if (!employee) {
      setError('Seleccione un empleado');
      return;
    }
    void run(async () => {
      await send(movementForm.tipo === 'adelanto' ? '/api/employee-advances' : '/api/employee-payments', 'POST', {
        employeeId: employee.id,
        businessDate: movementForm.businessDate,
        monto: Number(movementForm.monto),
        descripcion: movementForm.descripcion,
      });
      setMovementForm((current) => ({ ...emptyMovementForm(), tipo: current.tipo, businessDate: current.businessDate }));
      await fetchMovements();
    }, 'Error registrando movimiento');
  }

  function removeAdvance(id: string) {
    if (!window.confirm('¿Eliminar este adelanto? También se eliminará el gasto asociado.')) return;
    void run(async () => {
      await send(`/api/employee-advances/${id}`, 'DELETE');
      await fetchMovements();
    }, 'Error eliminando adelanto');
  }

  // --- Empleados ---

  function submitEmployee(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body = {
        nombre: employeeForm.nombre,
        puesto: employeeForm.puesto,
        telefono: employeeForm.telefono,
        salarioDiario: Number(employeeForm.salarioDiario),
        fechaIngreso: employeeForm.fechaIngreso,
      };
      if (editingEmployeeId) {
        await send(`/api/employees/${editingEmployeeId}`, 'PATCH', body);
      } else {
        await send('/api/employees', 'POST', body);
      }
      setEmployeeForm(emptyEmployeeForm());
      setEditingEmployeeId(null);
      await fetchBase();
    }, 'Error guardando empleado');
  }

  function editEmployee(employee: EmployeeDTO) {
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      nombre: employee.nombre,
      puesto: employee.puesto ?? '',
      telefono: employee.telefono ?? '',
      salarioDiario: String(employee.salarioDiario),
      fechaIngreso: employee.fechaIngreso,
    });
  }

  function toggleEmployee(employee: EmployeeDTO) {
    void run(async () => {
      await send(`/api/employees/${employee.id}`, 'PATCH', { activo: !employee.activo });
      await fetchBase();
    }, 'Error actualizando empleado');
  }

  function removeEmployee(employee: EmployeeDTO) {
    if (!window.confirm(`¿Eliminar a ${employee.nombre}?`)) return;
    void run(async () => {
      await send(`/api/employees/${employee.id}`, 'DELETE');
      await fetchBase();
    }, 'Error eliminando empleado');
  }

  if (roleGuardStatus !== 'allowed') {
    return (
      <main className="page-shell">
        <p className="status-line">Verificando permisos…</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <h1>Empleados</h1>
        <p>Personal, asistencia, adelantos y planilla semanal.</p>
      </section>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={section === s.id ? 'btn-primary' : 'btn-secondary'}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="card" style={{ color: 'var(--danger)', marginBottom: 12 }}>
          {error}
        </p>
      ) : null}

      {/* ── PLANILLA ── */}
      {section === 'planilla' ? (
        <section className="card">
          <div className="card-head">
            <h3>
              Semana {payroll?.periodoInicio ?? weekStart} al {payroll?.periodoFin ?? addDays(weekStart, 6)}
            </h3>
            <div className="card-actions">
              <button type="button" className="btn-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                ← Anterior
              </button>
              <button type="button" className="btn-secondary" onClick={() => setWeekStart(mondayOf(todayDateString()))}>
                Esta semana
              </button>
              <button type="button" className="btn-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                Siguiente →
              </button>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <label style={{ gridColumn: 'span 3' }}>
              Semana del
              <input
                type="date"
                value={weekStart}
                onChange={(e) => e.target.value && setWeekStart(mondayOf(e.target.value))}
              />
            </label>
            <label style={{ gridColumn: 'span 3' }}>
              Fecha de pago
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </label>
          </div>

          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="table-like">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th className="num">Días</th>
                  <th className="num">Salario diario</th>
                  <th className="num">Subtotal</th>
                  <th className="num">Adelantos pend.</th>
                  <th className="num">Descontar</th>
                  <th className="num">Neto</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {payroll?.rows.map((row) => {
                  const descuento = Number(discounts[row.employeeId] || 0);
                  return (
                    <tr key={row.employeeId}>
                      <td>{row.employeeNombre}</td>
                      <td className="num">{row.payment ? row.payment.diasTrabajados : row.diasTrabajados}</td>
                      <td className="num">{money(row.salarioDiario)}</td>
                      <td className="num">{money(row.payment ? (row.payment.subtotal ?? 0) : row.subtotal)}</td>
                      <td className="num">{money(row.adelantosPendientes)}</td>
                      <td className="num">
                        {row.payment ? (
                          money(row.payment.adelantosAplicados ?? 0)
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={row.adelantosAplicables}
                            value={discounts[row.employeeId] ?? ''}
                            disabled={row.adelantosAplicables === 0}
                            onChange={(e) => setDiscounts((d) => ({ ...d, [row.employeeId]: e.target.value }))}
                            style={{ width: 110, textAlign: 'right' }}
                          />
                        )}
                      </td>
                      <td className="num">
                        <strong>{money(row.payment ? row.payment.monto : row.subtotal - descuento)}</strong>
                      </td>
                      <td>
                        {row.payment ? (
                          <>
                            <div className="sub-num">Pagado {row.payment.businessDate}</div>
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => revertPayment(row.payment!.id, fetchPayroll)}
                            >
                              Revertir
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={loading || row.diasTrabajados === 0}
                            onClick={() => payEmployee(row.employeeId)}
                          >
                            Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {payroll && payroll.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No hay empleados para esta semana.</td>
                  </tr>
                ) : null}
              </tbody>
              {payroll && payroll.rows.length > 0 ? (
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total</td>
                    <td className="num">{money(payrollTotals.subtotal)}</td>
                    <td />
                    <td className="num">{money(payrollTotals.descuentos)}</td>
                    <td className="num">{money(payrollTotals.neto)}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: '0.82rem' }}>
            Días trabajados = días con asistencia registrada. El neto pagado se registra como gasto de la fecha de pago.
          </p>
        </section>
      ) : null}

      {/* ── ASISTENCIA ── */}
      {section === 'asistencia' ? (
        <section className="card">
          <div className="row">
            <label style={{ gridColumn: 'span 3' }}>
              Fecha
              <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
            </label>
          </div>

          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="table-like">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.map((employee) => {
                  const record = attendances.find((a) => a.employeeId === employee.id);
                  const draft = drafts[employee.id] ?? { horaEntrada: '', horaSalida: '' };
                  return (
                    <tr key={employee.id}>
                      <td>
                        {employee.nombre}
                        {record ? <div className="sub-num">Registrado</div> : null}
                      </td>
                      <td>
                        <input
                          type="time"
                          value={draft.horaEntrada}
                          onChange={(e) => setDraft(employee.id, { horaEntrada: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={draft.horaSalida}
                          onChange={(e) => setDraft(employee.id, { horaSalida: e.target.value })}
                        />
                      </td>
                      <td>
                        <div className="card-actions">
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={loading}
                            onClick={() => saveAttendance(employee.id)}
                          >
                            {record ? 'Actualizar' : 'Registrar'}
                          </button>
                          {record ? (
                            <button type="button" className="btn-danger" onClick={() => removeAttendance(record.id)}>
                              Quitar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {activeEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No hay empleados activos.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ── ADELANTOS Y PAGOS ── */}
      {section === 'movimientos' ? (
        <>
          <section className="card">
            <h3>Registrar movimiento</h3>
            <form onSubmit={submitMovement} className="row">
              <label style={{ gridColumn: 'span 3' }}>
                Tipo
                <select
                  value={movementForm.tipo}
                  onChange={(e) =>
                    setMovementForm((f) => ({ ...f, tipo: e.target.value as MovementForm['tipo'] }))
                  }
                >
                  <option value="adelanto">Adelanto</option>
                  <option value="pago">Pago manual</option>
                </select>
              </label>
              <label style={{ gridColumn: 'span 5' }}>
                Empleado
                <select
                  value={movementForm.employeeId}
                  onChange={(e) => setMovementForm((f) => ({ ...f, employeeId: e.target.value }))}
                  required
                >
                  <option value="">Seleccione…</option>
                  {activeEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ gridColumn: 'span 4' }}>
                Fecha
                <input
                  type="date"
                  value={movementForm.businessDate}
                  onChange={(e) => setMovementForm((f) => ({ ...f, businessDate: e.target.value }))}
                  required
                />
              </label>
              <label style={{ gridColumn: 'span 4' }}>
                Monto
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={movementForm.monto}
                  onChange={(e) => setMovementForm((f) => ({ ...f, monto: e.target.value }))}
                  required
                />
              </label>
              <label style={{ gridColumn: 'span 8' }}>
                Descripción
                <input
                  value={movementForm.descripcion}
                  onChange={(e) => setMovementForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </label>
              <div style={{ gridColumn: 'span 12' }}>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {movementForm.tipo === 'adelanto' ? 'Registrar adelanto' : 'Registrar pago'}
                </button>
              </div>
            </form>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h3>Adelantos</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-like">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Empleado</th>
                    <th className="num">Monto</th>
                    <th className="num">Descontado</th>
                    <th className="num">Pendiente</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {advances.map((advance) => (
                    <tr key={advance.id}>
                      <td>{advance.businessDate}</td>
                      <td>
                        {advance.employeeNombre}
                        {advance.descripcion ? <div className="sub-num">{advance.descripcion}</div> : null}
                      </td>
                      <td className="num">{money(advance.monto)}</td>
                      <td className="num">{money(advance.montoAplicado)}</td>
                      <td className="num">
                        <strong>{money(advance.pendiente)}</strong>
                      </td>
                      <td>
                        {advance.montoAplicado === 0 ? (
                          <button type="button" className="btn-danger" onClick={() => removeAdvance(advance.id)}>
                            Eliminar
                          </button>
                        ) : (
                          <span className="muted">En planilla</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {advances.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Sin adelantos recientes ni pendientes.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h3>Pagos (últimos 60 días)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-like">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Empleado</th>
                    <th>Tipo</th>
                    <th className="num">Monto</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.businessDate}</td>
                      <td>
                        {payment.employeeNombre}
                        {payment.descripcion ? <div className="sub-num">{payment.descripcion}</div> : null}
                      </td>
                      <td>
                        {payment.tipo === 'planilla' ? 'Planilla' : 'Manual'}
                        {payment.tipo === 'planilla' ? (
                          <div className="sub-num">
                            {payment.diasTrabajados} días · adelantos {money(payment.adelantosAplicados ?? 0)}
                          </div>
                        ) : null}
                      </td>
                      <td className="num">{money(payment.monto)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => revertPayment(payment.id, fetchMovements)}
                        >
                          Revertir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Sin pagos en los últimos 60 días.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {/* ── EMPLEADOS ── */}
      {section === 'empleados' ? (
        <>
          <section className="card">
            <h3>{editingEmployeeId ? 'Editar empleado' : 'Nuevo empleado'}</h3>
            <form onSubmit={submitEmployee} className="row">
              <label style={{ gridColumn: 'span 6' }}>
                Nombre
                <input
                  value={employeeForm.nombre}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, nombre: e.target.value }))}
                  required
                />
              </label>
              <label style={{ gridColumn: 'span 6' }}>
                Puesto
                <input
                  value={employeeForm.puesto}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, puesto: e.target.value }))}
                />
              </label>
              <label style={{ gridColumn: 'span 4' }}>
                Teléfono
                <input
                  value={employeeForm.telefono}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </label>
              <label style={{ gridColumn: 'span 4' }}>
                Salario diario
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={employeeForm.salarioDiario}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, salarioDiario: e.target.value }))}
                  required
                />
              </label>
              <label style={{ gridColumn: 'span 4' }}>
                Fecha de ingreso
                <input
                  type="date"
                  value={employeeForm.fechaIngreso}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, fechaIngreso: e.target.value }))}
                  required
                />
              </label>
              <div style={{ gridColumn: 'span 12' }} className="card-actions">
                <button type="submit" className="btn-primary" disabled={loading}>
                  {editingEmployeeId ? 'Guardar cambios' : 'Agregar empleado'}
                </button>
                {editingEmployeeId ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setEditingEmployeeId(null);
                      setEmployeeForm(emptyEmployeeForm());
                    }}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h3>Personal</h3>
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table className="table-like">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th className="num">Salario diario</th>
                    <th>Ingreso</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} style={employee.activo ? undefined : { opacity: 0.6 }}>
                      <td>
                        {employee.nombre}
                        <div className="sub-num">
                          {[employee.puesto, employee.telefono].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="num">{money(employee.salarioDiario)}</td>
                      <td>{employee.fechaIngreso}</td>
                      <td>{employee.activo ? 'Activo' : 'Inactivo'}</td>
                      <td>
                        <div className="card-actions">
                          <button type="button" className="btn-secondary" onClick={() => editEmployee(employee)}>
                            Editar
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => toggleEmployee(employee)}>
                            {employee.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button type="button" className="btn-danger" onClick={() => removeEmployee(employee)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No hay empleados registrados.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {loading ? <p className="status-line">Sincronizando…</p> : null}
    </main>
  );
}
