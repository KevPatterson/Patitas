import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, X, ChevronDown, Heart, CalendarDays } from 'lucide-react';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';
import { PublicationCard } from '../components/publications/publication-card';
import { PawTrail } from '../components/ui/paw-loader';
import { EmptyState } from '../components/ui/empty-state';
import { searchPublications, countPublications, type PublicationSummary } from '../lib/supabase/publication-search';
import { TYPE_LABELS, SPECIES_LABELS, SEX_LABELS, SIZE_LABELS, AGE_LABELS, STATUS_LABELS } from '../lib/constants/labels';
import { CUBA, PROVINCES } from '../lib/constants/cuba';

type SearchFilters = {
  query?: string;
  type?: PublicationSummary['type'] | 'ALL';
  species?: string;
  sex?: string;
  size?: string;
  age?: string;
  province?: string;
  municipality?: string;
  zone?: string;
  status?: PublicationSummary['status'] | 'ALL';
  since?: string;
  until?: string;
};

/** Etiquetas legibles para los chips de filtros activos. */
const FILTER_TITLES: Record<string, string> = {
  type: 'Tipo',
  species: 'Especie',
  sex: 'Sexo',
  size: 'Tamaño',
  age: 'Edad',
  province: 'Provincia',
  municipality: 'Municipio',
  zone: 'Zona',
  status: 'Estado',
  since: 'Desde',
  until: 'Hasta',
};

/** Fecha local en formato ISO corto, sin desplazamientos de zona horaria. */
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatFilterDate(value: string): string {
  return new Intl.DateTimeFormat('es-CU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState<PublicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Cargar ubicación guardada de localStorage
  const userLocation = useMemo(() => {
    try {
      const saved = localStorage.getItem('userLocation');
      if (saved) {
        return JSON.parse(saved) as { lat: number; lng: number };
      }
    } catch (error) {
      console.warn('Error cargando ubicación:', error);
    }
    return null;
  }, []);

  const LIMIT = 48;

  // Clave estable: `useSearchParams` puede devolver un objeto nuevo por render, y
  // con él en las dependencias la búsqueda se dispararía en bucle (el mismo bug
  // que tenía la página de adopciones).
  const searchParamsKey = searchParams.toString();

  const filters = useMemo((): SearchFilters => {
    return {
      query: searchParams.get('q') || '',
      type: (searchParams.get('type') as SearchFilters['type']) || 'ALL',
      species: searchParams.get('species') || '',
      sex: searchParams.get('sex') || '',
      size: searchParams.get('size') || '',
      age: searchParams.get('age') || '',
      province: searchParams.get('province') || '',
      municipality: searchParams.get('municipality') || '',
      zone: searchParams.get('zone') || '',
      status: (searchParams.get('status') as SearchFilters['status']) || 'ACTIVE',
      since: searchParams.get('since') || '',
      until: searchParams.get('until') || '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey]);

  const municipalities = useMemo(() => filters.province ? CUBA[filters.province as keyof typeof CUBA] ?? [] : [], [filters.province]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const searchFilters = { ...filters, limit: LIMIT, offset: (page - 1) * LIMIT };
        const [data, count] = await Promise.all([
          searchPublications(searchFilters),
          countPublications(searchFilters),
        ]);
        if (active) {
          // Calcular distancia si hay ubicación del usuario
          let resultsWithDistance = data;
          if (userLocation) {
            resultsWithDistance = data.map((pub: PublicationSummary) => {
              if (pub.approximateLat && pub.approximateLng) {
                const distance = calculateDistance(
                  userLocation.lat,
                  userLocation.lng,
                  pub.approximateLat,
                  pub.approximateLng
                );
                return { ...pub, distance };
              }
              return pub;
            });
          }
          setResults(resultsWithDistance);
          setTotalCount(count);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : 'Error al buscar');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [filters, page, userLocation]);

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Aplica varios parámetros en una sola actualización.
   *
   * Es importante hacerlo así: llamar dos veces seguidas a `setSearchParams`
   * para provincia + municipio puede dejar el segundo valor fuera si React
   * agrupa las actualizaciones con el mismo `prev`.
   */
  function updateParams(updates: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
    setPage(1);
  }

  function updateParam(key: string, value: string | null) {
    updateParams({ [key]: value });
  }

  function clearFilters() {
    setSearchParams({}, { replace: true });
    setPage(1);
  }

  function removeFilter(key: string) {
    const updates: Record<string, string | null> = { [key]: null };
    // El municipio no tiene sentido sin su provincia.
    if (key === 'province') updates.municipality = null;
    updateParams(updates);
  }

  function applyRecentRange(days: number) {
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - days);
    updateParams({ since: toIsoDate(since), until: toIsoDate(until) });
  }

  const totalPages = Math.ceil(totalCount / LIMIT);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; value: string }> = [];

    if (filters.type && filters.type !== 'ALL') {
      chips.push({ key: 'type', value: TYPE_LABELS[filters.type] ?? filters.type });
    }
    if (filters.species) chips.push({ key: 'species', value: SPECIES_LABELS[filters.species] ?? filters.species });
    if (filters.sex) chips.push({ key: 'sex', value: SEX_LABELS[filters.sex] ?? filters.sex });
    if (filters.size) chips.push({ key: 'size', value: SIZE_LABELS[filters.size] ?? filters.size });
    if (filters.age) chips.push({ key: 'age', value: AGE_LABELS[filters.age] ?? filters.age });
    if (filters.province) chips.push({ key: 'province', value: filters.province });
    if (filters.municipality) chips.push({ key: 'municipality', value: filters.municipality });
    if (filters.zone) chips.push({ key: 'zone', value: filters.zone });
    if (filters.status && filters.status !== 'ACTIVE' && filters.status !== 'ALL') {
      chips.push({ key: 'status', value: STATUS_LABELS[filters.status] ?? filters.status });
    }
    if (filters.since) chips.push({ key: 'since', value: formatFilterDate(filters.since) });
    if (filters.until) chips.push({ key: 'until', value: formatFilterDate(filters.until) });

    return chips;
  }, [filters]);

  const activeFiltersCount = activeFilterChips.length;

  return (
    <section className="space-y-8 py-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-turquoise/10 via-app to-purple/10 border-2 border-foreground/10 p-8 shadow-md">
        <div className="blob-decoration absolute top-5 right-5 size-24 bg-orange/20" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Search className="size-5 text-turquoise" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Buscador</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-foreground mb-2">
            Encuentra una patita
          </h1>
          <p className="text-foreground/70 max-w-2xl">
            Busca por nombre, zona, especie o características. Combina filtros para resultados más precisos.
          </p>
        </div>
      </div>

      {/* Barra de búsqueda principal */}
      <div className="relative">
        <TextField
          label=""
          placeholder="🔎 Toby, gato negro, Centro Habana..."
          value={filters.query}
          onChange={(event) => updateParam('q', event.target.value || null)}
          className="h-14 text-lg"
        />
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border-2 border-foreground/10 bg-surface p-6 shadow-md space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="size-5 text-foreground/60" />
            <h2 className="font-display text-lg font-bold text-foreground">Filtros</h2>
            {activeFiltersCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-orange text-white text-xs font-bold">
                {activeFiltersCount}
              </span>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" onClick={clearFilters} className="text-sm gap-1">
              <X className="size-4" />
              Limpiar
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Tipo</span>
            <select
              className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
              value={filters.type}
              onChange={(event) => updateParam('type', event.target.value === 'ALL' ? null : event.target.value)}
            >
              <option value="ALL">Todos</option>
              {(Object.entries(TYPE_LABELS) as [string, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Especie</span>
            <select
              className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
              value={filters.species}
              onChange={(event) => updateParam('species', event.target.value || null)}
            >
              <option value="">Todas</option>
              {(Object.entries(SPECIES_LABELS) as [string, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Sexo</span>
            <select
              className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
              value={filters.sex}
              onChange={(event) => updateParam('sex', event.target.value || null)}
            >
              <option value="">Todos</option>
              {(Object.entries(SEX_LABELS) as [string, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Tamaño</span>
            <select
              className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
              value={filters.size}
              onChange={(event) => updateParam('size', event.target.value || null)}
            >
              <option value="">Todos</option>
              {(Object.entries(SIZE_LABELS) as [string, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        <Button 
          type="button" 
          variant="ghost" 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full sm:w-auto gap-2"
        >
          {showAdvanced ? 'Ocultar' : 'Mostrar'} filtros avanzados
          <ChevronDown className={`size-4 transition-transform duration-base ${showAdvanced ? 'rotate-180' : ''}`} />
        </Button>

        {showAdvanced && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Edad</span>
              <select
                className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
                value={filters.age}
                onChange={(event) => updateParam('age', event.target.value || null)}
              >
                <option value="">Todas</option>
                {(Object.entries(AGE_LABELS) as [string, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Zona</span>
              <input
                type="search"
                placeholder="Ej. Vedado"
                className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition placeholder:text-foreground/40 hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
                value={filters.zone}
                onChange={(event) => updateParam('zone', event.target.value || null)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Provincia</span>
              <select
                className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
                value={filters.province}
                onChange={(event) => updateParams({ province: event.target.value || null, municipality: null })}
              >
                <option value="">Todas</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Municipio</span>
              <select
                className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20 disabled:opacity-50 disabled:cursor-not-allowed"
                value={filters.municipality}
                onChange={(event) => updateParam('municipality', event.target.value || null)}
                disabled={municipalities.length === 0}
              >
                <option value="">Todos</option>
                {municipalities.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Estado</span>
              <select
                className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
                value={filters.status}
                onChange={(event) => updateParam('status', event.target.value === 'ALL' ? null : event.target.value)}
              >
                <option value="ALL">Todos</option>
                {(Object.entries(STATUS_LABELS) as [string, string][]).filter(([k]) => k !== 'DELETED').map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Publicado desde</span>
              <input
                type="date"
                max={filters.until || undefined}
                className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
                value={filters.since}
                onChange={(event) => updateParam('since', event.target.value || null)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Publicado hasta</span>
              <input
                type="date"
                min={filters.since || undefined}
                className="h-11 w-full rounded-xl border-2 border-foreground/10 bg-surface px-4 text-sm font-medium text-foreground shadow-sm outline-none transition hover:border-foreground/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
                value={filters.until}
                onChange={(event) => updateParam('until', event.target.value || null)}
              />
            </label>

            <div className="sm:col-span-2 lg:col-span-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  Rango rápido:
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => applyRecentRange(1)}>
                  Últimas 24 h
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => applyRecentRange(7)}>
                  Últimos 7 días
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => applyRecentRange(30)}>
                  Últimos 30 días
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chips de filtros activos */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => removeFilter(chip.key)}
              className="inline-flex items-center gap-1.5 rounded-pill border-2 border-orange/20 bg-orange/10 px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-orange/40 hover:bg-orange/20"
              aria-label={`Quitar filtro ${FILTER_TITLES[chip.key] ?? chip.key}: ${chip.value}`}
            >
              <span className="text-foreground/60">{FILTER_TITLES[chip.key] ?? chip.key}:</span>
              {chip.value}
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-bold text-orange-dark underline-offset-2 hover:underline"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* Aviso al ver historias resueltas */}
      {filters.status === 'RESOLVED' && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-found/20 bg-found/5 px-4 py-3">
          <Heart className="mt-0.5 size-5 shrink-0 text-found" aria-hidden="true" />
          <div>
            <p className="font-display text-base font-extrabold text-foreground">Historias con final feliz</p>
            <p className="text-sm text-foreground/70">
              Estás viendo casos que ya se resolvieron: reencuentros y adopciones que cambiaron una vida.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <div className="rounded-xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm font-medium text-lost animate-shake">
          {errorMessage}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <PawTrail />
          <p className="text-sm text-foreground/60">Buscando patitas...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && results.length === 0 && (
        <EmptyState
          title="No encontramos ninguna patita"
          description="Intenta con otros filtros o términos de búsqueda."
          illustration="cat"
          action={activeFiltersCount > 0 && <Button variant="primary" onClick={clearFilters}>Limpiar filtros</Button>}
        />
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground/60">
              {totalCount} resultado{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
            </p>
            {totalPages > 1 && (
              <p className="text-sm font-semibold text-foreground/60">
                Página {page} de {totalPages}
              </p>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((pub) => (
              <PublicationCard 
                key={pub.id} 
                publication={pub} 
                distance={pub.distance}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button 
                variant="ghost" 
                onClick={() => setPage((p) => Math.max(1, p - 1))} 
                disabled={page === 1}
                className="min-w-25"
              >
                ← Anterior
              </Button>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center min-w-9 h-9 rounded-lg bg-ink text-white text-sm font-bold">
                  {page}
                </span>
                <span className="text-foreground/40">/</span>
                <span className="text-sm font-semibold text-foreground/60">{totalPages}</span>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages}
                className="min-w-25"
              >
                Siguiente →
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default SearchPage;