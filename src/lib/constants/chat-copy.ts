/**
 * Copy del chat interno por tipo de publicación.
 *
 * El botón no dice lo mismo para una adopción que para una mascota perdida: el
 * usuario que vio al perro necesita escribir rápido y el que quiere adoptar
 * necesita presentarse. Centralizarlo evita que la publicación y el hilo se
 * contradigan.
 */

export const CHAT_BUTTON_LABELS: Record<string, string> = {
  ADOPTION: 'Escribir al dueño',
  LOST: 'Tengo información',
  FOUND: 'Creo que es mi mascota',
  SIGHTING: 'Tengo información',
  ABANDONED: 'Quiero ayudar',
};

export const CHAT_TYPE_HINTS: Record<string, string> = {
  ADOPTION: 'Pregunta por el carácter, la salud y el proceso de adopción.',
  LOST: 'Cuenta dónde y cuándo lo viste. Ese dato puede ser decisivo.',
  FOUND: 'Describe a tu mascota y comparte una foto si la tienes.',
  SIGHTING: 'Añade la zona y la hora del avistamiento.',
  ABANDONED: 'Pregunta cómo puedes ayudar o si necesita un hogar temporal.',
};

export function getChatButtonLabel(type: string | null | undefined): string {
  if (!type) {
    return 'Escribir al dueño';
  }

  return CHAT_BUTTON_LABELS[type] ?? 'Escribir un mensaje';
}

export function getChatTypeHint(type: string | null | undefined): string {
  if (!type) {
    return '';
  }

  return CHAT_TYPE_HINTS[type] ?? '';
}

/**
 * Mensaje sugerido para el primer contacto. Es editable: solo evita la página
 * en blanco, nunca se envía solo.
 */
export function getSuggestedMessage(
  type: string | null | undefined,
  publicationTitle: string | null | undefined
): string {
  const title = publicationTitle?.trim() || 'tu publicación';

  switch (type) {
    case 'ADOPTION':
      return `Hola, vi tu publicación de ${title}. Me gustaría saber más sobre la adopción.`;
    case 'LOST':
      return `Hola, vi tu publicación de ${title}. Creo que tengo información sobre tu mascota.`;
    case 'FOUND':
      return `Hola, vi que encontraste a ${title}. Creo que podría ser mi mascota.`;
    case 'SIGHTING':
      return `Hola, vi tu avistamiento de ${title}. Tengo más información que puede ayudar.`;
    case 'ABANDONED':
      return `Hola, vi tu publicación de ${title}. Quiero ayudar con esta mascota.`;
    default:
      return `Hola, vi tu publicación de ${title} y quería preguntarte algo.`;
  }
}

export const CHAT_REPORT_REASONS = [
  { value: 'SCAM', label: 'Intento de estafa' },
  { value: 'HARASSMENT', label: 'Acoso o amenazas' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'INAPPROPRIATE', label: 'Contenido inapropiado' },
  { value: 'OTHER', label: 'Otro motivo' },
] as const;
