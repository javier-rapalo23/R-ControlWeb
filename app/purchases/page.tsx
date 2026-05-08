import Link from 'next/link';

export default function PurchasesPage() {
  return (
    <main className="page-shell">
      <h1>Compras</h1>
      <p>Gestión de compras. Aquí integrarás formularios y listados de compras.</p>
      <div style={{ marginTop: 18 }}>
        <Link href="/">← Volver al Dashboard</Link>
      </div>
    </main>
  );
}
