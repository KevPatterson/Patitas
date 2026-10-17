import { Route, Routes } from 'react-router-dom';
import { Home, PawPrint } from 'lucide-react';
import { LinkButton } from '../components/ui/button';
import { SiteShell } from '../components/layout/site-shell';
import { BottomNav } from '../components/layout/bottom-nav';
import { ScrollToTop } from '../components/layout/scroll-to-top';
import { HomePage } from '../routes/home-page';
import { LoginPage } from '../routes/auth/login-page';
import { RegisterPage } from '../routes/auth/register-page';
import { CallbackPage } from '../routes/auth/callback-page';
import { ForgotPasswordPage } from '../routes/auth/forgot-password-page';
import { ResetPasswordPage } from '../routes/auth/reset-password-page';
import { SearchPage } from '../routes/search-page';
import { MapPage } from '../routes/map-page';
import { AdminPublicationPage } from '../routes/admin-publication-page';
import { PublishPage } from '../routes/publish-page';
import { ProfilePage } from '../routes/profile-page';
import { PublicationPage } from '../routes/publication-page';
import { AdminPage } from '../routes/admin-page';
import { NotificationsPage } from '../routes/notifications-page';
import { AdoptionsPage } from '../routes/adoptions-page';
import { HowItWorksPage } from '../routes/how-it-works-page';
import { DashboardPage } from '../routes/dashboard-page';
import { NearbyPage } from '../routes/nearby-page';
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
    <SiteShell>
      <ScrollToTop />
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
        {/* Resolutor por id: las colas de administración conocen el uuid, no el slug. */}
        <Route path="/admin/publicaciones/:id" element={<AdminPublicationPage />} />
        <Route path="/notificaciones" element={<NotificationsPage />} />
        <Route path="/como-funciona" element={<HowItWorksPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
    </SiteShell>
  );
}