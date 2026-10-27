import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  Compass,
  MapPin,
  MessageCircle,
  Search,
  type LucideIcon,
} from 'lucide-react';

type NavMenuLink = {
  to: string;
  label: string;
  description: string;
  Icon: LucideIcon;
  badge?: number;
  badgeLabel?: string;
};

type NavMenuProps = {
  isLoggedIn: boolean;
  unreadMessages: number;
  unreadNotifications: number;
};

/**
 * Menú desplegable del navbar de escritorio.
 *
 * Agrupa buscar, mapa, mensajes y notificaciones en un solo botón para dejar
 * aire en la cabecera. Mensajes y notificaciones solo aparecen con sesión
 * iniciada, igual que antes.
 *
 * Accesibilidad: patrón de divulgación (button + aria-expanded + panel de
 * enlaces). Se cierra con Escape, con un clic fuera y al cambiar de ruta.
 */
export function NavMenu({ isLoggedIn, unreadMessages, unreadNotifications }: NavMenuProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const links: NavMenuLink[] = [
    {
      to: '/buscar',
      label: 'Buscar',
      description: 'Casos por zona, especie y estado',
      Icon: Search,
    },
    {
      to: '/mapa',
      label: 'Mapa',
      description: 'Casos activos sobre el mapa',
      Icon: MapPin,
    },
    ...(isLoggedIn
      ? [
          {
            to: '/mensajes',
            label: 'Mensajes',
            description: 'Conversaciones con la comunidad',
            Icon: MessageCircle,
            badge: unreadMessages,
            badgeLabel: 'mensajes sin leer',
          },
          {
            to: '/notificaciones',
            label: 'Notificaciones',
            description: 'Alertas y avisos de tus casos',
            Icon: Bell,
            badge: unreadNotifications,
            badgeLabel: 'notificaciones no leídas',
          },
        ]
      : []),
  ];

  const totalUnread = isLoggedIn ? unreadMessages + unreadNotifications : 0;
  const sectionActive = links.some(
    (link) => location.pathname === link.to || location.pathname.startsWith(`${link.to}/`)
  );

  // Al navegar, el menú deja de tener sentido abierto.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="nav-menu-panel"
        aria-label={totalUnread > 0 ? `Explorar, ${totalUnread} sin leer` : 'Explorar'}
        className={[
          'relative flex items-center gap-2 rounded-[14px] border-2 px-3.5 py-2 text-sm font-semibold transition-all duration-base',
          'focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange',
          open || sectionActive
            ? 'border-foreground bg-highlight text-foreground'
            : 'border-transparent text-[hsl(var(--muted-foreground))] hover:bg-highlight hover:text-foreground',
        ].join(' ')}
      >
        <Compass className="size-5" strokeWidth={2} aria-hidden="true" />
        Explorar
        <ChevronDown
          className={`size-4 transition-transform duration-base ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
        {totalUnread > 0 && (
          <span
            className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-foreground bg-found px-1 text-[11px] font-bold leading-none text-primary-foreground"
            aria-hidden="true"
          >
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="nav-menu-panel"
          className="absolute left-0 top-[calc(100%+10px)] z-50 w-[300px] rounded-2xl border-2 border-foreground bg-surface p-2 shadow-[0_6px_0_var(--color-orange-900)]"
        >
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-foreground/50">
            Explorar Patitas
          </p>
          <ul className="space-y-1">
            {links.map(({ to, label, description, Icon, badge, badgeLabel }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    [
                      'flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-base',
                      'focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-orange',
                      isActive
                        ? 'bg-highlight text-foreground'
                        : 'text-foreground/80 hover:bg-highlight hover:text-foreground',
                    ].join(' ')
                  }
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border-2 border-foreground/10 bg-app/60">
                    <Icon className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {label}
                      {(badge ?? 0) > 0 && (
                        <>
                          <span
                            className="rounded-full bg-found px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground"
                            aria-hidden="true"
                          >
                            {(badge ?? 0) > 9 ? '9+' : badge}
                          </span>
                          <span className="sr-only">
                            {badge} {badgeLabel}
                          </span>
                        </>
                      )}
                    </span>
                    <span className="block text-xs text-foreground/60">{description}</span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
