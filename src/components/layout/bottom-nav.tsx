import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, MapPinned, PlusCircle, Bell, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNotificationCount } from '../../lib/hooks/use-notification-count';
import { useAuth } from '../../app/auth-context';
interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  highlight?: boolean;
}

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const unreadCount = useNotificationCount();
  const isLoggedIn = !!user;

  const items: readonly NavItem[] = [
    { to: '/', label: 'Inicio', icon: Home },
    { to: '/buscar', label: 'Buscar', icon: Search },
    { to: '/publicar', label: 'Publicar', icon: PlusCircle, highlight: true },
    { to: '/mapa', label: 'Mapa', icon: MapPinned },
    isLoggedIn
      ? { to: '/notificaciones', label: 'Notifs', icon: Bell }
      : { to: '/adopciones', label: 'Adopciones', icon: Heart },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-2 py-2 lg:hidden"
      aria-label="Navegación móvil"
      style={{
        borderTop: '2px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--card) / 0.95)',
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.15)',
      }}
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to + '/'));
          const showBadge = item.to === '/notificaciones' && unreadCount > 0;

          if (item.highlight) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center relative -mt-6"
              >
                <div
                  className={[
                    'flex size-14 items-center justify-center rounded-2xl shadow-lg transition-all duration-base ease-smooth',
                    isActive ? 'scale-110' : 'hover:scale-105',
                  ].join(' ')}
                  style={{
                    backgroundColor: isActive ? 'hsl(var(--primary) / 0.9)' : 'hsl(var(--primary))',
                  }}
                >
                  <Icon className="size-6" aria-hidden="true" style={{ color: 'hsl(var(--primary-foreground))' }} />
                </div>
                <span className="mt-1 text-[10px] font-bold" style={{ color: 'hsl(var(--foreground))' }}>
                  {item.label}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={[
                'flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-center text-[10px] font-bold transition-all duration-base ease-smooth relative',
                isActive ? 'scale-105' : '',
              ].join(' ')}
              style={{
                backgroundColor: isActive ? 'hsl(var(--foreground))' : 'transparent',
                color: isActive ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
              }}
            >
              <Icon className="size-5" aria-hidden="true" style={{ color: isActive ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))' }} />
              <span style={{ color: isActive ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))' }}>{item.label}</span>
              {showBadge && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center shadow-sm animate-paw-pulse"
                  style={{ backgroundColor: 'hsl(var(--destructive))' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}