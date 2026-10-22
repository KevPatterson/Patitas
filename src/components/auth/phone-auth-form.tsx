import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import {
  createPhoneAuthSchema,
  phoneOtpSchema,
  type PhoneAuthInput,
  type PhoneOtpInput,
} from '../../lib/validations/auth';
import {
  signInWithPhoneOtp,
  verifyPhoneOtp,
  type PhoneChannel,
} from '../../lib/supabase/auth';
import { isValidPhone, normalizePhone } from '../../lib/auth/phone';
import { phoneAuthErrorMessage } from '../../lib/auth/error-messages';

type PhoneAuthFormProps = {
  mode: 'login' | 'register';
  next: string;
};

type SignUpData = {
  fullName?: string;
  username?: string;
};

export function PhoneAuthForm({ mode, next }: PhoneAuthFormProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [channel, setChannel] = useState<PhoneChannel>('sms');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [signUpData, setSignUpData] = useState<SignUpData>({});
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const phoneSchema = useMemo(() => createPhoneAuthSchema(mode), [mode]);
  const phoneForm = useForm<PhoneAuthInput>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '', fullName: '', username: '' },
  });
  const codeForm = useForm<PhoneOtpInput>({
    resolver: zodResolver(phoneOtpSchema),
    defaultValues: { token: '' },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';

  const onSubmitPhone = async (values: PhoneAuthInput) => {
    setServerError(null);
    setInfoMessage(null);

    const phone = normalizePhone(values.phone);
    if (!isValidPhone(phone)) {
      phoneForm.setError('phone', {
        type: 'manual',
        message: 'Ingresa un teléfono válido con código de país.',
      });
      return;
    }

    const nextSignUpData: SignUpData =
      mode === 'register'
        ? {
            fullName: values.fullName?.trim(),
            username: values.username?.trim().toLowerCase(),
          }
        : {};

    setIsSending(true);
    try {
      await signInWithPhoneOtp(phone, channel, {
        shouldCreateUser: true,
        ...nextSignUpData,
      });
      setNormalizedPhone(phone);
      setSignUpData(nextSignUpData);
      setStep('code');
      setCooldown(60);
      setInfoMessage(`Te enviamos un código de 6 dígitos por ${channelLabel}.`);
    } catch (error) {
      setServerError(phoneAuthErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  };

  const onSubmitCode = async (values: PhoneOtpInput) => {
    setServerError(null);
    setIsVerifying(true);
    try {
      await verifyPhoneOtp(normalizedPhone, values.token);
      navigate(next, { replace: true });
    } catch (error) {
      setServerError(phoneAuthErrorMessage(error));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !normalizedPhone) return;
    setServerError(null);
    setIsSending(true);
    try {
      await signInWithPhoneOtp(normalizedPhone, channel, {
        shouldCreateUser: true,
        ...signUpData,
      });
      setCooldown(60);
      setInfoMessage(`Te enviamos un nuevo código por ${channelLabel}.`);
    } catch (error) {
      setServerError(phoneAuthErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setServerError(null);
    setInfoMessage(null);
    codeForm.reset();
  };

  if (step === 'code') {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border-2 border-foreground/10 bg-foreground/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-orange" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold text-foreground">
                Código enviado a {normalizedPhone}
              </p>
              <p className="text-xs leading-relaxed text-foreground/60">
                Revisa{' '}
                {channel === 'whatsapp' ? 'WhatsApp' : 'tus mensajes SMS'} e
                ingresa el código de 6 dígitos.
              </p>
              <button
                type="button"
                onClick={handleBack}
                className="text-xs font-bold text-orange hover:text-orange-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
              >
                Cambiar número
              </button>
            </div>
          </div>
        </div>

        <form
          className="space-y-5"
          onSubmit={codeForm.handleSubmit(onSubmitCode)}
        >
          <TextField
            label="Código de verificación"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            autoFocus
            error={codeForm.formState.errors.token?.message}
            {...codeForm.register('token')}
          />

          {serverError ? (
            <div className="rounded-xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm font-medium text-lost">
              {serverError}
            </div>
          ) : null}

          {infoMessage ? (
            <div className="rounded-xl bg-found/10 border-2 border-found/20 px-4 py-3 text-sm font-medium text-found">
              {infoMessage}
            </div>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={isVerifying}
            disabled={isVerifying}
          >
            Verificar código
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleResend}
            loading={isSending}
            disabled={cooldown > 0 || isSending}
          >
            {cooldown > 0
              ? `Reenviar código (${cooldown} s)`
              : 'Reenviar código'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={phoneForm.handleSubmit(onSubmitPhone)}
    >
      {mode === 'register' ? (
        <>
          <TextField
            label="Nombre"
            autoComplete="name"
            placeholder="Tu nombre"
            error={phoneForm.formState.errors.fullName?.message}
            {...phoneForm.register('fullName')}
          />
          <TextField
            label="Usuario"
            autoComplete="username"
            placeholder="tu_usuario"
            error={phoneForm.formState.errors.username?.message}
            {...phoneForm.register('username')}
          />
        </>
      ) : null}

      <TextField
        label="Teléfono"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+53 5 123 4567"
        hint="Incluye el código de país"
        error={phoneForm.formState.errors.phone?.message}
        {...phoneForm.register('phone')}
      />

      <div className="space-y-2">
        <span className="block text-sm font-semibold text-foreground">
          Recibir código por
        </span>
        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-label="Canal del código"
        >
          <button
            type="button"
            aria-pressed={channel === 'sms'}
            onClick={() => setChannel('sms')}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-4 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 ${
              channel === 'sms'
                ? 'border-orange bg-orange/10 text-orange-dark'
                : 'border-foreground/10 bg-surface text-foreground/70 hover:border-foreground/20'
            }`}
          >
            <MessageCircle className="size-4" />
            SMS
          </button>
          <button
            type="button"
            aria-pressed={channel === 'whatsapp'}
            onClick={() => setChannel('whatsapp')}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-4 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 ${
              channel === 'whatsapp'
                ? 'border-found bg-found/10 text-found'
                : 'border-foreground/10 bg-surface text-foreground/70 hover:border-foreground/20'
            }`}
          >
            <Phone className="size-4" />
            WhatsApp
          </button>
        </div>
      </div>

      {serverError ? (
        <div className="rounded-xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm font-medium text-lost">
          {serverError}
        </div>
      ) : null}

      {infoMessage ? (
        <div className="rounded-xl bg-found/10 border-2 border-found/20 px-4 py-3 text-sm font-medium text-found">
          {infoMessage}
        </div>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        loading={isSending}
        disabled={isSending}
      >
        Enviar código por {channelLabel}
      </Button>

      <p className="text-center text-xs leading-relaxed text-foreground/60">
        {mode === 'register'
          ? 'Crearemos tu cuenta cuando verifiques el código.'
          : 'Si es tu primera vez, crearemos tu cuenta automáticamente.'}
      </p>
    </form>
  );
}
