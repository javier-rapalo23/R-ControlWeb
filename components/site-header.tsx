'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Receipt,
  Package,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  LogIn,
} from 'lucide-react';
import rControlLogo from '../R-CONTROL.png';

type AuthMe = {
  userId: string | null;
  role: string | null;
};

const navigationItems = [
  { href: '/', label: 'Dashboard', roles: ['admin', 'editor', 'viewer'], icon: LayoutDashboard },
  { href: '/purchases', label: 'Compras', roles: null, icon: ShoppingCart },
  { href: '/sales', label: 'Ventas', roles: null, icon: TrendingUp },
  { href: '/expenses', label: 'Reportar gastos', roles: null, icon: Receipt },
  { href: '/inventory', label: 'Inventario', roles: null, icon: Package },
  { href: '/maintenance', label: 'Mantenimiento', roles: ['admin'], icon: Settings },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthMe>({ userId: null, role: null });
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [theme, setTheme] = useState('light');
  const [mounted, setMounted] = useState(false);
  // --- LÓGICA DEL TEMA ---
  

  useEffect(() => {
  setMounted(true); // Avisamos que el componente ya está listo en el cliente
  
  const savedTheme = localStorage.getItem('rcontrol-theme');
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }
}, []);
useEffect(() => {
  if (mounted) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rcontrol-theme', theme);
  }
}, [theme, mounted]);

const toggleTheme = () => {
  setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
};

 

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        const body = (await response.json()) as { ok: boolean; data?: AuthMe };
        if (body.ok && body.data) {
          setAuthUser(body.data);
        }
      } catch {
        setAuthUser({ userId: null, role: null });
      }
    })();
  }, []);

  useEffect(() => {
    const syncAuth = () => {
      void (async () => {
        try {
          const response = await fetch('/api/auth/me', { cache: 'no-store' });
          const body = (await response.json()) as { ok: boolean; data?: AuthMe };
          if (body.ok && body.data) {
            setAuthUser(body.data);
            return;
          }
        } catch {
          // ignore and fall through
        }

        setAuthUser({ userId: null, role: null });
      })();
    };

    window.addEventListener('rcontrol-auth-changed', syncAuth);
    return () => window.removeEventListener('rcontrol-auth-changed', syncAuth);
  }, []);

  async function logout() {
    setLoadingAuth(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAuthUser({ userId: null, role: null });
      window.dispatchEvent(new Event('rcontrol-auth-changed'));
      router.push('/login');
    } finally {
      setLoadingAuth(false);
    }
  }

  return (
    <aside className="site-sidebar">
      <div className="sidebar-topbar">
        <Link href="/" className="brand brand--link" aria-label="Ir al inicio">
          <Image src={rControlLogo} width={40} height={40} className="brand-mark" alt="R Control" priority />
          <span>R Control</span>
        </Link>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={isOpen}
          aria-controls="main-navigation"
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          <span>{isOpen ? 'Cerrar' : 'Menú'}</span>
        </button>
      </div>

      <div
        className={`nav-backdrop ${isOpen ? 'nav-backdrop--open' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <nav id="main-navigation" className={`nav ${isOpen ? 'nav--open' : ''}`}>
        <div className="nav-links">
          {navigationItems
            .filter((item) => !item.roles || item.roles.includes(authUser.role ?? ''))
            .map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={isActive ? 'active' : ''}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </div>

        <div className="nav-footer">
          <div className="auth-panel">
            {authUser.userId ? (
              <>
                <div className="auth-pill">
                  <strong>{authUser.userId}</strong>
                  <span>{authUser.role}</span>
                </div>
                <button type="button" className="btn-secondary" onClick={() => void logout()} disabled={loadingAuth}>
                  <LogOut size={16} aria-hidden="true" />
                  Salir
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary auth-link">
                <LogIn size={16} aria-hidden="true" />
                Entrar
              </Link>
            )}
          </div>

          <button type="button" className="theme-toggle" aria-label="Cambiar tema" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </div>
      </nav>
    </aside>
  );
}