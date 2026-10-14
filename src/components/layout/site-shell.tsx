import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, Search, MapPin, LogOut, User, type LucideIcon } from 'lucide-react';
import { signOut } from '../../lib/supabase/auth';
import { useAuth } from '../../app/auth-context';
import { useNotificationCount } from '../../lib/hooks/use-notification-count';
import { supabase } from '../../lib/supabase/client';
import { Logo } from '../Logo';

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
          ? 'border-[#231942] bg-[#FFE3CC] text-[#231942]'
          : 'border-transparent text-[#6B6585] hover:bg-[#FFE3CC] hover:text-[#231942]',
      ].join(' ')}
    >
      {({ isActive }) => (
        <>
          <Icon className="size-5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          {label}
          {(badge ?? 0) > 0 && (
            <span 
              className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#231942] bg-[#38C9A3] px-1 text-[11px] font-bold leading-none text-[#231942]"
              aria-label={`${badge} notificaciones no leídas`}
            >
              {(badge ?? 0) > 9 ? '9+' : badge}
            </span>
          )}
          {isActive && (
            <svg
              className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 size-7 text-[#FF8C42] drop-shadow-[0_2px_4px_rgba(255,140,66,0.3)]"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              style={{ transformOrigin: 'center bottom' }}
            >
              {/* Almohadilla principal (palmar) */}
              <ellipse cx="16" cy="22" rx="9" ry="6" fill="currentColor" />
              {/* Almohadillas de los dedos (toe beans) */}
              <circle cx="16" cy="10" r="3.5" fill="currentColor" />
              <circle cx="7" cy="13" r="3" fill="currentColor" />
              <circle cx="25" cy="13" r="3" fill="currentColor" />
              <circle cx="4.5" cy="18" r="2.5" fill="currentColor" />
              <circle cx="27.5" cy="18" r="2.5" fill="currentColor" />
            </svg>
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
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
        
        if (!error && data && active) {
          setAvatarUrl(data.avatar_url);
        }
      } catch {
        if (active) setAvatarUrl(null);
      }
    };

    fetchProfile();

    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      {/* Header sticky con estilo "sticker" */}
      <header className="sticky top-0 z-40 px-4 py-3.5">
        <div className="relative mx-auto w-full max-w-[1180px]">
          <nav 
            className="flex items-center gap-2 rounded-[22px] border-2 border-[#231942] bg-white px-4 py-2 shadow-[0_4px_0_#231942]"
            aria-label="Principal"
          >
            {/* Logo con icono de huella en cuadrito */}
            <Link 
              to="/" 
              className="mr-auto flex items-center gap-2.5 text-[#231942] no-underline transition-transform duration-[250ms] hover:-rotate-[12deg] hover:scale-[1.08] focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
              aria-label="Patitas - inicio"
            >
              <div className="flex size-[34px] items-center justify-center rounded-xl border-[2.5px] border-[#231942] bg-orange transition-transform duration-[250ms]">
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 120 120" 
                  fill="currentColor" 
                  className="text-[#231942]"
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
              className="group mx-2 hidden gap-2 rounded-2xl border-2 border-[#231942] bg-orange px-5 py-2.5 font-display text-sm font-extrabold text-[#231942] shadow-[0_4px_0_#231942] transition-all duration-base hover:-translate-y-0.5 hover:shadow-[0_6px_0_#231942] active:translate-y-[3px] active:shadow-[0_1px_0_#231942] focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange lg:inline-flex"
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
                  <div className="hidden gap-1 lg:flex">
                    <Link
                      to={profileHref}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[#231942] bg-white px-3.5 py-2 text-sm font-semibold text-[#231942] transition-all duration-base hover:bg-[#FFE3CC] active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
                    >
                      <div className="flex size-[30px] items-center justify-center rounded-full border-2 border-[#231942] bg-cream/50 overflow-hidden">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt="Avatar" 
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="size-4 text-[#231942]" aria-hidden="true" />
                        )}
                      </div>
                      <span>Perfil</span>
                    </Link>
                    
                    {/* Salir */}
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex size-[42px] items-center justify-center rounded-[14px] border-2 border-transparent bg-transparent text-[#6B6585] transition-all duration-base hover:border-[#231942] hover:bg-[#FFE3CC] hover:text-[#231942] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
                      aria-label="Salir"
                    >
                      <LogOut className="size-5" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Móvil - Solo Perfil y Logout */}
                  <div className="flex gap-1 lg:hidden">
                    <Link
                      to={profileHref}
                      className="flex items-center justify-center rounded-full border-2 border-[#231942] bg-white p-2 transition-all duration-base hover:bg-[#FFE3CC] active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
                      aria-label="Perfil"
                    >
                      <div className="flex size-[30px] items-center justify-center rounded-full border-2 border-[#231942] bg-cream/50 overflow-hidden">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt="Avatar" 
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="size-4 text-[#231942]" aria-hidden="true" />
                        )}
                      </div>
                    </Link>
                    
                    {/* Salir */}
                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex size-[42px] items-center justify-center rounded-[14px] border-2 border-transparent bg-transparent text-[#6B6585] transition-all duration-base hover:border-[#231942] hover:bg-[#FFE3CC] hover:text-[#231942] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange"
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
                    className="inline-flex gap-2 rounded-full border-2 border-[#231942] bg-[#231942] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition-all duration-base hover:bg-[#1a1332] hover:scale-105 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange lg:hidden"
                  >
                    Entrar
                  </Link>
                  {/* Desktop */}
                  <Link
                    to="/auth/login"
                    className="hidden gap-2 rounded-full border-2 border-[#231942] bg-[#231942] px-5 py-2 text-sm font-extrabold text-white shadow-sm transition-all duration-base hover:bg-[#1a1332] hover:scale-105 active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange lg:inline-flex"
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
      <footer className="relative border-t-2 border-navy/10 bg-navy text-cream overflow-hidden">
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

        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-cream">
              <Logo variant="full" size={32} className="text-cream" />
            </div>
            <p className="max-w-md font-display text-lg leading-relaxed text-cream/90">
              🐾 Cada patita merece volver a casa
            </p>
            <p className="text-sm text-cream/60">
              Plataforma comunitaria · Hecho con ❤️ en Cuba
            </p>
          </div>
          
          <nav className="flex flex-col gap-2 text-sm font-semibold" aria-label="Enlaces del pie">
            <Link 
              to="/buscar" 
              className="text-cream/80 hover:text-orange transition-colors duration-base"
            >
              Buscar mascotas
            </Link>
            <Link 
              to="/adopciones" 
              className="text-cream/80 hover:text-purple transition-colors duration-base"
            >
              Adopciones
            </Link>
            <Link 
              to="/mapa" 
              className="text-cream/80 hover:text-turquoise transition-colors duration-base"
            >
              Mapa de casos
            </Link>
            <Link 
              to="/como-funciona" 
              className="text-cream/80 hover:text-cream transition-colors duration-base"
            >
              Cómo funciona
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}