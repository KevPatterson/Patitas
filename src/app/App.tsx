import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Home, PawPrint } from 'lucide-react';
import { LinkButton } from '../components/ui/button';
import { SiteShell } from '../components/layout/site-shell';
import { BottomNav } from '../components/layout/bottom-nav';
import { ScrollToTop } from '../components/layout/scroll-to-top';
import { PawLoader } from '../components/ui/paw-loader';
import { ThemeProvider } from './theme-provider';

/**
 * Code splitting por ruta (tarea 6.3).
 *
 * Antes, TODAS las pantallas se empaquetaban en un único `index.js` de ~1,1 MB:
 * el visitante que abría la portada descargaba también el panel de
 * administración, el editor de publicaciones y **Leaflet entero** (unos 150 KB
 * solo la librería de mapas), aunque no fuese a usarlos. En conexiones lentas eso
 * es la diferencia entre ver la página y abandonarla.
 *
 * Ahora cada ruta se carga bajo demanda. Las que casi nadie visita y las que
 * arrastran dependencias pesadas son las que más se nota:
 *   - `/mapa` es la única que importa `leaflet` y `react-leaflet`, así que esos
 *     ~150 KB solo se descargan al abrir el mapa.
 *   - `/admin`, `/publicar` y `/dashboard` van en su propio chunk.
 *
 * Los módulos exportan funciones con nombre (no `default`), así que se mapean a
 * `{ default: … }`, que es lo que `lazy` espera.
 */

const HomePage = lazy(() => import('../routes/home-page').then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() =>
  import('../routes/auth/login-page').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('../routes/auth/register-page').then((m) => ({ default: m.RegisterPage }))
);
const CallbackPage = lazy(() =>
  import('../routes/auth/callback-page').then((m) => ({ default: m.CallbackPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('../routes/auth/forgot-password-page').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('../routes/auth/reset-password-page').then((m) => ({ default: m.ResetPasswordPage }))
);
const SearchPage = lazy(() =>
  import('../routes/search-page').then((m) => ({ default: m.SearchPage }))
);
const MapPage = lazy(() => import('../routes/map-page').then((m) => ({ default: m.MapPage })));
const AdminPublicationPage = lazy(() =>
  import('../routes/admin-publication-page').then((m) => ({ default: m.AdminPublicationPage }))
);
const PublishPage = lazy(() =>
  import('../routes/publish-page').then((m) => ({ default: m.PublishPage }))
);
const ProfilePage = lazy(() =>
  import('../routes/profile-page').then((m) => ({ default: m.ProfilePage }))
);
const PublicationPage = lazy(() =>
  import('../routes/publication-page').then((m) => ({ default: m.PublicationPage }))
);
const AdminPage = lazy(() => import('../routes/admin-page').then((m) => ({ default: m.AdminPage })));
const NotificationsPage = lazy(() =>
  import('../routes/notifications-page').then((m) => ({ default: m.NotificationsPage }))
);
const AdoptionsPage = lazy(() =>
  import('../routes/adoptions-page').then((m) => ({ default: m.AdoptionsPage }))
);
const HowItWorksPage = lazy(() =>
  import('../routes/how-it-works-page').then((m) => ({ default: m.HowItWorksPage }))
);
const DashboardPage = lazy(() =>
  import('../routes/dashboard-page').then((m) => ({ default: m.DashboardPage }))
);
const NearbyPage = lazy(() =>
  import('../routes/nearby-page').then((m) => ({ default: m.NearbyPage }))
);

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center py-10">
      <div className="flex flex-col items-center gap-3">
        <PawLoader size="lg" />
        <p className="font-display text-sm font-semibold text-navy/70">Cargando…</p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] py-16 px-4">
      <div className="max-w-lg w-full">
        <div className="relative overflow-hidden rounded-3xl border-2 border-navy/10 bg-white p-10 text-center shadow-xl">
          {/* Decoraciones de fondo */}
          <div className="blob-decoration absolute top-5 right-5 size-20 bg-orange/10" />
          <div className="blob-decoration absolute bottom-5 left-5 size-16 bg-turquoise/10" style={{ animationDelay: '2s' }} />
          
          <div className="relative z-10 space-y-6">
            {/* Mascota perdida animada */}
            <div className="flex justify-center mb-4">
              <div className="text-6xl animate-shake">🐶</div>
            </div>
            
            <div className="space-y-3">
              <h1 className="font-display text-3xl md:text-4xl font-extrabold text-navy leading-tight">
                ¡Ups! Esta patita se perdió
              </h1>
              <p className="text-navy/70 leading-relaxed">
                La página que buscas no existe o se movió. Pero ninguna patita se queda sin casa — te ayudamos a volver.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <LinkButton href="/" variant="primary">
                <Home className="size-4" aria-hidden="true" />
                Volver al inicio
              </LinkButton>
              <LinkButton href="/buscar" variant="secondary">
                <PawPrint className="size-4" aria-hidden="true" />
                Buscar mascota
              </LinkButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <ThemeProvider>
      <SiteShell>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route path="/auth/callback" element={<CallbackPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/buscar" element={<SearchPage />} />
            <Route path="/cerca-de-ti" element={<NearbyPage />} />
            <Route path="/mapa" element={<MapPage />} />
            <Route path="/publicar" element={<PublishPage />} />
            <Route path="/adopciones" element={<AdoptionsPage />} />
            <Route path="/p/:slug" element={<PublicationPage />} />
            <Route path="/perfil/:username" element={<ProfilePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/publicaciones/:id" element={<AdminPublicationPage />} />
            <Route path="/notificaciones" element={<NotificationsPage />} />
            <Route path="/como-funciona" element={<HowItWorksPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <BottomNav />
      </SiteShell>
    </ThemeProvider>
  );
}
