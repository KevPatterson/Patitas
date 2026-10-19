import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, Search, MapPin, LogOut, User, PawPrint, type LucideIcon } from 'lucide-react';
import { signOut } from '../../lib/supabase/auth';
import { useAuth } from '../../app/auth-context';
import { useNotificationCount } from '../../lib/hooks/use-notification-count';
import { supabase } from '../../lib/supabase/client';
import { getOAuthAvatarUrl, AVATAR_UPDATED_EVENT } from '../../lib/supabase/profiles';

interface DevTeamMember {
  name: string;
  initials: string;
  role: string;
  github: string;
  avatar?: string;
}

const devTeam: DevTeamMember[] = [
  { 
    name: 'Kevin Patterson', 
    initials: 'KP', 
    role: 'Founder & Full-stack Developer', 
    github: 'https://github.com/KevPatterson',
    avatar: 'https://github.com/KevPatterson.png'
  },
];

type SiteShellProps = {
  children: React.ReactNode;
};
function NavItem({ href, label, Icon, badge }: { href: string; label: string; Icon: LucideIcon; badge?: number }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) => [
        'relative flex items-center gap-2 rounded-[14px] border-2 px-3.5 py-2 text-sm font-semibold transition-all duration-base',
        isActive
          ? 'border-navy bg-orange-100 text-navy'
          : 'border-transparent text-[var(--color-text-secondary)] hover:bg-orange-100 hover:text-navy',
      ].join(' ')}
    >
      {({ isActive: _isActive }) => (
        <>
          <Icon className="size-5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          {label}
          {(badge ?? 0) > 0 && (
            <span 
              className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-navy bg-found px-1 text-[11px] font-bold leading-none text-navy"
              aria-label={`${badge} notificaciones no leídas`}
            >
              {(badge ?? 0) > 9 ? '9+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function SiteShell({ children }: SiteShellProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const unreadCount = useNotificationCount();
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
  const username = (user?.user_metadata?.username as string | undefined) ?? null;
  const profileHref = username ? `/perfil/${username}` : '/dashboard';

  useEffect(() => {
    if (authLoading || !user) return;

    let active = true;

    const fetchProfile = async () => {
      // La foto de Google/OAuth es el fallback inmediato mientras se sincroniza el perfil.
      const oauthAvatar = getOAuthAvatarUrl(user);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
        
        if (active) {
          setAvatarUrl((!error && data?.avatar_url) || oauthAvatar || null);
        }
      } catch {
        if (active) setAvatarUrl(oauthAvatar);
      }
    };

    fetchProfile();

    // Refrescar el avatar cuando el usuario lo cambia o lo elimina en otra vista.
    const onAvatarUpdated = () => {
      void fetchProfile();
    };
    window.addEventListener(AVATAR_UPDATED_EVENT, onAvatarUpdated);

    return () => {
      active = false;
      window.removeEventListener(AVATAR_UPDATED_EVENT, onAvatarUpdated);
    };
  }, [user, authLoading]);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      {/* Header sticky con estilo "sticker" */}
      <header className="sticky top-0 z-40 px-4 py-3.5">
        <div className="relative mx-auto w-full max-w-[1180px]">
          <nav 
            className="flex items-center gap-2 rounded-[22px] border-2 border-navy bg-white px-4 py-2 shadow-[0_4px_0_var(--color-orange-900)]"
            aria-label="Principal"
          >
            {/* Logo con icono de huella en cuadrito */}
            <Link 
              to="/" 
              className="mr-auto flex items-center gap-2.5 text-navy no-underline transition-transform duration-[250ms] hover:-rotate-[12deg] hover:scale-[1.08] focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
              aria-label="Patitas - inicio"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-orange border-2 border-navy shrink-0">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 120 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="transition-transform duration-[250ms]"
                >
                  {/* Fondo */}
                  <rect width="120" height="120" rx="24" fill="#FF8C42"/>
                  
                  {/* 4 dedos */}
                  <ellipse cx="24" cy="48" rx="9" ry="12" transform="rotate(-22 24 48)" fill="#3D1D0B"/>
                  <ellipse cx="45" cy="28" rx="9" ry="13" transform="rotate(-8 45 28)" fill="#3D1D0B"/>
                  <ellipse cx="75" cy="28" rx="9" ry="13" transform="rotate(8 75 28)" fill="#3D1D0B"/>
                  <ellipse cx="96" cy="48" rx="9" ry="12" transform="rotate(22 96 48)" fill="#3D1D0B"/>
                  
                  {/* Almohadilla con hueco transparente (icono ubicación) */}
                  <defs>
                    <mask id="paw-mask-navbar">
                      <rect width="120" height="120" fill="white"/>
                      <circle cx="60" cy="75" r="8" fill="black"/>
                    </mask>
                  </defs>
                  <path d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z" fill="#3D1D0B" mask="url(#paw-mask-navbar)"/>
                </svg>
              </div>
              <span className="hidden sm:inline font-display text-[1.65rem] font-extrabold leading-none tracking-[-0.02em] truncate max-w-[160px]">
                patitas
              </span>
            </Link>
            {/* Desktop Navigation Links */}
            <div className="hidden gap-2 lg:flex">
              <NavItem href="/buscar" label="Buscar" Icon={Search} />
              <NavItem href="/mapa" label="Mapa" Icon={MapPin} />
              
              {user && (
                <NavItem href="/notificaciones" label="Avisos" Icon={Bell} badge={unreadCount} />
              )}
            </div>
            
            {/* CTA Publicar - Desktop y tablet */}
            <Link
              to="/publicar"
              className="group mx-2 hidden gap-2 rounded-2xl border-2 border-navy bg-orange px-5 py-2.5 font-display text-sm font-extrabold text-navy shadow-[0_4px_0_var(--color-orange-900)] transition-all duration-base hover:-translate-y-0.5 hover:shadow-[0_6px_0_var(--color-orange-900)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-orange-900)] focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange lg:inline-flex"
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
            
            {/* User Actions - Desktop y Móvil */}
            {!authLoading && (
              user ? (
                <>
                  {/* Desktop */}
                  <div className="hidden items-center gap-1 lg:flex">
                    <Link
                      to={profileHref}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-navy bg-white px-3.5 py-2 text-sm font-semibold text-navy transition-all duration-base hover:bg-orange-100 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
                    >
                      <div className="flex size-[30px] items-center justify-center rounded-full border-2 border-navy bg-cream/50 overflow-hidden">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt="Avatar" 
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="size-4 text-navy" aria-hidden="true" />
                        )}
                      </div>
                      <span>Perfil</span>
                    </Link>
                    
                    {/* Salir */}
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex size-[42px] items-center justify-center rounded-[14px] border-2 border-transparent bg-transparent text-[var(--color-text-secondary)] transition-all duration-base hover:border-navy hover:bg-orange-100 hover:text-navy active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
                      aria-label="Salir"
                    >
                      <LogOut className="size-5" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Móvil - Solo Perfil y Logout */}
                  <div className="flex items-center gap-1 lg:hidden">
                    <Link
                      to={profileHref}
                      className="flex items-center justify-center rounded-full border-2 border-navy bg-white p-2 transition-all duration-base hover:bg-orange-100 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
                      aria-label="Perfil"
                    >
                      <div className="flex size-[30px] items-center justify-center rounded-full border-2 border-navy bg-cream/50 overflow-hidden">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt="Avatar" 
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="size-4 text-navy" aria-hidden="true" />
                        )}
                      </div>
                    </Link>
                    
                    {/* Salir */}
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex size-[42px] items-center justify-center rounded-[14px] border-2 border-transparent bg-transparent text-[var(--color-text-secondary)] transition-all duration-base hover:border-navy hover:bg-orange-100 hover:text-navy active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
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
                    to="/auth/login"
                    className="inline-flex gap-2 rounded-full border-2 border-navy bg-navy px-4 py-2 text-sm font-extrabold text-cream shadow-sm transition-all duration-base hover:bg-orange-900 hover:scale-105 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange lg:hidden"
                  >
                    Entrar
                  </Link>
                  {/* Desktop */}
                  <Link
                    to="/auth/login"
                    className="hidden gap-2 rounded-full border-2 border-navy bg-navy px-5 py-2 text-sm font-extrabold text-cream shadow-sm transition-all duration-base hover:bg-orange-900 hover:scale-105 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange lg:inline-flex"
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
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-40 lg:pb-16 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer rediseñado con personalidad */}
      <footer className="relative border-t-2 border-orange-200 bg-navy text-cream overflow-hidden" role="contentinfo">

        <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
            {/* ===== BRAND / IDENTITY ===== */}
            <section className="w-full lg:w-64 lg:flex-shrink-0" aria-label="Identidad de Patitas">
              <Link to="/" className="flex items-center gap-2 mb-4" aria-label="Patitas - Inicio">
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
                  <li key={member.github} className="flex flex-col items-start gap-2 p-3 rounded-xl bg-navy-light/50 hover:bg-navy-light transition-colors duration-base group">
                    <div className="flex items-start gap-3 w-full">
                      <div className="relative flex-shrink-0">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt=""
                            className="size-10 rounded-xl ring-2 ring-orange-500/30"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-orange-700 text-cream font-display font-extrabold text-sm shadow-md">
                            {member.initials}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-orange-400 flex items-center justify-center border border-navy" aria-hidden="true">
                          <PawPrint className="size-1.5 text-navy" strokeWidth={2.5} />
                        </span>
                      </div>
                      <div className="min-w-0 text-left flex-1">
                        <a
                          href={member.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-display font-semibold text-cream group-hover:text-orange-300 transition-colors text-sm truncate block"
                          aria-label={`Ver perfil de GitHub de ${member.name}`}
                        >
                          {member.name}
                        </a>
                        <p className="text-[10px] text-cream/60 truncate">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex justify-center gap-3 w-full pt-1" aria-label="Redes del miembro">
                      <a
                        href={member.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex size-8 items-center justify-center rounded-lg text-cream/50 hover:text-orange-300 hover:bg-orange-500/10 transition-colors duration-base"
                        aria-label={`GitHub de ${member.name}`}
                      >
                        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                        </svg>
                      </a>
                      <a
                        href="https://wa.me/5356954200"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex size-8 items-center justify-center rounded-lg text-cream/50 hover:text-green-400 hover:bg-green-500/10 transition-colors duration-base"
                        aria-label="Contactar por WhatsApp"
                      >
                        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
                          <path d="M17.415 14.382c-.298-.149-1.759-.867-2.031-.967s-.47-.148-.669.15c-.198.297-.767.966-.94 1.164c-.174.199-.347.223-.644.075c-.297-.15-1.255-.463-2.39-1.475c-.883-.788-1.48-1.761-1.653-2.059c-.173-.297-.019-.458.13-.606c.134-.133.297-.347.446-.52s.198-.298.297-.497c.1-.198.05-.371-.025-.52c-.074-.149-.668-1.612-.916-2.207c-.241-.579-.486-.5-.668-.51c-.174-.008-.372-.01-.57-.01s-.52.074-.792.372c-.273.297-1.04 1.016-1.04 2.479c0 1.462 1.064 2.875 1.213 3.074s2.095 3.2 5.076 4.487c.71.306 1.263.489 1.694.625c.712.227 1.36.195 1.872.118c.57-.085 1.758-.719 2.006-1.413s.247-1.289.173-1.413s-.272-.198-.57-.347m-5.422 7.403h-.004a9.87 9.87 0 0 1-5.032-1.378l-.36-.214l-3.742.982l.999-3.648l-.235-.374a9.86 9.86 0 0 1-1.511-5.26c.002-5.45 4.436-9.884 9.889-9.884a9.8 9.8 0 0 1 6.988 2.899a9.82 9.82 0 0 1 2.892 6.992c-.002 5.45-4.436 9.885-9.884 9.885m8.412-18.297A11.82 11.82 0 0 0 11.992 0C5.438 0 .102 5.335.1 11.892a11.86 11.86 0 0 0 1.587 5.945L0 24l6.304-1.654a11.9 11.9 0 0 0 5.684 1.448h.005c6.554 0 11.89-5.335 11.892-11.893a11.82 11.82 0 0 0-3.48-8.413" clipRule="evenodd" />
                        </svg>
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* ===== DIVIDER ===== */}
          <div className="my-8 border-t border-orange-200/30" aria-hidden="true" />

          {/* ===== BOTTOM BAR: COPYRIGHT + LEGAL LINKS ===== */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-cream/60">
            <p className="text-center sm:text-left">
              © {new Date().getFullYear()} Patitas. Hecho con{' '}
              <span className="text-orange-400" aria-hidden="true">♥</span>{' '}
              para la comunidad cubana.
            </p>
            <nav className="flex flex-wrap items-center justify-center gap-4" aria-label="Enlaces legales rápidos">
              <Link to="/privacidad" className="hover:text-cream transition-colors duration-base whitespace-nowrap">Privacidad</Link>
              <span aria-hidden="true" className="text-cream/30">·</span>
              <Link to="/terminos" className="hover:text-cream transition-colors duration-base whitespace-nowrap">Términos</Link>
              <span aria-hidden="true" className="text-cream/30">·</span>
              <Link to="/cookies" className="hover:text-cream transition-colors duration-base whitespace-nowrap">Cookies</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}