import { useEffect, useState } from 'react';
import { Heart, PawPrint } from 'lucide-react';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';
import { PublicationCard } from '../components/publications/publication-card';
import { PawTrail } from '../components/ui/paw-loader';
import { EmptyState } from '../components/ui/empty-state';
import { searchPublications, type PublicationSummary } from '../lib/supabase/publication-search';
import { setPageMeta } from '../lib/seo/page-meta';

export function AdoptionsPage() {
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState('');
  const [size, setSize] = useState('');
  const [province, setProvince] = useState('');
  const [results, setResults] = useState<PublicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  /**
   * Ubicación del usuario, leída UNA sola vez.
   *
   * Se usa `useState` con inicializador perezoso a propósito. Antes se calculaba
   * en el cuerpo del componente, así que cada render devolvía un objeto **nuevo**
   * (`{ lat, lng }`); como esa variable estaba en las dependencias del efecto de
   * búsqueda, cada render lo volvía a disparar → `setResults` → render → nueva
   * identidad → … y `searchPublications` se llamaba indefinidamente.
   *
   * Con el inicializador, el valor se calcula una vez y su identidad no cambia.
   */
  const [userLocation] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const saved = localStorage.getItem('userLocation');
      if (saved) {
        return JSON.parse(saved) as { lat: number; lng: number };
      }
    } catch (error) {
      console.warn('Error cargando ubicación:', error);
    }
    return null;
  });

  useEffect(() => {
    setPageMeta({
      title: 'Adopciones · Patitas',
      description: 'Encuentra mascotas en adopción responsable. Ayúdalas a encontrar un hogar.',
      canonicalPath: '/adopciones',
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const data = await searchPublications({
          query,
          type: 'ADOPTION',
          province,
          status: 'ACTIVE',
        });

        if (active) {
          // Filtros adicionales del lado del cliente
          let filtered = data;

          if (species) {
            filtered = filtered.filter((p: { species?: string }) => p.species?.toLowerCase().includes(species.toLowerCase()));
          }

          if (size) {
            filtered = filtered.filter((p: { size?: string | null }) => p.size?.toLowerCase().includes(size.toLowerCase()));
          }

          // Calcular distancia si hay ubicación del usuario
          if (userLocation) {
            filtered = filtered.map((pub: PublicationSummary) => {
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

          setResults(filtered);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : 'No pudimos cargar las adopciones.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [province, query, size, species, userLocation]);

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

  const hasActiveFilters = Boolean(query || species || size || province);

  function handleClearFilters() {
    setQuery('');
    setSpecies('');
    setSize('');
    setProvince('');
  }

  return (
    <section className="space-y-8 py-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-purple/10 via-cream to-orange/10 border-2 border-navy/10 p-8 md:p-12 shadow-md">
        <div className="blob-decoration absolute top-5 right-5 size-32 bg-purple/20" />
        <div className="blob-decoration absolute bottom-5 left-5 size-24 bg-orange/15" style={{ animationDelay: '2s' }} />
        
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="size-6 text-purple animate-paw-bounce" />
            <span className="text-xs font-bold uppercase tracking-wider text-navy/60">Adopción responsable</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold text-navy mb-4">
            Adopta, no compres 💜
          </h1>
          <p className="text-lg text-navy/70 leading-relaxed max-w-2xl">
            Estas mascotas están buscando un hogar. Adoptar es un acto de amor que cambia dos vidas: la tuya y la de ellos.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border-2 border-navy/10 bg-white p-6 shadow-md space-y-4">
        <TextField
          label="Buscar"
          placeholder="🔎 Nombre, características..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-navy">Especie</span>
            <select
              className="h-11 w-full rounded-xl border-2 border-navy/10 bg-white px-4 text-sm font-medium text-navy shadow-sm outline-none transition hover:border-navy/20 focus:border-purple focus:ring-4 focus:ring-purple/20"
              value={species}
              onChange={(event) => setSpecies(event.target.value)}
            >
              <option value="">Todas</option>
              <option value="perro">Perro</option>
              <option value="gato">Gato</option>
              <option value="ave">Ave</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          
          <label className="space-y-2">
            <span className="text-sm font-semibold text-navy">Tamaño</span>
            <select
              className="h-11 w-full rounded-xl border-2 border-navy/10 bg-white px-4 text-sm font-medium text-navy shadow-sm outline-none transition hover:border-navy/20 focus:border-purple focus:ring-4 focus:ring-purple/20"
              value={size}
              onChange={(event) => setSize(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="pequeño">Pequeño</option>
              <option value="mediano">Mediano</option>
              <option value="grande">Grande</option>
            </select>
          </label>
          
          <label className="space-y-2">
            <span className="text-sm font-semibold text-navy">Provincia</span>
            <input
              className="h-11 w-full rounded-xl border-2 border-navy/10 bg-white px-4 text-sm font-medium text-navy shadow-sm outline-none transition placeholder:text-navy/40 hover:border-navy/20 focus:border-purple focus:ring-4 focus:ring-purple/20"
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              placeholder="La Habana"
            />
          </label>
          
          <div className="flex items-end">
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full" 
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      </div>

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
          <p className="text-sm text-navy/60">Cargando adopciones...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && results.length === 0 && (
        <EmptyState
          title="Aún no hay patitas en adopción"
          description={hasActiveFilters 
            ? "No hay mascotas en adopción con esos filtros. Intenta con otros criterios."
            : "Aún no hay mascotas publicadas para adopción. Vuelve pronto — pronto llegará una nueva historia."
          }
          illustration="cat"
          action={
            hasActiveFilters ? (
              <Button variant="adoption" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            ) : null
          }
        />
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-navy/60">
              {results.length} mascota{results.length !== 1 ? 's' : ''} en adopción
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((publication) => (
              <PublicationCard 
                key={publication.id} 
                publication={publication} 
                distance={publication.distance}
              />
            ))}
          </div>

          {/* Info sobre adopción */}
          <div className="rounded-2xl border-2 border-purple/20 bg-linear-to-br from-purple/5 to-orange/5 p-8 text-center shadow-md">
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="flex justify-center">
                <div className="size-14 rounded-2xl bg-purple/10 flex items-center justify-center">
                  <Heart className="size-7 text-purple" />
                </div>
              </div>
              <h3 className="font-display text-2xl font-extrabold text-navy">
                ¿Quieres adoptar?
              </h3>
              <p className="text-navy/70 leading-relaxed">
                Contacta al responsable desde la publicación. La adopción responsable requiere compromiso, cariño y paciencia. Adoptar salva vidas.
              </p>
              <div className="flex flex-wrap gap-3 justify-center pt-2">
                <span className="inline-flex items-center gap-2 rounded-pill bg-white px-4 py-2 text-sm font-semibold text-navy shadow-sm">
                  <PawPrint className="size-4 text-purple" />
                  Compromiso a largo plazo
                </span>
                <span className="inline-flex items-center gap-2 rounded-pill bg-white px-4 py-2 text-sm font-semibold text-navy shadow-sm">
                  <Heart className="size-4 text-purple" />
                  Amor incondicional
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
