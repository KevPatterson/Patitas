import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, MapPin } from 'lucide-react';
import { useAuth } from '../../app/auth-context';
import { Button } from '../ui/button';
import { CUBA, PROVINCES } from '../../lib/constants/cuba';
import {
  ALERT_TYPE_LABELS,
  DEFAULT_ALERT_TYPES,
  getMyAlertSubscription,
  saveAlertSubscription,
  type AlertType,
} from '../../lib/supabase/alerts';
import { notifyError, notifySuccess } from '../../lib/ui/sweetalert';

const ALERT_TYPES: AlertType[] = ['LOST', 'FOUND', 'SIGHTING'];

/**
 * Preferencias de alertas por municipio.
 *
 * No se pide GPS ni se guardan coordenadas: el alcance es el municipio elegido.
 * Las notificaciones llegan solo a la bandeja de la app.
 */
export function AlertSettings() {
  const { user } = useAuth();
  const userId = user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [province, setProvince] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [types, setTypes] = useState<AlertType[]>(DEFAULT_ALERT_TYPES);
  const [isActive, setIsActive] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const municipalities = useMemo(
    () => (province ? CUBA[province as keyof typeof CUBA] ?? [] : []),
    [province]
  );

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const subscription = await getMyAlertSubscription();

      if (subscription) {
        setProvince(subscription.province);
        setMunicipality(subscription.municipality);
        setTypes(subscription.types);
        setIsActive(subscription.isActive);
        setHasSubscription(true);
      }

      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar tus alertas.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleProvinceChange = (value: string) => {
    setProvince(value);
    setMunicipality('');
  };

  const toggleType = (type: AlertType) => {
    setTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      await saveAlertSubscription({ province, municipality, types, isActive });
      setHasSubscription(true);
      notifySuccess(
        isActive ? 'Alertas guardadas' : 'Alertas desactivadas',
        isActive
          ? `Te avisaremos de casos nuevos en ${municipality}.`
          : 'Puedes volver a activarlas cuando quieras.'
      );
    } catch (saveError) {
      notifyError(
        'No se pudieron guardar tus alertas',
        saveError instanceof Error ? saveError.message : 'Inténtalo de nuevo en unos segundos.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border-2 border-foreground/10 bg-surface p-6 shadow-md">
        <p className="text-sm font-semibold text-foreground/60">Cargando tus alertas...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-foreground/10 bg-surface p-6 shadow-md space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange/10">
          <Bell className="size-6 text-orange" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display text-xl font-extrabold text-foreground">Alertas de mi municipio</h3>
          <p className="mt-1 text-sm text-foreground/60">
            Recibe un aviso en la bandeja cuando se publique un caso nuevo en tu municipio. Sin GPS
            y sin compartir tu ubicación.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-lost/10 px-4 py-3 text-sm font-semibold text-lost">{error}</p>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-semibold text-foreground" htmlFor="alert-province">
            <span>Provincia</span>
            <select
              id="alert-province"
              className="h-12 w-full rounded-2xl border-2 border-foreground/10 bg-surface px-4 text-base text-foreground outline-none transition focus:border-orange"
              value={province}
              onChange={(event) => handleProvinceChange(event.target.value)}
              required
            >
              <option value="">Elige una provincia</option>
              {PROVINCES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm font-semibold text-foreground" htmlFor="alert-municipality">
            <span>Municipio</span>
            <select
              id="alert-municipality"
              className="h-12 w-full rounded-2xl border-2 border-foreground/10 bg-surface px-4 text-base text-foreground outline-none transition focus:border-orange disabled:opacity-50"
              value={municipality}
              onChange={(event) => setMunicipality(event.target.value)}
              disabled={!province}
              required
            >
              <option value="">Elige un municipio</option>
              {municipalities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground">¿Qué casos quieres recibir?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {ALERT_TYPES.map((type) => (
              <label
                key={type}
                className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-foreground/10 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-orange/40"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-orange"
                  checked={types.includes(type)}
                  onChange={() => toggleType(type)}
                />
                {ALERT_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-foreground/5 px-4 py-3 text-sm font-semibold text-foreground">
          <input
            type="checkbox"
            className="size-4 accent-orange"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Recibir alertas activas
        </label>

        <div className="flex items-center gap-2 text-xs text-foreground/50">
          <MapPin className="size-4" aria-hidden="true" />
          Los avisos llegan solo a tu bandeja de notificaciones, nunca por SMS ni correo.
        </div>

        <Button type="submit" variant="primary" loading={saving} className="w-full gap-2">
          <Bell className="size-4" aria-hidden="true" />
          {hasSubscription ? 'Guardar alertas' : 'Activar alertas'}
        </Button>
      </form>
    </div>
  );
}
