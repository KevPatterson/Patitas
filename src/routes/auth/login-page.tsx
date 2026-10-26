import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { AuthCard } from '../../components/ui/auth-card';
import { Button, LinkButton } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { loginSchema, type LoginInput } from '../../lib/validations/auth';
import { signInWithPassword, signInWithGoogle } from '../../lib/supabase/auth';
import { loginErrorMessage } from '../../lib/auth/error-messages';
import { getPostLoginDestination } from '../../lib/supabase/profiles';
import { setPageMeta } from '../../lib/seo/page-meta';
import { safeInternalPath } from '../../lib/utils/safe-url';
import { useEffect } from 'react';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  // Destino posterior al login: solo rutas internas (evita open redirect).
  const requestedNext = searchParams.get('next');
  const next = safeInternalPath(requestedNext);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    setPageMeta({
      title: 'Iniciar sesión — Patitas',
      description: 'Accede a tu cuenta de Patitas para gestionar tus publicaciones y ayudar a que más mascotas vuelvan a casa.',
      canonicalPath: '/auth/login',
    });
  }, []);

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    try {
      await signInWithPassword(values.email, values.password);
      // Sin un destino explícito, el rol decide: admin/moderador va al panel.
      const destination = requestedNext ? next : await getPostLoginDestination();
      navigate(destination, { replace: true });
    } catch (error) {
      // Mensaje genérico: no se distingue "no existe" de "contraseña incorrecta"
      // ni de "correo sin confirmar" (evita enumeración de cuentas).
      setServerError(loginErrorMessage(error));
    }
  };

  const handleGoogle = async () => {
    setServerError(null);
    try {
      // El redirect de OAuth no admite query en la allowlist de Supabase: el
      // destino se guarda y /auth/callback lo recupera. Se marca aparte si el
      // usuario lo pidió explícitamente, porque sin `next` el callback debe
      // aplicar la redirección por rol.
      window.sessionStorage.setItem('patitas:auth-next', next);
      window.sessionStorage.setItem(
        'patitas:auth-next-explicit',
        requestedNext ? '1' : '0'
      );
      await signInWithGoogle();
    } catch (error) {
      setServerError(loginErrorMessage(error));
    }
  };

  return (
    <section className="grid min-h-[calc(100vh-8rem)] place-items-center py-10">
      <AuthCard
        eyebrow="Acceso"
        title="🐾 Bienvenido de vuelta"
        description="Hay muchas patitas esperando una historia feliz."
        footer={
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-3 text-sm text-foreground/70">
            <span>¿No tienes cuenta?</span>
            <LinkButton href="/auth/register" variant="secondary" className="text-sm font-bold">
              Crear cuenta
            </LinkButton>
          </div>
        }
      >
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <TextField 
            label="Correo" 
            type="email" 
            autoComplete="email" 
            placeholder="tu@correo.com" 
            error={errors.email?.message} 
            {...register('email')} 
          />
          <TextField 
            label="Contraseña" 
            type="password" 
            autoComplete="current-password" 
            placeholder="••••••••" 
            error={errors.password?.message} 
            {...register('password')} 
          />
          
          {serverError ? (
            <div className="rounded-xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm font-medium text-lost">
              {serverError}
            </div>
          ) : null}
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link className="text-sm font-semibold text-orange hover:text-orange-dark transition-colors" to="/auth/forgot-password">
              Olvidé mi contraseña
            </Link>
            <Button type="submit" variant="primary" disabled={isSubmitting} className="gap-2">
              <PawPrint className="size-4" />
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </div>
          
          <div className="relative py-4 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-foreground/10"></div>
            </div>
            <span className="relative bg-surface px-4 text-xs font-bold uppercase tracking-wider text-foreground/40">
              o
            </span>
          </div>
          
          <Button 
            type="button" 
            variant="secondary" 
            className="w-full justify-center gap-2 shadow-sm" 
            onClick={handleGoogle}
          >
            <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuar con Google
          </Button>
        </form>
      </AuthCard>
    </section>
  );
}
