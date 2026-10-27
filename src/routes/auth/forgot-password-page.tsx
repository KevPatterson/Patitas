import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Mail, PawPrint } from 'lucide-react';
import { AuthCard } from '../../components/ui/auth-card';
import { Button, LinkButton } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { resetPasswordSchema, type ResetPasswordInput } from '../../lib/validations/auth';
import { resetPassword } from '../../lib/supabase/auth';
import { GENERIC_RESET_SENT, resetPasswordErrorMessage } from '../../lib/auth/error-messages';
import { setPageMeta } from '../../lib/seo/page-meta';

export function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  useEffect(() => {
    setPageMeta({
      title: 'Recuperar contraseña — Patitas',
      description: 'Restablece tu contraseña y recupera el acceso a tu cuenta de Patitas.',
      canonicalPath: '/auth/forgot-password',
    });
  }, []);

  const onSubmit = async (values: ResetPasswordInput) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      await resetPassword(values.email);
    } catch (error) {
      // Solo se muestran los errores de red o de rate limit. Cualquier otro
      // (incluido "el usuario no existe") se trata como enviado: mostrar algo
      // distinto permitiría enumerar cuentas registradas.
      const blocking = resetPasswordErrorMessage(error);
      if (blocking) {
        setServerError(blocking);
        return;
      }
    }

    setSuccessMessage(`📧 ${GENERIC_RESET_SENT}`);
  };

  return (
    <section className="grid min-h-[calc(100vh-8rem)] place-items-center py-10">
      <AuthCard
        eyebrow="Recuperación"
        title="🔑 Restablecer contraseña"
        description="Te enviaremos un enlace seguro para volver a entrar sin perder tus publicaciones."
        footer={
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-3 text-sm text-foreground/70">
            <Link className="font-semibold text-orange hover:text-orange-dark transition-colors" to="/auth/login">
              Volver al acceso
            </Link>
            <LinkButton href="/auth/register" variant="secondary" className="text-sm font-bold">
              Crear cuenta
            </LinkButton>
          </div>
        }
      >
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField 
            label="Correo" 
            type="email" 
            autoComplete="email" 
            placeholder="tu@correo.com" 
            error={errors.email?.message} 
            {...register('email')} 
          />
          
          {serverError ? (
            <div className="rounded-xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm font-medium text-lost">
              {serverError}
            </div>
          ) : null}
          
          {successMessage ? (
            <div className="rounded-xl bg-found/10 border-2 border-found/20 px-4 py-3 text-sm font-medium text-found flex items-start gap-3">
              <Mail className="size-5 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          ) : null}
          
          <Button 
            type="submit" 
            variant="primary" 
            className="w-full gap-2" 
            disabled={isSubmitting}
          >
            <PawPrint className="size-4" />
            {isSubmitting ? 'Enviando...' : 'Enviar enlace'}
          </Button>
        </form>
      </AuthCard>
    </section>
  );
}