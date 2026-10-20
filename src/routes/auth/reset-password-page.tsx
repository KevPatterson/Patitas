import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { PawPrint, KeyRound } from 'lucide-react';
import { AuthCard } from '../../components/ui/auth-card';
import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';
import { newPasswordSchema, type NewPasswordInput } from '../../lib/validations/auth';
import { updatePassword } from '../../lib/supabase/auth';
import { setPageMeta } from '../../lib/seo/page-meta';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema) });

  useEffect(() => {
    setPageMeta({
      title: 'Nueva contraseña — Patitas',
      description: 'Restablece tu contraseña y recupera el acceso a tu cuenta de Patitas.',
      canonicalPath: '/auth/reset-password',
    });
  }, []);

  const onSubmit = async (values: NewPasswordInput) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      await updatePassword(values.password);
      setSuccessMessage('✨ Contraseña actualizada correctamente.');
      setTimeout(() => {
        navigate('/publicar', { replace: true });
      }, 1500);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'No pudimos actualizar tu contraseña.');
    }
  };

  return (
    <section className="grid min-h-[calc(100vh-8rem)] place-items-center py-10">
      <AuthCard
        eyebrow="Seguridad"
        title="🔑 Nueva contraseña"
        description="El enlace de recuperación te trajo aquí. Elige una contraseña nueva para seguir usando Patitas."
        footer={
          <div className="flex items-center justify-center gap-3 text-sm text-foreground/70">
            <Link className="font-semibold text-orange hover:text-orange-dark transition-colors" to="/auth/login">
              Volver al inicio de sesión
            </Link>
          </div>
        }
      >
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <TextField 
            label="Nueva contraseña" 
            type="password" 
            autoComplete="new-password" 
            placeholder="Mínimo 8 caracteres" 
            error={errors.password?.message} 
            {...register('password')} 
          />
          
          <TextField 
            label="Confirmar contraseña" 
            type="password" 
            autoComplete="new-password" 
            placeholder="Repite la contraseña" 
            error={errors.confirmPassword?.message} 
            {...register('confirmPassword')} 
          />
          
          {serverError ? (
            <div className="rounded-xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm font-medium text-lost">
              {serverError}
            </div>
          ) : null}
          
          {successMessage ? (
            <div className="rounded-xl bg-found/10 border-2 border-found/20 px-4 py-3 text-sm font-medium text-found flex items-start gap-3">
              <KeyRound className="size-5 shrink-0 mt-0.5" />
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
            {isSubmitting ? 'Actualizando...' : 'Actualizar contraseña'}
          </Button>
        </form>
      </AuthCard>
    </section>
  );
}