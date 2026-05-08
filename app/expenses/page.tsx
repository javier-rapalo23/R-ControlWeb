import Link from 'next/link';

export default function ExpensesPage() {
  return (
    <main className="page-shell">
      <h1>Reportar gastos</h1>
      <p>Formulario para reportar gastos y ver históricos.</p>
      <div style={{ marginTop: 18 }}>
        <Link href="/">← Volver al Dashboard</Link>
      </div>
    </main>
  );
}
