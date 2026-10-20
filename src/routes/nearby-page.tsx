import { useEffect, useState, useCallback } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PublicationCard } from '../components/publications/publication-card';
import { PawTrail } from '../components/ui/paw-loader';
import { EmptyState } from '../components/ui/empty-state';
import { ScrollReveal } from '../components/ui/scroll-reveal';
import { setPageMeta } from '../lib/seo/page-meta';
import { searchPublications, type PublicationSummary } from '../lib/supabase/publication-search';

type PublicationWithDistance = PublicationSummary & { distance?: number };

export function NearbyPage() {
  const [allCases, setAllCases] = useState<PublicationWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() => {
    // Cargar ubicación guardada de localStorage al inicio
    try {
      const saved = localStorage.getItem('userLocation');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('📦 Ubicación cargada de localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.warn('Error cargando ubicación guardada:', error);
    }
    return null;
  });
  const [locationError, setLocationError] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: 'Casos Cerca de Ti · Patitas',
      description: 'Encuentra mascotas perdidas, encontradas y en adopción cerca de tu ubicación.',
      canonicalPath: '/cerca-de-ti',
    });
  }, []);

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
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

  const getFallbackLocation = useCallback(async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();

      if (data.latitude && data.longitude) {
        const location = {
          lat: data.latitude,
          lng: data.longitude,
        };
        setUserLocation(location);
        // Guardar en localStorage
        localStorage.setItem('userLocation', JSON.stringify(location));
        setLocationError(false);
        return true;
      }
    } catch (_error) {
      console.warn('No se pudo obtener ubicación por IP:', _error);
    }
    return false;
  }, []);

  const getLocation = useCallback(async () => {
    if (requestingLocation || !('geolocation' in navigator)) {
      if (!('geolocation' in navigator)) {
        await getFallbackLocation();
      }
      return;
    }

    setRequestingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        // Guardar en localStorage
        localStorage.setItem('userLocation', JSON.stringify(location));
        setLocationError(false);
        setRequestingLocation(false);
      },
      async () => {
        setRequestingLocation(false);
        console.warn('Error obteniendo ubicación GPS, intentando por IP...');
        const fallbackSuccess = await getFallbackLocation();
        if (!fallbackSuccess) {
          setLocationError(true);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  }, [requestingLocation, getFallbackLocation]);

  // Obtener ubicación
  useEffect(() => {
    getLocation();
  }, [getLocation]);

  // Cargar casos
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const cases = await searchPublications({ status: 'ACTIVE', limit: 100, offset: 0 });

        if (active) {
          setAllCases(cases);
        }
      } catch (_error) {
        console.error('Error loading nearby cases:', _error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  // Reordenar cuando cambia la ubicación
  useEffect(() => {
    if (allCases.length === 0 || !userLocation) return;

    setAllCases((currentCases) => {
      return currentCases
        .map((pub) => {
          if (pub.approximateLat && pub.approximateLng) {
            const distance = calculateDistance(
              userLocation.lat,
              userLocation.lng,
              pub.approximateLat,
              pub.approximateLng
            );
            return { ...pub, distance };
          }
          return { ...pub, distance: Infinity };
        })
        .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    });
  }, [userLocation, allCases.length]);


  const handleRequestLocation = () => {
    getLocation();
  };

  return (
    <div className="space-y-8 py-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-turquoise/10 via-app to-orange/10 border-2 border-foreground/10 p-8 md:p-12 shadow-md">
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="size-6 text-turquoise animate-paw-bounce" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              {userLocation ? 'Cerca de ti' : 'Casos activos'}
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold text-foreground mb-4">
            {userLocation ? '📍 Casos cerca de ti' : '🐾 Todos los casos'}
          </h1>
          <p className="text-lg text-foreground/70 leading-relaxed max-w-2xl">
            {userLocation
              ? 'Casos ordenados por proximidad a tu ubicación actual.'
              : 'Encuentra mascotas perdidas, encontradas y en adopción.'}
          </p>

          {locationError && !userLocation && (
            <div className="mt-4">
              <Button onClick={handleRequestLocation} disabled={requestingLocation} className="gap-2">
                <Navigation className="size-5" />
                {requestingLocation ? 'Obteniendo ubicación...' : 'Activar ubicación'}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Casos */}
      <section className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <PawTrail />
            <p className="text-sm text-foreground/60">Cargando casos...</p>
          </div>
        ) : allCases.length === 0 ? (
          <EmptyState
            title="No hay casos activos"
            description="Aún no hay publicaciones activas en este momento."
            illustration="cat"
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground/60">
                {allCases.length} caso{allCases.length !== 1 ? 's' : ''} encontrado{allCases.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allCases.map((pub, index) => (
                <ScrollReveal key={pub.id} animation="scale-in" delay={Math.min(index * 50, 300)}>
                  <PublicationCard 
                    publication={pub} 
                    distance={pub.distance}
                  />
                </ScrollReveal>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default NearbyPage;
