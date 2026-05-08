import Link from 'next/link';

export default function SalesPage() {
  return (
    <main className="page-shell">
      <h1>Ventas</h1>
      <p>Gestión de ventas. Aquí integrarás formularios y listados de ventas.</p>
      <div style={{ marginTop: 18 }}>
        <Link href="/">← Volver al Dashboard</Link>
      </div>
    </main>
  );
}
