import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, Search, MapPin, LogOut, User, type LucideIcon } from 'lucide-react';
import { signOut } from '../../lib/supabase/auth';
import { useAuth } from '../../app/auth-context';
import { useNotificationCount } from '../../lib/hooks/use-notification-count';
import { getOAuthAvatarUrl, AVATAR_UPDATED_EVENT } from '../../lib/supabase/profiles';
import { Logo } from '../Logo';
import { ThemeSwitch } from '../ui/theme-switch';

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
          : 'border-transparent text-[hsl(var(--muted-foreground))] hover:bg-orange-100 hover:text-navy',
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
    if (user?.id) {
      const avatar = getOAuthAvatarUrl(user);
      if (avatar) setAvatarUrl(avatar);
    } else {
      setAvatarUrl(null);
    }
  }, [user, authLoading]);

  useEffect(() => {
    const handler = () => {
      if (user?.id) {
        const avatar = getOAuthAvatarUrl(user);
        if (avatar) setAvatarUrl(avatar);
      }
    };
    window.addEventListener(AVATAR_UPDATED_EVENT, handler);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, handler);
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
            {/* Logo con componente Logo unificado */}
            <Link 
              to="/" 
              className="mr-auto flex items-center gap-2.5 text-navy no-underline transition-transform duration-[250ms] hover:-rotate-[12deg] hover:scale-[1.08] focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
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
                <NavItem href="/notificaciones" label="Avisos" Icon={Bell} badge={unreadCount} />
              )}
            </div>
            
            {/* Theme Switch - Desktop */}
            <div className="hidden lg:flex items-center ml-2">
              <ThemeSwitch />
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
                      className="flex size-[42px] items-center justify-center rounded-[14px] border-2 border-transparent bg-transparent text-[hsl(var(--muted-foreground))] transition-all duration-base hover:border-navy hover:bg-orange-100 hover:text-navy active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
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
                    
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex size-[42px] items-center justify-center rounded-[14px] border-2 border-transparent bg-transparent text-[hsl(var(--muted-foreground))] transition-all duration-base hover:border-navy hover:bg-orange-100 hover:text-navy active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
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
                  <li key={member.github} className="flex flex-col items-start gap-2 p-3 rounded-xl bg-navy-light/50 hover:bg-navy-light transition-colors duration-base group">
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