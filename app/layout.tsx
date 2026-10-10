import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import SiteHeader from '@/components/site-header';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'R Control',
  description: 'Control diario de compras, ventas y gastos.',
  icons: {
    icon: '/icon.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#efede7' },
    { media: '(prefers-color-scheme: dark)', color: '#171816' },
  ],
};

// Aplica el tema guardado antes del primer pintado para evitar el parpadeo claro/oscuro.
const themeInitScript = `(function(){try{var t=localStorage.getItem('rcontrol-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${geist.variable} ${geistMono.variable}`}>
        <div className="app-shell">
          <SiteHeader />
          <div className="app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
