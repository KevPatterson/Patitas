import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { divIcon, type LatLngExpression } from 'leaflet';
import { MapPin, Filter, X, Layers, PawPrint } from 'lucide-react';
import { searchPublications, type PublicationSummary } from '../lib/supabase/publication-search';
import { TYPE_LABELS, SPECIES_LABELS } from '../lib/constants/labels';
import { setPageMeta } from '../lib/seo/page-meta';
import { CasePopup } from '../components/publications/CasePopup';
import { Button } from '../components/ui/button';
import 'leaflet/dist/leaflet.css';

// Iconos personalizados usando SVG de PawPrint de Lucide (igual que la leyenda)
const MARKER_ICONS: Record<PublicationSummary['type'], ReturnType<typeof divIcon>> = (() => {
  const configs: Record<PublicationSummary['type'], { color: string; fillColor: string }> = {
    LOST: { color: '#ef4444', fillColor: 'rgba(239, 68, 68, 0.2)' },
    FOUND: { color: '#10b981', fillColor: 'rgba(16, 185, 129, 0.2)' },
    ABANDONED: { color: '#ff8c42', fillColor: 'rgba(255, 140, 66, 0.2)' },
    ADOPTION: { color: '#a78bfa', fillColor: 'rgba(167, 139, 250, 0.2)' },
    SIGHTING: { color: '#ffb078', fillColor: 'rgba(255, 176, 120, 0.2)' },
  };

  const icons: Partial<Record<PublicationSummary['type'], ReturnType<typeof divIcon>>> = {};

  for (const [type, { color, fillColor }] of Object.entries(configs)) {
    // SVG de PawPrint de Lucide (copiado del icono original)
    const iconHtml = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${fillColor}" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));">
        <circle cx="11" cy="4" r="2"/>
        <circle cx="18" cy="8" r="2"/>
        <circle cx="20" cy="16" r="2"/>
        <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>
      </svg>
    `;

    icons[type as PublicationSummary['type']] = divIcon({
      html: iconHtml,
      className: 'custom-paw-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 28], // Punto en el centro-abajo del icono
      popupAnchor: [0, -28],
    });
  }

  return icons as Record<PublicationSummary['type'], ReturnType<typeof divIcon>>;
})();


// Componente para recentrar el mapa

function MapRecenter({ center }: { center: LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function MapPage() {
  const [publications, setPublications] = useState<PublicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type: 'ALL' as PublicationSummary['type'] | 'ALL',
    species: '',
  });

  // Centro de Cuba (La Habana)
  const defaultCenter: LatLngExpression = [23.1136, -82.3666];
  const mapCenter = defaultCenter;

  useEffect(() => {
    setPageMeta({
      title: 'Mapa de casos — Patitas',
      description: 'Visualiza en el mapa todas las mascotas perdidas, encontradas y en adopción cerca de ti.',
      canonicalPath: '/mapa',
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      console.log('🗺️ Iniciando carga de datos del mapa...');
      try {
        const searchFilters: {
          type?: PublicationSummary['type'] | 'ALL';
          species?: string;
          status: 'ACTIVE';
          limit: number;
        } = {
          status: 'ACTIVE',
          limit: 200, // Reducido para mejor rendimiento inicial
        };

        if (filters.type !== 'ALL') {
          searchFilters.type = filters.type;
        }

        if (filters.species) {
          searchFilters.species = filters.species;
        }

        console.log('🔍 Filtros de búsqueda:', searchFilters);
        const data = await searchPublications(searchFilters);
        console.log('📊 Publicaciones recibidas:', data.length);

        // Filtrar solo publicaciones con coordenadas
        const withCoords = data.filter(
          (pub: PublicationSummary) => pub.approximateLat !== null && pub.approximateLng !== null
        );
        console.log('📍 Publicaciones con coordenadas:', withCoords.length);

        if (active) {
          setPublications(withCoords);
        }
      } catch (error) {
        console.error('❌ Error loading map data:', error);
        console.error('Detalles del error:', JSON.stringify(error, null, 2));
        if (active) {
          setError(error instanceof Error ? error.message : 'No se pudieron cargar los casos del mapa');
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
  }, [filters]);

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: 'ALL',
      species: '',
    });
  };

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => value && value !== 'ALL' && key !== 'status'
  ).length;

  const stats = useMemo(() => {
    return {
      total: publications.length,
      lost: publications.filter((p) => p.type === 'LOST').length,
      found: publications.filter((p) => p.type === 'FOUND').length,
      adoption: publications.filter((p) => p.type === 'ADOPTION').length,
      sighting: publications.filter((p) => p.type === 'SIGHTING').length,
    };
  }, [publications]);

  return (
    <section className="space-y-6 py-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-turquoise/10 via-cream to-purple/10 border-2 border-navy/10 p-8 shadow-md">
        <div className="blob-decoration absolute top-5 right-5 size-24 bg-orange/20" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="size-5 text-turquoise" />
            <span className="text-xs font-bold uppercase tracking-wider text-navy/60">Geolocalización</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-navy mb-2">Mapa de casos</h1>
          <p className="text-navy/70 max-w-2xl">
            Visualiza todas las mascotas cerca de ti. Las coordenadas son aproximadas para proteger la privacidad.
          </p>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border-2 border-navy/10 bg-white p-4 text-center">
          <p className="font-display text-2xl font-extrabold text-navy">{stats.total}</p>
          <p className="text-xs font-medium text-navy/60">Total</p>
        </div>
        <div className="rounded-2xl border-2 border-lost/20 bg-lost/5 p-4 text-center">
          <p className="font-display text-2xl font-extrabold text-lost">{stats.lost}</p>
          <p className="text-xs font-medium text-navy/60">Perdidas</p>
        </div>
        <div className="rounded-2xl border-2 border-found/20 bg-found/5 p-4 text-center">
          <p className="font-display text-2xl font-extrabold text-found">{stats.found}</p>
          <p className="text-xs font-medium text-navy/60">Encontradas</p>
        </div>
        <div className="rounded-2xl border-2 border-purple/20 bg-purple/5 p-4 text-center">
          <p className="font-display text-2xl font-extrabold text-purple">{stats.adoption}</p>
          <p className="text-xs font-medium text-navy/60">Adopción</p>
        </div>
        <div className="rounded-2xl border-2 border-orange/20 bg-orange/5 p-4 text-center">
          <p className="font-display text-2xl font-extrabold text-orange">{stats.sighting}</p>
          <p className="text-xs font-medium text-navy/60">Avistamientos</p>
        </div>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="rounded-2xl border-2 border-lost/30 bg-lost/10 p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-display text-lg font-bold text-lost mb-2">Error al cargar el mapa</h3>
              <p className="text-sm text-navy/70 mb-3">{error}</p>
              <p className="text-xs text-navy/60">
                Esto puede deberse a un problema de conexión o configuración. Verifica tu archivo .env y asegúrate de que las credenciales de Supabase sean correctas.
              </p>
              <Button 
                variant="secondary" 
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-2xl border-2 border-navy/10 bg-white p-4 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="size-5 text-navy/60" />
            <h2 className="font-display text-lg font-bold text-navy">Filtros</h2>
            {activeFiltersCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-orange text-white text-xs font-bold">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Button variant="ghost" onClick={clearFilters} className="text-sm gap-1">
                <X className="size-4" />
                Limpiar
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Layers className="size-4" />
              {showFilters ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="grid gap-3 sm:grid-cols-2 animate-fade-up">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-navy">Tipo</span>
              <select
                className="h-11 w-full rounded-xl border-2 border-navy/10 bg-white px-4 text-sm font-medium text-navy shadow-sm outline-none transition hover:border-navy/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
                value={filters.type}
                onChange={(e) => updateFilter('type', e.target.value)}
              >
                <option value="ALL">Todos</option>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-navy">Especie</span>
              <select
                className="h-11 w-full rounded-xl border-2 border-navy/10 bg-white px-4 text-sm font-medium text-navy shadow-sm outline-none transition hover:border-navy/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
                value={filters.species}
                onChange={(e) => updateFilter('species', e.target.value)}
              >
                <option value="">Todas</option>
                {Object.entries(SPECIES_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-navy/10 shadow-lg z-20">
        {loading ? (
          <div className="flex h-[600px] items-center justify-center bg-navy/5">
            <div className="text-center space-y-3">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy/20 border-t-orange"></div>
              <p className="text-sm font-semibold text-navy/70">Cargando mapa...</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={7}
            className="h-[600px] w-full"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapRecenter center={mapCenter} />

            {/* Renderizar marcadores sin clustering para que siempre se vean las patitas */}
            {publications.map((pub) => {
                if (!pub.approximateLat || !pub.approximateLng) {
                  return null;
                }

                return (
                  <Marker
                    key={pub.id}
                    position={[pub.approximateLat, pub.approximateLng]}
                    icon={MARKER_ICONS[pub.type]}
                  >
                    <Popup
                      maxWidth={320}
                      className="case-popup-wrapper"
                      closeButton={false}
                      autoPan={true}
                      autoPanPadding={[20, 20]}
                    >
                      <CasePopup publication={pub} onClose={() => {}} />
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>
        )}
      </div>

      {/* Leyenda */}
      <div className="rounded-2xl border-2 border-navy/10 bg-white p-6 shadow-md">
        <h3 className="font-display text-lg font-bold text-navy mb-4">Leyenda del mapa</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex items-center gap-3">
            <PawPrint className="size-8 text-lost fill-lost/20" />
            <span className="text-sm font-medium text-navy">Perdida</span>
          </div>
          <div className="flex items-center gap-3">
            <PawPrint className="size-8 text-found fill-found/20" />
            <span className="text-sm font-medium text-navy">Encontrada</span>
          </div>
          <div className="flex items-center gap-3">
            <PawPrint className="size-8 text-purple fill-purple/20" />
            <span className="text-sm font-medium text-navy">Adopción</span>
          </div>
          <div className="flex items-center gap-3">
            <PawPrint className="size-8 text-orange fill-orange/20" />
            <span className="text-sm font-medium text-navy">Avistamiento</span>
          </div>
          <div className="flex items-center gap-3">
            <PawPrint className="size-8 text-navy/60 fill-navy/10" />
            <span className="text-sm font-medium text-navy">Abandonada</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-navy/60 leading-relaxed">
          🐾 Cada huella representa un caso. Las ubicaciones son aproximadas (±50m) para proteger la privacidad. Todas las huellas se muestran en el mapa sin importar el nivel de zoom.
        </p>
      </div>
    </section>
  );
}

export default MapPage;
