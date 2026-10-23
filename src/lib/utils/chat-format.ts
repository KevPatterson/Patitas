/**
 * Formato de fechas del chat.
 *
 * La bandeja necesita una referencia rápida ("hace 5 min", "ayer") y el hilo
 * necesita la hora exacta del mensaje. Se resuelve en un solo sitio para que
 * ambos usen el mismo idioma y la misma zona horaria.
 */

const relativeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const timeFormatter = new Intl.DateTimeFormat('es-CU', {
  hour: '2-digit',
  minute: '2-digit',
});

const dayFormatter = new Intl.DateTimeFormat('es-CU', {
  dateStyle: 'medium',
});

export function formatChatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return sameDay ? timeFormatter.format(date) : `${dayFormatter.format(date)}, ${timeFormatter.format(date)}`;
}

export function formatRelativeChatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (Math.abs(diffMinutes) < 60) {
    return relativeFormatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (Math.abs(diffHours) < 24) {
    return relativeFormatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffDays) < 7) {
    return relativeFormatter.format(diffDays, 'day');
  }

  return dayFormatter.format(date);
}
