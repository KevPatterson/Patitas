import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, Search, MapPin, LogOut, User, PawPrint, ExternalLink, type LucideIcon } from 'lucide-react';
import { signOut } from '../../lib/supabase/auth';
import { useAuth } from '../../app/auth-context';
import { useNotificationCount } from '../../lib/hooks/use-notification-count';
import { supabase } from '../../lib/supabase/client';
import { getOAuthAvatarUrl, AVATAR_UPDATED_EVENT } from '../../lib/supabase/profiles';
import { Logo } from '../Logo';

interface DevTeamMember {
  name: string;
  initials: string;
  role: string;
  github: string;
  avatar?: string;
}

const devTeam: DevTeamMember[] = [
  { 
    name: 'Kev Patterson', 
    initials: 'KP', 
    role: 'Full Stack & DevOps', 
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
              <div className="flex size-[34px] items-center justify-center rounded-xl border-[2.5px] border-navy bg-orange transition-transform duration-[250ms]">
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 120 120" 
                  fill="currentColor" 
                  className="text-navy"
                  aria-hidden="true"
                >
                  <ellipse cx="24" cy="48" rx="9" ry="12" transform="rotate(-22 24 48)" />
                  <ellipse cx="45" cy="28" rx="9" ry="13" transform="rotate(-8 45 28)" />
                  <ellipse cx="75" cy="28" rx="9" ry="13" transform="rotate(8 75 28)" />
                  <ellipse cx="96" cy="48" rx="9" ry="12" transform="rotate(22 96 48)" />
                  <path d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z" />
                </svg>
              </div>
              <span className="font-display text-[1.65rem] font-extrabold leading-none tracking-[-0.02em]">
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
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer rediseñado con personalidad */}
      <footer className="relative border-t-2 border-orange-200 bg-navy text-cream overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 size-20">
            <svg viewBox="0 0 120 120" fill="currentColor">
              <ellipse cx="24" cy="48" rx="9" ry="12" transform="rotate(-22 24 48)" />
              <ellipse cx="45" cy="28" rx="9" ry="13" transform="rotate(-8 45 28)" />
              <ellipse cx="75" cy="28" rx="9" ry="13" transform="rotate(8 75 28)" />
              <ellipse cx="96" cy="48" rx="9" ry="12" transform="rotate(22 96 48)" />
              <path d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z" />
            </svg>
          </div>
          <div className="absolute bottom-10 right-20 size-16 transform rotate-12">
            <svg viewBox="0 0 120 120" fill="currentColor">
              <ellipse cx="24" cy="48" rx="9" ry="12" transform="rotate(-22 24 48)" />
              <ellipse cx="45" cy="28" rx="9" ry="13" transform="rotate(-8 45 28)" />
              <ellipse cx="75" cy="28" rx="9" ry="13" transform="rotate(8 75 28)" />
              <ellipse cx="96" cy="48" rx="9" ry="12" transform="rotate(22 96 48)" />
              <path d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z" />
            </svg>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-row items-start justify-between gap-2 sm:gap-4">
            {/* IZQUIERDA: Marca y descripción */}
            <div className="space-y-1.5 text-left min-w-0 flex-1" style={{ minWidth: '110px' }}>
              <div className="flex items-center gap-1.5">
                <Logo variant="mark" size={24} className="text-cream" />
                <span style={{
                  fontFamily: '"Baloo 2", cursive',
                  fontWeight: 800,
                  fontSize: '1.125rem',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-cream)'
                }}>
                  patitas
                </span>
              </div>
              <p className="font-display text-sm leading-snug text-cream/90 whitespace-nowrap">
                🐾 Cada patita merece volver a casa
              </p>
              <p className="text-[10px] text-cream/60 whitespace-nowrap">
                Plataforma comunitaria · Hecho con ❤️ en Cuba
              </p>
            </div>

            {/* CENTRO: Equipo de desarrollo */}
            <section className="flex-shrink-0" aria-label="Equipo de desarrollo">
              <h3 className="font-display text-sm font-extrabold text-cream mb-1.5 text-center">
                <span className="text-orange-300">🐾</span> Equipo
              </h3>
              <div className="flex justify-center">
                {devTeam.map((member) => (
                  <article
                    key={member.name}
                    className="group relative rounded-xl bg-navy-light/50 border border-orange-900/30 p-2.5 max-w-xs transition-all duration-base hover:border-orange-600/50 hover:bg-navy-light/80 hover:-translate-y-0.5"
                  >
                    <div className="relative mb-1.5 flex justify-center">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={`${member.name} - GitHub`}
                          className="size-14 rounded-xl border border-orange-900/30 shadow-md object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex size-14 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-orange-700 text-cream font-display font-extrabold text-lg shadow-md">
                          {member.initials}
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-orange-400 flex items-center justify-center border border-navy">
                        <PawPrint className="size-1.5 text-navy" strokeWidth={2.5} aria-hidden="true" />
                      </div>
                    </div>
                    <div className="space-y-0 text-center">
                      <h4 className="font-display font-bold text-cream group-hover:text-orange-300 transition-colors text-xs">
                        {member.name}
                      </h4>
                      <p className="text-[9px] text-cream/70">{member.role}</p>
                    </div>
                    <div className="mt-1.5 flex justify-center gap-2">
                      <a
                        href={member.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-300 hover:text-orange-100 transition-colors"
                        aria-label={`Ver perfil de GitHub de ${member.name}`}
                      >
                        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </a>
                      <a
                        href="https://wa.me/5356954200"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:text-green-300 transition-colors"
                        aria-label="Contactar por WhatsApp"
                      >
                        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.472.099-.174.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.41.01-.61.01-.434.008-1.136.247-1.708 1.14-.57.893-1.11 2.076-1.25 2.396-.14.319-.057.621.1 1.14.15.52.655 1.784 1.685 3.53.72 1.256 1.158 1.885 1.836 2.09.567.175 1.053.247 1.32.197.168-.033.336-.13.52-.312.149-.15.447-.447 1.003-1.096 1.704-1.945 1.817-2.034 2.716-2.386.817-.312 1.282-.502 1.409-.531.15-.033.247-.05.41-.05.167 0 .266.024.35.068.15.075.782.81 1.003 1.054.24.273.48.562.633.736.129.149.169.247.104.372-.05.11-.217.173-.427.149-.21-.024-.536-.07-.804-.16-.266-.09-.546-.217-.77-.472z"/>
                        </svg>
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* DERECHA: Enlaces de navegación */}
            <nav className="flex flex-col gap-1 text-xs font-semibold text-right min-w-0 flex-1" style={{ minWidth: '110px' }} aria-label="Enlaces del pie">
              <Link 
                to="/buscar" 
                className="text-cream/80 hover:text-orange transition-colors duration-base whitespace-nowrap"
              >
                Buscar mascotas
              </Link>
              <Link 
                to="/adopciones" 
                className="text-cream/80 hover:text-purple transition-colors duration-base whitespace-nowrap"
              >
                Adopciones
              </Link>
              <Link 
                to="/mapa" 
                className="text-cream/80 hover:text-turquoise transition-colors duration-base whitespace-nowrap"
              >
                Mapa de casos
              </Link>
              <Link 
                to="/como-funciona" 
                className="text-cream/80 hover:text-cream transition-colors duration-base whitespace-nowrap"
              >
                Cómo funciona
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}