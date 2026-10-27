import { useEffect, useState } from 'react';
import { Search, MapPin, Heart, BadgeCheck, PawPrint, TrendingUp, Users, Map as MapIcon } from 'lucide-react';
import { LinkButton } from '../components/ui/button';
import { StatCard } from '../components/ui/stat-card';
import { PublicationCard } from '../components/publications/publication-card';
import { PawTrail } from '../components/ui/paw-loader';
import { EmptyState } from '../components/ui/empty-state';
import { ScrollReveal } from '../components/ui/scroll-reveal';
import { setPageMeta } from '../lib/seo/page-meta';
import { SITE_NAME, SITE_DESCRIPTION } from '../lib/config/site';
import {
  searchPublications,
  countPublications,
  getSuccessStories,
  type PublicationSummary,
} from '../lib/supabase/publication-search';
import { MapPreview } from '../components/home/map-preview';
import { SuccessStoriesSection } from '../components/home/success-stories-section';

export function HomePage() {
  const [allCases, setAllCases] = useState<PublicationSummary[]>([]);
  const [recentCases, setRecentCases] = useState<PublicationSummary[]>([]);
  const [adoptionCases, setAdoptionCases] = useState<PublicationSummary[]>([]);
  const [successStories, setSuccessStories] = useState<PublicationSummary[]>([]);
  const [stats, setStats] = useState({ LOST: 0, FOUND: 0, ADOPTION: 0, ADOPTED: 0, total: 0 });
  const [nearbyCount, setNearbyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() => {
    // Cargar ubicación guardada de localStorage al inicio
    try {
      const saved = localStorage.getItem('userLocation');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Error cargando ubicación guardada:', error);
    }
    return null;
  });

  const [_locationError, setLocationError] = useState(false);

  const [loadingLocation, setLoadingLocation] = useState(() => {
    // Si ya tiene ubicación guardada, no mostrar indicador
    try {
      const saved = localStorage.getItem('userLocation');
      return !saved; // true si NO hay ubicación guardada
    } catch {
      return true;
    }
  });
  useEffect(() => {
    setPageMeta({
      title: `${SITE_NAME} · Que ninguna patita se quede sin casa`,
      description: SITE_DESCRIPTION,
      canonicalPath: '/',
    });

    let permissionListener: (() => void) | null = null;
    let isRequestingLocation = false;
    let retryCount = 0;
    const MAX_RETRIES = 2;

    // Función para obtener la ubicación aproximada por IP (fallback)
    const getFallbackLocation = async () => {
      // Sin timeout, una red lenta deja el indicador de ubicación cargando para siempre
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Respuesta ${response.status}`);
        }
        const data = await response.json();

        if (data.latitude && data.longitude) {
          const location = { lat: data.latitude, lng: data.longitude };
          setUserLocation(location);
          // Guardar en localStorage
          localStorage.setItem('userLocation', JSON.stringify(location));
          setLocationError(false);
          setLoadingLocation(false);
          return true;
        }
      } catch (error) {
        console.warn('No se pudo obtener la ubicación por IP:', error);
      } finally {
        clearTimeout(timeoutId);
      }
      setLoadingLocation(false);
      return false;
    };

    // Función para obtener la ubicación
    const getLocation = async () => {
      if (isRequestingLocation || !('geolocation' in navigator)) {
        // Si no hay geolocalización, intentar fallback por IP
        if (!('geolocation' in navigator)) {
          await getFallbackLocation();
        }
        return;
      }

      isRequestingLocation = true;
      setLoadingLocation(true);
      
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
          isRequestingLocation = false;
          retryCount = 0;
          setLoadingLocation(false);
        },
        async (error) => {
          isRequestingLocation = false;
          
          // Si es timeout y no hemos excedido reintentos, intentar de nuevo
          if (error.code === 3 && retryCount < MAX_RETRIES) { // 3 = TIMEOUT
            retryCount++;
            setTimeout(() => getLocation(), 1000);
            return;
          }

          // Si agotamos reintentos o es otro error, intentar fallback por IP
          const fallbackSuccess = await getFallbackLocation();
          
          if (!fallbackSuccess) {
            if (error.code !== 1) {
              console.warn('No se pudo obtener ubicación');
            }
            setLocationError(true);
            setLoadingLocation(false);
          }
        },
        {
          enableHighAccuracy: true, // Mejor precisión GPS
          timeout: 20000, // 20 segundos para dar más tiempo con alta precisión
          maximumAge: 0, // No usar caché, siempre obtener ubicación fresca
        }
      );
    };

    // Obtener ubicación inicial
    getLocation();

    // Observar cambios en los permisos de geolocalización
    if ('permissions' in navigator && 'query' in navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then((permissionStatus) => {
          // Listener para detectar cambios en el permiso
          const handlePermissionChange = () => {
            if (permissionStatus.state === 'granted') {
              // Usuario acaba de otorgar el permiso, obtener ubicación
              getLocation();
            } else if (permissionStatus.state === 'denied') {
              // Usuario denegó el permiso
              setUserLocation(null);
              setLocationError(true);
            }
          };
          
          permissionStatus.addEventListener('change', handlePermissionChange);
          permissionListener = () => {
            permissionStatus.removeEventListener('change', handlePermissionChange);
          };
        })
        .catch(() => {
          // Permissions API no soportada, no hacer nada
        });
    }

    return () => {
      if (permissionListener) {
        permissionListener();
      }
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // allSettled: con red inestable, un fallo parcial no debe vaciar toda la portada
        const results = await Promise.allSettled([
          searchPublications({ status: 'ACTIVE', limit: 50, offset: 0 }), // Cargar más para filtrar por distancia
          searchPublications({ type: 'ADOPTION', status: 'ACTIVE', limit: 3, offset: 0 }),
          countPublications({ type: 'LOST', status: 'ACTIVE' }),
          countPublications({ type: 'FOUND', status: 'ACTIVE' }),
          countPublications({ type: 'ADOPTION', status: 'ACTIVE' }),
          countPublications({ type: 'ADOPTION', status: 'RESOLVED' }),
          countPublications({ status: 'ACTIVE' }),
          getSuccessStories(6),
        ]);

        if (!active) return;

        const [recent, adoptions, lostCount, foundCount, adoptionCount, adoptedCount, totalCount, success] = results;

        for (const result of results) {
          if (result.status === 'rejected') {
            console.warn('No se pudo cargar una parte de la portada:', result.reason);
          }
        }

        if (recent.status === 'fulfilled') {
          setAllCases(recent.value); // Guardar todos los casos
        }
        if (adoptions.status === 'fulfilled') {
          setAdoptionCases(adoptions.value);
        }
        if (success.status === 'fulfilled') {
          setSuccessStories(success.value);
        }

        setStats((prev) => ({
          LOST: lostCount.status === 'fulfilled' ? lostCount.value : prev.LOST,
          FOUND: foundCount.status === 'fulfilled' ? foundCount.value : prev.FOUND,
          ADOPTION: adoptionCount.status === 'fulfilled' ? adoptionCount.value : prev.ADOPTION,
          ADOPTED: adoptedCount.status === 'fulfilled' ? adoptedCount.value : prev.ADOPTED,
          total: totalCount.status === 'fulfilled' ? totalCount.value : prev.total,
        }));
      } catch (error) {
        console.error('Error loading home data:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);
  // Efecto separado para reordenar casos cuando cambia la ubicación
  useEffect(() => {
    if (allCases.length === 0) return;

    let sortedRecent = allCases;
    
    if (userLocation) {
      const withDistance = allCases
        .map((pub: PublicationSummary & { distance?: number }) => {
          // Calcular distancia si la publicación tiene coordenadas
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
        .sort((a: PublicationSummary & { distance?: number }, b: PublicationSummary & { distance?: number }) => 
          (a.distance || Infinity) - (b.distance || Infinity)
        );
      
      // Contar casos dentro de 10km
      const nearby = withDistance.filter(c => c.distance !== undefined && c.distance <= 10).length;
      setNearbyCount(nearby);
      
      sortedRecent = withDistance;
    } else {
      setNearbyCount(0);
    }
    
    setRecentCases(sortedRecent.slice(0, 6));
  }, [allCases, userLocation]);

  // Función para calcular distancia entre dos coordenadas (fórmula de Haversine)
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

  return (
    <div className="space-y-16 pb-16 pt-6 md:pt-10">
      {/* 🎨 HERO ANIME - Sección principal */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-orange/5 via-app to-turquoise/5 border-2 border-foreground/10 shadow-xl">
        {/* Decoraciones de fondo */}
        <div className="absolute inset-0 hero-gradient" />
        <div className="blob-decoration absolute top-10 right-10 size-32 bg-orange/20" />
        <div className="blob-decoration absolute bottom-10 left-10 size-40 bg-turquoise/15" style={{ animationDelay: '2s' }} />
        
        {/* Contenido del hero */}
        <div className="relative grid gap-8 lg:grid-cols-2 lg:gap-12 p-8 md:p-12 lg:p-16">
          {/* Lado izquierdo: Texto y CTAs */}
          <div className="flex flex-col justify-center space-y-6 z-10">
            <div className="inline-flex items-center gap-2 rounded-pill bg-surface/80 backdrop-blur-sm px-4 py-2 text-sm font-bold text-foreground shadow-sm border border-foreground/10 self-start">
              <PawPrint className="size-4 text-orange animate-paw-bounce" aria-hidden="true" />
              Plataforma comunitaria cubana
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-foreground animate-fade-up">
              Cada patita merece volver a casa
            </h1>
            
            <p className="text-lg md:text-xl leading-relaxed text-foreground/70 max-w-xl animate-fade-up" style={{ animationDelay: '100ms' }}>
              Ayuda a encontrar, proteger y dar un nuevo hogar a quienes más lo necesitan. Juntos hacemos la diferencia.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
              <LinkButton href="/buscar" variant="primary" className="group">
                <Search className="size-5 transition-transform duration-base group-hover:scale-110" />
                Buscar una patita
              </LinkButton>
              <LinkButton href="/publicar" variant="secondary" className="group">
                <PawPrint className="size-5 transition-transform duration-base group-hover:rotate-12" />
                Publicar un caso
              </LinkButton>
            </div>

            {/* Mini stats en el hero */}
            <div className="grid grid-cols-3 gap-3 pt-4 animate-fade-up" style={{ animationDelay: '300ms' }}>
              <div className="rounded-xl bg-surface/60 backdrop-blur-sm p-3 border border-foreground/10">
                <p className="font-display text-2xl font-extrabold text-lost">{stats.LOST}</p>
                <p className="text-xs font-medium text-foreground/70">Perdidos</p>
              </div>
              <div className="rounded-xl bg-surface/60 backdrop-blur-sm p-3 border border-foreground/10">
                <p className="font-display text-2xl font-extrabold text-found">{stats.FOUND}</p>
                <p className="text-xs font-medium text-foreground/70">Encontrados</p>
              </div>
              <div className="rounded-xl bg-surface/60 backdrop-blur-sm p-3 border border-foreground/10">
                <p className="font-display text-2xl font-extrabold text-purple">{stats.ADOPTION}</p>
                <p className="text-xs font-medium text-foreground/70">En adopción</p>
              </div>
            </div>
          </div>

          {/* Lado derecho: Ilustración con logo animado */}
          <div className="relative flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
              <div className="relative aspect-square flex items-center justify-center">
                {/* Círculo decorativo de fondo */}
                <div className="absolute inset-0 rounded-full bg-linear-to-br from-orange/20 to-turquoise/20 animate-float" />
                
                {/* Logo grande central */}
                <div className="relative z-10 scale-150 transform">
                  <svg
                    width="120"
                    height="120"
                    viewBox="0 0 120 120"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    className="drop-shadow-xl"
                    style={{ color: 'hsl(var(--primary))' }}
                  >
                    {/* Almohadilla con gradiente */}
                    <defs>
                      <linearGradient id="paw-gradient" x1="60" y1="54" x2="60" y2="110" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--primary) / 0.9)" />
                      </linearGradient>
                      <mask id="paw-mask-hero">
                        <rect width="120" height="120" fill="white" />
                        <circle cx="60" cy="75" r="8" fill="black" />
                      </mask>
                    </defs>

                    {/* Toda la huella (dedos + almohadilla) se anima como una sola unidad */}
                    <g className="animate-float">
                      <ellipse
                        cx="24"
                        cy="48"
                        rx="9"
                        ry="12"
                        transform="rotate(-22 24 48)"
                        fill="currentColor"
                      />
                      <ellipse
                        cx="45"
                        cy="28"
                        rx="9"
                        ry="13"
                        transform="rotate(-8 45 28)"
                        fill="currentColor"
                      />
                      <ellipse
                        cx="75"
                        cy="28"
                        rx="9"
                        ry="13"
                        transform="rotate(8 75 28)"
                        fill="currentColor"
                      />
                      <ellipse
                        cx="96"
                        cy="48"
                        rx="9"
                        ry="12"
                        transform="rotate(22 96 48)"
                        fill="currentColor"
                      />
                      <path
                        d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z"
                        fill="url(#paw-gradient)"
                        mask="url(#paw-mask-hero)"
                      />
                    </g>
                  </svg>
                </div>
                
                {/* Iconos de huellas decorativas más pequeñas */}
                <div className="absolute top-10 left-10 animate-paw-bounce" style={{ animationDelay: '0s' }}>
                  <PawPrint className="size-8 text-orange/40" />
                </div>
                <div className="absolute top-20 right-16 animate-paw-bounce" style={{ animationDelay: '400ms' }}>
                  <PawPrint className="size-6 text-turquoise/40" />
                </div>
                <div className="absolute bottom-16 left-16 animate-paw-bounce" style={{ animationDelay: '800ms' }}>
                  <PawPrint className="size-10 text-purple/40" />
                </div>
                <div className="absolute bottom-10 right-10 animate-paw-bounce" style={{ animationDelay: '1200ms' }}>
                  <PawPrint className="size-7 text-orange/40" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🐾 CASOS CERCA DE TI */}
      <ScrollReveal animation="fade-up">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="size-5 text-turquoise" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Casos activos</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-extrabold text-foreground">
                {userLocation ? '🐾 Casos cerca de ti' : '🐾 Casos recientes'}
              </h2>
              {loadingLocation && (
                <div className="mt-3 flex items-center gap-3 bg-turquoise/10 border-2 border-turquoise/20 rounded-xl px-4 py-3">
                  <div className="relative flex items-center justify-center">
                    <span className="absolute inline-block size-8 rounded-full bg-turquoise/40 animate-ping" />
                    <span className="relative inline-block size-4 rounded-full bg-turquoise" />
                  </div>
                  <p className="text-sm font-semibold text-turquoise">
                    Obteniendo tu ubicación...
                  </p>
                </div>
              )}
              {!loadingLocation && (
                <p className="text-foreground/60 mt-1 flex items-center gap-2">
                  {userLocation ? (
                    'Ordenados por proximidad a tu ubicación'
                  ) : (
                    'Últimos casos publicados'
                  )}
                </p>
              )}
            </div>
            <LinkButton href="/cerca-de-ti" variant="ghost" className="hidden sm:flex">
              Ver todos →
            </LinkButton>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <PawTrail />
              <p className="text-sm text-foreground/60">Cargando casos recientes...</p>
            </div>
          ) : recentCases.length === 0 ? (
            <EmptyState
              title="No hay casos recientes"
              description="Sé el primero en publicar un caso y ayudar a una patita."
              illustration="cat"
              action={<LinkButton href="/publicar" variant="primary">Publicar caso</LinkButton>}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recentCases.map((pub, index) => (
                <ScrollReveal key={pub.id} animation="scale-in" delay={index * 100}>
                  <PublicationCard 
                    publication={pub} 
                    distance={pub.distance}
                  />
                </ScrollReveal>
              ))}
            </div>
          )}

          <div className="text-center pt-4">
            <LinkButton href="/cerca-de-ti" variant="ghost" className="sm:hidden">
              Ver todos los casos →
            </LinkButton>
          </div>
        </section>
      </ScrollReveal>

      {/* 💜 ADOPCIONES - Nueva sección */}
      <ScrollReveal animation="fade-up">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Heart className="size-5 text-purple" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Adopta, no compres</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-extrabold text-foreground">
                💜 Buscan un hogar
              </h2>
              <p className="text-foreground/60 mt-1">Estas patitas están esperando por ti</p>
            </div>
            <LinkButton href="/adopciones" variant="ghost" className="hidden sm:flex">
              Ver todas →
            </LinkButton>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <PawTrail />
              <p className="text-sm text-foreground/60">Cargando adopciones...</p>
            </div>
          ) : adoptionCases.length === 0 ? (
            <EmptyState
              title="No hay mascotas en adopción ahora"
              description="Vuelve pronto para encontrar tu nuevo mejor amigo."
              illustration="cat"
              action={<LinkButton href="/publicar" variant="adoption">Publicar adopción</LinkButton>}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {adoptionCases.map((pub, index) => (
                <ScrollReveal key={pub.id} animation="scale-in" delay={index * 100}>
                  <PublicationCard publication={pub} />
                </ScrollReveal>
              ))}
            </div>
          )}

          <div className="text-center pt-4">
            <LinkButton href="/adopciones" variant="ghost" className="sm:hidden">
              Ver todas las adopciones →
            </LinkButton>
          </div>
        </section>
      </ScrollReveal>

      {/* 💚 FINALES FELICES — reencuentros y adopciones resueltas */}
      <SuccessStoriesSection stories={successStories} loading={loading} />

      {/* 🗺️ EXPLORA EN EL MAPA */}
      <ScrollReveal animation="fade-in-left">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-turquoise/10 to-purple/10 border-2 border-foreground/10 p-8 md:p-12">
          <div className="relative z-10 grid gap-8 lg:grid-cols-2 items-center">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapIcon className="size-5 text-turquoise" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Geolocalización</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                🗺️ Explora en el mapa
              </h2>
              <p className="text-lg text-foreground/70 mb-6 leading-relaxed">
                Visualiza todos los casos cerca de ti. Cada marcador es una historia esperando un final feliz.
              </p>
              <LinkButton href="/mapa" variant="secondary">
                Abrir mapa →
              </LinkButton>
            </div>
            <MapPreview nearbyCount={nearbyCount} />
          </div>
        </section>
      </ScrollReveal>

      {/* 🐾 MODO RESCATE - Cómo funciona */}
      <ScrollReveal animation="fade-up">
        <section className="space-y-8">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Heart className="size-5 text-orange" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">Modo rescate</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-foreground">
              Es más fácil de lo que piensas
            </h2>
            <p className="text-foreground/60 max-w-2xl mx-auto">
              Tres pasos simples para hacer la diferencia
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 justify-center">
            {/* Paso 1 */}
            <ScrollReveal animation="scale-in" delay={0}>
              <div className="group relative overflow-hidden rounded-2xl bg-surface border-2 border-foreground/10 p-8 shadow-md hover:shadow-xl transition-all duration-base hover:-translate-y-2">
                <div className="absolute top-4 right-4 text-6xl font-display font-extrabold text-orange/10">01</div>
                <div className="relative space-y-4">
                  <div className="size-12 rounded-xl bg-orange/10 flex items-center justify-center">
                    <PawPrint className="size-6 text-orange" />
                  </div>
                  <h3 className="font-display text-2xl font-extrabold text-foreground">PUBLICA</h3>
                  <p className="text-foreground/70 leading-relaxed">
                    Describe la mascota y comparte su ubicación. Todo es seguro y privado.
                  </p>
                </div>
              </div>
            </ScrollReveal>

            {/* Paso 2 */}
            <ScrollReveal animation="scale-in" delay={150}>
              <div className="group relative overflow-hidden rounded-2xl bg-surface border-2 border-foreground/10 p-8 shadow-md hover:shadow-xl transition-all duration-base hover:-translate-y-2">
                <div className="absolute top-4 right-4 text-6xl font-display font-extrabold text-turquoise/10">02</div>
                <div className="relative space-y-4">
                  <div className="size-12 rounded-xl bg-turquoise/10 flex items-center justify-center">
                    <Users className="size-6 text-turquoise" />
                  </div>
                  <h3 className="font-display text-2xl font-extrabold text-foreground">CONECTA</h3>
                  <p className="text-foreground/70 leading-relaxed">
                    La comunidad ayuda a difundir el caso. Miles de ojos buscando.
                  </p>
                </div>
              </div>
            </ScrollReveal>

            {/* Paso 3 */}
            <ScrollReveal animation="scale-in" delay={300}>
              <div className="group relative overflow-hidden rounded-2xl bg-surface border-2 border-foreground/10 p-8 shadow-md hover:shadow-xl transition-all duration-base hover:-translate-y-2">
                <div className="absolute top-4 right-4 text-6xl font-display font-extrabold text-purple/10">03</div>
                <div className="relative space-y-4">
                  <div className="size-12 rounded-xl bg-purple/10 flex items-center justify-center">
                    <BadgeCheck className="size-6 text-purple" />
                  </div>
                  <h3 className="font-display text-2xl font-extrabold text-foreground">REENCUENTRA</h3>
                  <p className="text-foreground/70 leading-relaxed">
                    La historia termina con una mascota de vuelta en casa. ❤️
                  </p>
                </div>
              </div>
            </ScrollReveal>

          </div>
        </section>
      </ScrollReveal>

      {/* 📊 ESTADÍSTICAS DE LA COMUNIDAD */}
      <ScrollReveal animation="fade-up">
        <section className="grid gap-6 md:grid-cols-4">
          <StatCard 
            value={stats.total.toLocaleString()} 
            label="Casos activos" 
            icon={<TrendingUp className="size-8" />}
          />
          <StatCard 
            value={stats.LOST.toLocaleString()} 
            label="Perdidos" 
            tone="warning"
            icon={<PawPrint className="size-8" />}
          />
          <StatCard 
            value={stats.FOUND.toLocaleString()} 
            label="Encontrados" 
            tone="success"
            icon={<BadgeCheck className="size-8" />}
          />
          <StatCard 
            value={stats.ADOPTION.toLocaleString()} 
            label="En adopción" 
            tone="adoption"
            icon={<Heart className="size-8" />}
          />
          <StatCard 
            value={stats.ADOPTED.toLocaleString()} 
            label="Adoptados" 
            tone="success"
            icon={<Heart className="size-8" />}
          />
        </section>
      </ScrollReveal>
    </div>
  );
}

export default HomePage;