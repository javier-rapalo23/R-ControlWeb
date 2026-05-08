import type { Metadata } from 'next';
import Link from 'next/link';
import { Space_Grotesk, Newsreader } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-news',
});

export const metadata: Metadata = {
  title: 'R Control | Ledger Diario',
  description: 'Control diario de compras, ventas y gastos.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${spaceGrotesk.variable} ${newsreader.variable}`}>
        <header className="site-header">
          <div className="site-row">
            <div className="brand">R Control</div>
            <nav className="nav">
              <Link href="/">Dashboard</Link>
              <Link href="/purchases">Compras</Link>
              <Link href="/sales">Ventas</Link>
              <Link href="/expenses">Reportar gastos</Link>
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}