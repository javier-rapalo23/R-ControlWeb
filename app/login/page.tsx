'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import rControlLogo from '../../R-CONTROL.png';
import { errorMessage } from '@/lib/api-client';
import { useToast } from '@/components/toast';

type LoginResponse =
  | {
      ok: true;
      data: { userId: string; role: string };
    }
  | {
      ok: false;
      error: { message?: string };
    };

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });

      const body = (await response.json()) as LoginResponse;
      if (!body.ok) {
        throw new Error(body.error.message ?? 'No se pudo iniciar sesión');
      }

      window.dispatchEvent(new Event('rcontrol-auth-changed'));
      router.replace(body.data.role === 'comprador' ? '/purchases' : '/');
      router.refresh();
    } catch (loginError) {
      toast.error(errorMessage(loginError, 'Revisa tu usuario y contraseña.'), 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell login-shell">
      <section className="login-card">
        <div className="login-brand">
          <Image src={rControlLogo} alt="R Control" width={64} height={64} priority />
          <div>
            <h1>Iniciar sesión</h1>
            <p>Usa el usuario y la contraseña que te asignó el administrador.</p>
          </div>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="login-form">
          <label>
            Usuario
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Contraseña
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </label>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}