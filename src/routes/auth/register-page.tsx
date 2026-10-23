import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PawPrint } from 'lucide-react';
import { AuthCard } from '../../components/ui/auth-card';
import { Button, LinkButton } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { registerSchema, type RegisterInput } from '../../lib/validations/auth';
import { signUpWithPassword, signInWithGoogle } from '../../lib/supabase/auth';
import { loginErrorMessage, registerErrorMessage } from '../../lib/auth/error-messages';
import { setPageMeta } from '../../lib/seo/page-meta';

export function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    setPageMeta({
      title: 'Crear cuenta — Patitas',
      description: 'Únete a la comunidad de Patitas y ayuda a que más mascotas encuentren el camino a casa.',
      canonicalPath: '/auth/register',
    });
  }, []);

  const onSubmit = async (values: RegisterInput) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      await signUpWithPassword(values.email, values.password, {
        fullName: values.fullName,
        username: values.username.toLowerCase(),
      });
      setSuccessMessage('🎉 Cuenta creada. Revisa tu correo para verificar tu sesión.');
    } catch (error) {
      // No se confirma si el email ya estaba registrado: mismo mensaje siempre.
      setServerError(registerErrorMessage(error));
    }
  };

  const handleGoogle = async () => {
    setServerError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setServerError(loginErrorMessage(error));
    }
  };

  return (
    <section className="grid min-h-[calc(100vh-8rem)] place-items-center py-10">
      <AuthCard
        eyebrow="Registro"
        title="🐾 Únete a Patitas"
        description="Sé parte de la comunidad que ayuda a que las mascotas vuelvan a casa."
        footer={
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-3 text-sm text-foreground/70">
            <span>¿Ya tienes cuenta?</span>
            <LinkButton href="/auth/login" variant="secondary" className="text-sm font-bold">
              Entrar
            </LinkButton>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <TextField 
            label="Nombre" 
            autoComplete="name" 
            placeholder="Tu nombre" 
            error={errors.fullName?.message} 
            {...register('fullName')} 
          />
          <TextField 
            label="Usuario" 
            autoComplete="username" 
            placeholder="tu_usuario" 
            error={errors.username?.message} 
            {...register('username')} 
          />
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
            autoComplete="new-password" 
            placeholder="Mínimo 8 caracteres" 
            error={errors.password?.message} 
            {...register('password')} 
          />
          
          {serverError ? (
            <div className="rounded-xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm font-medium text-lost">
              {serverError}
            </div>
          ) : null}
          
          {successMessage ? (
            <div className="rounded-xl bg-found/10 border-2 border-found/20 px-4 py-3 text-sm font-medium text-found">
              {successMessage}
            </div>
          ) : null}
          
          <Button 
            type="submit" 
            variant="primary" 
            disabled={isSubmitting} 
            className="w-full gap-2"
          >
            <PawPrint className="size-4" />
            {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
          
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
          
          <p className="text-center text-xs leading-relaxed text-foreground/60 pt-2">
            Al registrarte aceptas que Patitas use tu perfil para publicaciones y seguimiento de casos.
          </p>
        </form>
      </AuthCard>
    </section>
  );
}
