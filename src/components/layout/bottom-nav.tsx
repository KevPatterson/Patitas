import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, MapPinned, PlusCircle, Bell } from 'lucide-react';
import { useNotificationCount } from '../../lib/hooks/use-notification-count';

const items = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/buscar', label: 'Buscar', icon: Search },
  { to: '/publicar', label: 'Publicar', icon: PlusCircle, highlight: true },
  { to: '/mapa', label: 'Mapa', icon: MapPinned },
  { to: '/notificaciones', label: 'Notifs', icon: Bell },
];

export function BottomNav() {
  const location = useLocation();
  const unreadCount = useNotificationCount();

  return (
    <nav 
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-navy/10 bg-white/95 px-2 py-2 backdrop-blur-md shadow-lg lg:hidden"
      aria-label="Navegación móvil"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to + '/'));
          const showBadge = item.to === '/notificaciones' && unreadCount > 0;
          
          // Botón central destacado
          if (item.highlight) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center relative -mt-6"
              >
                <div className={[
                  'flex size-14 items-center justify-center rounded-2xl shadow-lg transition-all duration-base ease-smooth',
                  isActive
                    ? 'bg-orange-dark scale-110'
                    : 'bg-orange hover:bg-orange-dark hover:scale-105'
                ].join(' ')}>
                  <Icon className="size-6 text-white" aria-hidden="true" />
                </div>
                <span className="mt-1 text-[10px] font-bold text-navy">
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
                isActive
                  ? 'bg-navy text-white scale-105'
                  : 'text-navy/60 hover:bg-navy/5 hover:text-navy',
              ].join(' ')}
            >
              <Icon className="size-5" aria-hidden="true" />
              {item.label}
              {showBadge && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-lost text-white text-[8px] font-bold flex items-center justify-center shadow-sm animate-paw-pulse">
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