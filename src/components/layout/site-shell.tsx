import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, MapPin, LogOut, User, MessageCircle, type LucideIcon } from 'lucide-react';
import { signOut } from '../../lib/supabase/auth';
import { useAuth } from '../../app/auth-context';
import { useNotificationCount } from '../../lib/hooks/use-notification-count';
import { useChatUnreadCount } from '../../lib/hooks/use-chat-unread-count';
import { getOAuthAvatarUrl, getProfileAvatarUrl, AVATAR_UPDATED_EVENT } from '../../lib/supabase/profiles';
import { Logo } from '../Logo';
import { ThemeSwitch } from '../ui/theme-switch';

interface DevTeamMember {
  name: string;
  initials: string;
  role: string;
  github: string;
  whatsapp?: string;
  avatar?: string;
}

const devTeam: DevTeamMember[] = [
  { 
    name: 'Kevin Patterson', 
    initials: 'KP', 
    role: 'Founder & Full-stack Developer', 
    github: 'https://github.com/KevPatterson',
    whatsapp: 'https://wa.me/5356954200',
    avatar: 'https://github.com/KevPatterson.png'
  },
];

function GithubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

type SiteShellProps = {
  children: React.ReactNode;
};
function NavItem({
  href,
  label,
  Icon,
  badge,
  badgeLabel = 'elementos sin leer',
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  badge?: number;
  badgeLabel?: string;
}) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) => [
        'relative flex items-center gap-2 rounded-[14px] border-2 px-3.5 py-2 text-sm font-semibold transition-all duration-base',
        isActive
          ? 'border-foreground bg-highlight text-foreground'
          : 'border-transparent text-[hsl(var(--muted-foreground))] hover:bg-highlight hover:text-foreground',
      ].join(' ')}
    >
      {({ isActive: _isActive }) => (
        <>
          <Icon className="size-5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          {label}
          {(badge ?? 0) > 0 && (
            <span 
              className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-foreground bg-found px-1 text-[11px] font-bold leading-none text-primary-foreground"
              aria-label={`${badge} ${badgeLabel}`}
            >
              {(badge ?? 0) > 9 ? '9+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/**
 * Acceso compacto a mensajes para móvil. La cabecera es el sitio acordado
 * para el chat: la BottomNav se queda con las cinco secciones principales.
 */
function MobileIconLink({
  href,
  label,
  Icon,
  badge,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  badge?: number;
}) {
  return (
    <Link
      to={href}
      className="relative flex size-[42px] items-center justify-center rounded-[14px] border-2 border-transparent text-[hsl(var(--muted-foreground))] transition-all duration-base hover:border-foreground hover:bg-highlight hover:text-foreground active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
      aria-label={
        (badge ?? 0) > 0 ? `${label} (${badge} sin leer)` : label
      }
    >
      <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
      {(badge ?? 0) > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-foreground bg-found px-1 text-[11px] font-bold leading-none text-primary-foreground">
          {(badge ?? 0) > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

export function SiteShell({ children }: SiteShellProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useNotificationCount();
  const unreadChatCount = useChatUnreadCount();
  // Tras iniciar sesión se vuelve al destino actual; dentro de las páginas de
  // auth se deja la ruta pelada para no encadenar redirecciones.
  const loginHref = location.pathname.startsWith('/auth')
    ? '/auth/login'
    : `/auth/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setLoggingOut(false);
    }
  };
  // El botón del header lleva al panel de gestión (privado). El perfil público
  // se abre desde ahí con "Ver mi perfil público" o desde una publicación.
  const panelHref = '/dashboard';

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null);
      return;
    }

    let active = true;

    const loadAvatar = async () => {
      const oauthAvatar = getOAuthAvatarUrl(user);
      const profileAvatar = await getProfileAvatarUrl(user.id);
      if (active) setAvatarUrl(profileAvatar ?? oauthAvatar);
    };

    void loadAvatar();

    const handler = () => {
      void loadAvatar();
    };
    window.addEventListener(AVATAR_UPDATED_EVENT, handler);
    return () => {
      active = false;
      window.removeEventListener(AVATAR_UPDATED_EVENT, handler);
    };
  }, [user, authLoading]);

  return (
    <div className="flex min-h-screen flex-col bg-app">
      {/* Primer punto de tabulación: salta la navegación y lleva al contenido. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:border-2 focus:border-foreground focus:bg-surface focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-foreground focus:shadow-lg"
      >
        Saltar al contenido
      </a>
      {/* Header sticky con estilo "sticker" */}
      <header className="sticky top-0 z-40 px-4 py-3.5">
        <div className="relative mx-auto w-full max-w-[1180px]">
          <nav 
            className="flex items-center gap-2 rounded-[22px] border-2 border-foreground bg-surface px-4 py-2 shadow-[0_4px_0_var(--color-orange-900)]"
            aria-label="Principal"
          >
            {/* Logo con componente Logo unificado */}
            <Link 
              to="/" 
              className="mr-auto flex items-center gap-2.5 text-foreground no-underline transition-transform duration-[250ms] hover:-rotate-[12deg] hover:scale-[1.08] focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
              aria-label="Patitas - inicio"
            >
              <Logo variant="mark" size={40} animated />
              <span className="hidden min-[375px]:inline font-display text-[1.65rem] font-extrabold leading-none tracking-[-0.02em] truncate max-w-[160px]">
                patitas
              </span>
            </Link>
            {/* Desktop Navigation Links */}
            <div className="hidden gap-2 lg:flex">
              <NavItem href="/buscar" label="Buscar" Icon={Search} />
              <NavItem href="/mapa" label="Mapa" Icon={MapPin} />
              
              {user && (
                <>
                  <NavItem
                    href="/mensajes"
                    label="Mensajes"
                    Icon={MessageCircle}
                    badge={unreadChatCount}
                    badgeLabel="mensajes sin leer"
                  />
                  <NavItem
                    href="/notificaciones"
                    label="Notificaciones"
                    Icon={Bell}
                    badge={unreadCount}
                    badgeLabel="notificaciones no leídas"
                  />
                </>
              )}
            </div>
            
            {/* Theme Switch - Desktop */}
            <div className="hidden lg:flex items-center ml-2">
              <ThemeSwitch />
            </div>
            
            {/* CTA Publicar - Desktop y tablet */}
            <Link
              to="/publicar"
              className="group mx-2 hidden gap-2 rounded-2xl border-2 border-foreground bg-orange px-5 py-2.5 font-display text-sm font-extrabold text-primary-foreground shadow-[0_4px_0_var(--color-orange-900)] transition-all duration-base hover:-translate-y-0.5 hover:shadow-[0_6px_0_var(--color-orange-900)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-orange-900)] focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange lg:inline-flex"
            >
              <svg 
                className="size-5 transition-transform duration-300 group-hover:-rotate-[20deg] group-hover:scale-[1.2]" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                aria-hidden="true"
              >
                <ellipse cx="6" cy="10" rx="2" ry="2.6"/>
                <ellipse cx="10" cy="5.8" rx="2" ry="2.8"/>
                <ellipse cx="14.5" cy="5.8" rx="2" ry="2.8"/>
                <ellipse cx="18.5" cy="10" rx="2" ry="2.6"/>
                <path d="M12 11c-3 0-5.6 3.4-5.6 6 0 1.8 1.4 2.6 3 2.4 1-.1 1.8-.5 2.6-.5s1.6.4 2.6.5c1.6.2 3-.6 3-2.4 0-2.6-2.6-6-5.6-6z"/>
              </svg>
              Publicar
            </Link>
            
            {/* Theme Switch - Móvil (compacto) */}
            <div className="lg:hidden ml-2">
              <ThemeSwitch compact />
            </div>
            
            {/* User Actions - Desktop y Móvil */}
            {!authLoading && (
              user ? (
                <>
                  {/* Desktop */}
                  <div className="hidden items-center gap-1 lg:flex">
                    <Link
                      to={panelHref}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-surface px-3.5 py-2 text-sm font-semibold text-foreground transition-all duration-base hover:bg-highlight active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
                    >
                      <div className="flex size-[30px] items-center justify-center rounded-full border-2 border-foreground bg-app/50 overflow-hidden">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt="Avatar" 
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="size-4 text-foreground" aria-hidden="true" />
                        )}
                      </div>
                      <span>Mi panel</span>
                    </Link>
                    
                    {/* Salir */}
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex size-[42px] items-center justify-center rounded-[14px] border-2 border-transparent bg-transparent text-[hsl(var(--muted-foreground))] transition-all duration-base hover:border-foreground hover:bg-highlight hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
                      aria-label="Salir"
                    >
                      <LogOut className="size-5" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Móvil - Notificaciones, Perfil y Logout */}
                  <div className="flex items-center gap-1 lg:hidden">
                    <MobileIconLink
                      href="/notificaciones"
                      label="Notificaciones"
                      Icon={Bell}
                      badge={unreadCount}
                    />
                    <Link
                      to={panelHref}
                      className="flex items-center justify-center rounded-full border-2 border-foreground bg-surface p-2 transition-all duration-base hover:bg-highlight active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
                      aria-label="Mi panel"
                    >
                      <div className="flex size-[30px] items-center justify-center rounded-full border-2 border-foreground bg-app/50 overflow-hidden">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt="Avatar" 
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="size-4 text-foreground" aria-hidden="true" />
                        )}
                      </div>
                    </Link>
                    
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex size-[42px] items-center justify-center rounded-[14px] border-2 border-transparent bg-transparent text-[hsl(var(--muted-foreground))] transition-all duration-base hover:border-foreground hover:bg-highlight hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
                      aria-label="Salir"
                    >
                      <LogOut className="size-5" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Móvil - Botón Entrar en esquina derecha */}
                  <Link
                    to={loginHref}
                    className="inline-flex gap-2 rounded-full border-2 border-foreground bg-ink px-4 py-2 text-sm font-extrabold text-cream shadow-sm transition-all duration-base hover:bg-orange-900 hover:scale-105 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange lg:hidden"
                  >
                    Entrar
                  </Link>
                  {/* Desktop */}
                  <Link
                    to={loginHref}
                    className="hidden gap-2 rounded-full border-2 border-foreground bg-ink px-5 py-2 text-sm font-extrabold text-cream shadow-sm transition-all duration-base hover:bg-orange-900 hover:scale-105 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange lg:inline-flex"
                  >
                    Entrar
                  </Link>
                </>
              )
            )}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 pb-40 lg:pb-16 sm:px-6 lg:px-8"
      >
        {children}
      </main>

      {/* Footer rediseñado con personalidad */}
      <footer className="relative border-t-2 border-orange-200 bg-ink text-cream overflow-hidden" role="contentinfo">

        <div className="relative mx-auto w-full max-w-7xl px-4 pt-8 pb-28 sm:px-6 lg:px-8 lg:pb-8">
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
            {/* ===== BRAND / IDENTITY ===== */}
            <section className="w-full lg:w-64 lg:flex-shrink-0" aria-label="Identidad de Patitas">
              <Link to="/" className="flex items-center gap-2 mb-4" aria-label="Patitas - Inicio">
                <Logo variant="mark" size={40} />
                <span className="font-display font-bold text-xl text-cream">Patitas</span>
              </Link>
              <p className="text-cream/70 text-sm leading-relaxed mb-4">
                Plataforma comunitaria para encontrar, publicar y gestionar mascotas perdidas, encontradas y en adopción en Cuba.
              </p>
            </section>

            {/* ===== NAVIGATION COLUMNS ===== */}
            <div className="w-full flex flex-wrap gap-8 lg:gap-12 lg:flex-1" role="navigation" aria-label="Enlaces principales">
              <nav className="flex-1 min-w-[140px]" aria-label="Navegación principal">
                <h3 className="font-display font-bold text-cream text-sm uppercase tracking-wider mb-3">Explorar</h3>
                <ul className="space-y-2" role="list">
                  <li><Link to="/buscar" className="text-cream/80 hover:text-orange transition-colors duration-base text-sm whitespace-nowrap">Buscar mascotas</Link></li>
                  <li><Link to="/adopciones" className="text-cream/80 hover:text-purple transition-colors duration-base text-sm whitespace-nowrap">Adopciones</Link></li>
                  <li><Link to="/mapa" className="text-cream/80 hover:text-turquoise transition-colors duration-base text-sm whitespace-nowrap">Mapa de casos</Link></li>
                  <li><Link to="/publicar" className="text-cream/80 hover:text-cream transition-colors duration-base text-sm whitespace-nowrap font-medium">Publicar caso</Link></li>
                </ul>
              </nav>

              <nav className="flex-1 min-w-[140px]" aria-label="Información y ayuda">
                <h3 className="font-display font-bold text-cream text-sm uppercase tracking-wider mb-3">Información</h3>
                <ul className="space-y-2" role="list">
                  <li><Link to="/como-funciona" className="text-cream/80 hover:text-cream transition-colors duration-base text-sm whitespace-nowrap">Cómo funciona</Link></li>
                  <li><Link to="/preguntas-frecuentes" className="text-cream/80 hover:text-cream transition-colors duration-base text-sm whitespace-nowrap">Preguntas frecuentes</Link></li>
                  <li><Link to="/seguridad" className="text-cream/80 hover:text-cream transition-colors duration-base text-sm whitespace-nowrap">Consejos de seguridad</Link></li>
                  <li><Link to="/contacto" className="text-cream/80 hover:text-cream transition-colors duration-base text-sm whitespace-nowrap">Contacto</Link></li>
                </ul>
              </nav>

              <nav className="flex-1 min-w-[140px]" aria-label="Legal y políticas">
                <h3 className="font-display font-bold text-cream text-sm uppercase tracking-wider mb-3">Legal</h3>
                <ul className="space-y-2" role="list">
                  <li><Link to="/privacidad" className="text-cream/80 hover:text-cream transition-colors duration-base text-sm whitespace-nowrap">Política de privacidad</Link></li>
                  <li><Link to="/terminos" className="text-cream/80 hover:text-cream transition-colors duration-base text-sm whitespace-nowrap">Términos de uso</Link></li>
                  <li><Link to="/cookies" className="text-cream/80 hover:text-cream transition-colors duration-base text-sm whitespace-nowrap">Política de cookies</Link></li>
                  <li><Link to="/accesibilidad" className="text-cream/80 hover:text-cream transition-colors duration-base text-sm whitespace-nowrap">Declaración de accesibilidad</Link></li>
                </ul>
              </nav>
            </div>

            {/* ===== DEV TEAM (Compact) ===== */}
            <section className="w-full lg:w-56 lg:flex-shrink-0" aria-label="Equipo de desarrollo">
              <h3 className="font-display font-bold text-cream text-sm uppercase tracking-wider mb-3 hidden lg:block">Equipo</h3>
              <h3 className="font-display font-bold text-cream text-sm uppercase tracking-wider mb-3 lg:hidden">Equipo de desarrollo</h3>
              <ul className="space-y-3" role="list">
                {devTeam.map((member) => (
                  <li key={member.github} className="flex flex-col items-start gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors duration-base group">
                    <div className="flex items-start gap-3 w-full">
                      <div className="relative flex-shrink-0">
                        {member.avatar ? (
                          <img 
                            src={member.avatar} 
                            alt="" 
                            className="size-10 rounded-full ring-2 ring-orange/30" 
                          />
                        ) : (
                          <div className="size-10 rounded-full bg-orange/20 flex items-center justify-center ring-2 ring-orange/30">
                            <span className="font-display font-bold text-orange-700 text-sm">
                              {member.initials}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <a 
                          href={member.github} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-semibold text-cream group-hover:text-orange transition-colors truncate block"
                        >
                          {member.name}
                        </a>
                        <p className="text-cream/60 text-xs truncate">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex w-full flex-wrap items-center justify-center gap-2.5">
                      <a
                        href={member.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`GitHub de ${member.name}`}
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-cream/20 text-cream/80 transition-colors duration-base hover:border-orange hover:text-orange focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange sm:size-10"
                      >
                        <GithubMark className="size-5" />
                      </a>
                      {member.whatsapp ? (
                        <a
                          href={member.whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp de ${member.name}`}
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-cream/20 text-cream/80 transition-colors duration-base hover:border-found hover:text-found focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange sm:size-10"
                        >
                          <WhatsAppMark className="size-5" />
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </footer>
    </div>
  );
}