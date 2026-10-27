import { SITE_URL } from '../config/site';
import { AGE_LABELS, SEX_LABELS, SIZE_LABELS, SPECIES_LABELS } from '../constants/labels';
import type { PublicationSummary } from '../supabase/publication-search';

/**
 * Cartel descargable de un caso.
 *
 * Se genera en el propio navegador con Canvas: no hay que subir la foto a otro
 * servicio ni depender de una función de servidor. El QR apunta a la URL
 * canónica del sitio (`SITE_URL`), no al origen actual, para que el cartel
 * impreso siga funcionando aunque se genere desde un preview o desde localhost.
 */

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1440;

const INK = '#1a0d05';
const CREAM = '#fff4ea';
const ORANGE = '#ff8c42';
const ORANGE_DARK = '#d45a0f';
const FOUND = '#10b981';
const PURPLE = '#8b5cf6';
const MUTED = '#8a5a3c';

export type PosterPublication = {
  title: string;
  type: PublicationSummary['type'];
  slug: string;
  description?: string | null;
  species?: string | null;
  breed?: string | null;
  sex?: string | null;
  size?: string | null;
  ageApprox?: string | null;
  zone?: string | null;
  municipality?: string | null;
  province?: string | null;
  coverImageUrl?: string | null;
  eventDate?: string | null;
  publishedAt?: string | null;
};

type PosterTypeStyle = {
  label: string;
  headline: string;
  accent: string;
};

const TYPE_STYLES: Record<string, PosterTypeStyle> = {
  LOST: {
    label: 'PERDIDO',
    headline: 'Ayúdanos a que vuelva a casa',
    accent: ORANGE_DARK,
  },
  FOUND: {
    label: 'ENCONTRADO',
    headline: 'Busca a su familia',
    accent: FOUND,
  },
  ABANDONED: {
    label: 'ABANDONADO',
    headline: 'Necesita un hogar',
    accent: '#b45309',
  },
  ADOPTION: {
    label: 'EN ADOPCIÓN',
    headline: 'Busca un hogar para siempre',
    accent: PURPLE,
  },
  SIGHTING: {
    label: 'AVISTAMIENTO',
    headline: 'Ayúdanos a localizarlo',
    accent: '#a8440a',
  },
};

function getTypeStyle(type: string): PosterTypeStyle {
  return (
    TYPE_STYLES[type] ?? {
      label: 'CASO',
      headline: 'Ayúdanos a difundir',
      accent: ORANGE_DARK,
    }
  );
}

export function getPosterTypeLabel(type: string): string {
  return getTypeStyle(type).label;
}

export function getPosterHeadline(type: string): string {
  return getTypeStyle(type).headline;
}

export function buildPosterUrl(slug: string, baseUrl: string = SITE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}/p/${encodeURIComponent(slug)}`;
}

export function buildPosterFilename(slug: string): string {
  const safeSlug = slug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `patitas-${safeSlug || 'caso'}.png`;
}

export function buildPosterLocation(publication: PosterPublication): string {
  return [publication.zone, publication.municipality, publication.province]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(', ');
}

/** Datos cortos que se pintan como chips bajo el título. */
export function buildPosterFacts(publication: PosterPublication): string[] {
  const facts = [
    publication.species ? SPECIES_LABELS[publication.species] : null,
    publication.breed,
    publication.sex ? SEX_LABELS[publication.sex] : null,
    publication.size ? SIZE_LABELS[publication.size] : null,
    publication.ageApprox ? AGE_LABELS[publication.ageApprox] : null,
  ];

  return facts
    .filter((fact): fact is string => Boolean(fact && fact !== 'No se sabe'))
    .slice(0, 4);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPaw(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  color: string
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;

  // Almohadilla principal
  ctx.beginPath();
  ctx.ellipse(0, 18, 30, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cuatro dedos
  const toes: Array<[number, number, number, number]> = [
    [-34, -14, 11, 15],
    [-13, -32, 11, 16],
    [13, -32, 11, 16],
    [34, -14, 11, 15],
  ];

  for (const [x, y, rx, ry] of toes) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.25, size * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - size * 0.42, y + size * 0.1);
  ctx.lineTo(x + size * 0.42, y + size * 0.1);
  ctx.lineTo(x, y + size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function splitLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function fitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const lines = splitLines(ctx, text, maxWidth);

  if (lines.length <= maxLines) return lines;

  const visible = lines.slice(0, maxLines);
  let last = visible[maxLines - 1];

  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }

  visible[maxLines - 1] = `${last.trimEnd()}…`;
  return visible;
}

function drawFactChips(
  ctx: CanvasRenderingContext2D,
  facts: string[],
  x: number,
  y: number,
  maxWidth: number
): void {
  ctx.font = '600 26px "Figtree", sans-serif';
  ctx.textBaseline = 'middle';

  let cursorX = x;
  const chipHeight = 54;
  const gap = 14;

  for (const fact of facts) {
    const chipWidth = ctx.measureText(fact).width + 46;

    // Una sola fila: si el siguiente chip no cabe, se omite para no empujar
    // la ubicación ni la descripción fuera de su sitio.
    if (cursorX + chipWidth > x + maxWidth) break;

    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, cursorX, y, chipWidth, chipHeight, chipHeight / 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd9bb';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.fillText(fact, cursorX + 23, y + chipHeight / 2 + 1);
    cursorX += chipWidth + gap;
  }

  ctx.textBaseline = 'alphabetic';
}

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;

  try {
    await Promise.all([
      document.fonts.load('800 62px "Baloo 2"'),
      document.fonts.load('600 28px "Figtree"'),
      document.fonts.load('400 26px "Figtree"'),
    ]);
    await document.fonts.ready;
  } catch {
    // Si la fuente no carga, Canvas usa la familia de respaldo y el cartel
    // sigue siendo legible.
  }
}

type LoadedPhoto = {
  image: HTMLImageElement;
  release: () => void;
};

async function loadRemoteImage(url: string): Promise<LoadedPhoto | null> {
  try {
    // `fetch` (en lugar de asignar `src` directamente) evita que un fallo de
    // CORS contamine el canvas y rompa la descarga con SecurityError.
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });

    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
      return null;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('No se pudo decodificar la foto'));
      image.src = objectUrl;
    });

    return {
      image,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch {
    return null;
  }
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;

  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > boxRatio) {
    sourceWidth = image.height * boxRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / boxRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  );
}

async function createQrCanvas(url: string, size: number): Promise<HTMLCanvasElement> {
  const qrModule = await import('qrcode');
  const canvas = document.createElement('canvas');

  await qrModule.toCanvas(canvas, url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: INK,
      light: '#ffffff',
    },
  });

  return canvas;
}

export async function renderPublicationPoster(publication: PosterPublication): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('El cartel solo se puede generar en el navegador.');
  }

  await ensureFonts();

  const style = getTypeStyle(publication.type);
  const posterUrl = buildPosterUrl(publication.slug);
  const location = buildPosterLocation(publication);
  const facts = buildPosterFacts(publication);

  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('El navegador no soporta Canvas 2D.');
  }

  // Fondo cálido con un degradado muy suave.
  const background = ctx.createLinearGradient(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  background.addColorStop(0, CREAM);
  background.addColorStop(0.55, '#fffaf5');
  background.addColorStop(1, '#ffe6d1');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  // Huellas decorativas de fondo, lejos del texto.
  ctx.save();
  ctx.globalAlpha = 0.06;
  drawPaw(ctx, 1000, 1128, 2.2, ORANGE);
  ctx.restore();

  // Cabecera.
  const header = ctx.createLinearGradient(0, 0, POSTER_WIDTH, 0);
  header.addColorStop(0, ORANGE);
  header.addColorStop(1, '#ffb078');
  ctx.fillStyle = header;
  ctx.fillRect(0, 0, POSTER_WIDTH, 170);

  ctx.save();
  ctx.globalAlpha = 0.18;
  drawPaw(ctx, 960, 40, 1.4, '#ffffff');
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.font = '800 58px "Baloo 2", cursive';
  ctx.fillText('Patitas', 64, 82);

  ctx.fillStyle = 'rgba(26, 13, 5, 0.72)';
  ctx.font = '600 22px "Figtree", sans-serif';
  ctx.fillText('Que ninguna patita se quede sin casa', 66, 120);

  // Píldora del tipo de caso.
  ctx.font = '800 26px "Figtree", sans-serif';
  const labelWidth = ctx.measureText(style.label).width;
  const pillWidth = labelWidth + 68;
  const pillX = POSTER_WIDTH - 64 - pillWidth;
  ctx.fillStyle = style.accent;
  roundedRect(ctx, pillX, 38, pillWidth, 54, 27);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(style.label, pillX + 34, 73);

  // Foto principal.
  const photoX = 60;
  const photoY = 200;
  const photoWidth = 960;
  const photoHeight = 560;
  const photoRadius = 36;

  ctx.save();
  roundedRect(ctx, photoX, photoY, photoWidth, photoHeight, photoRadius);
  ctx.clip();

  const photo = publication.coverImageUrl ? await loadRemoteImage(publication.coverImageUrl) : null;

  if (photo) {
    try {
      drawCoverImage(ctx, photo.image, photoX, photoY, photoWidth, photoHeight);
    } finally {
      photo.release();
    }
  } else {
    const placeholder = ctx.createLinearGradient(photoX, photoY, photoX + photoWidth, photoY + photoHeight);
    placeholder.addColorStop(0, '#ffe6d1');
    placeholder.addColorStop(1, '#ffcfa8');
    ctx.fillStyle = placeholder;
    ctx.fillRect(photoX, photoY, photoWidth, photoHeight);

    ctx.save();
    ctx.globalAlpha = 0.35;
    drawPaw(ctx, photoX + photoWidth / 2, photoY + photoHeight / 2 - 20, 3.2, ORANGE_DARK);
    ctx.restore();

    ctx.fillStyle = 'rgba(26, 13, 5, 0.65)';
    ctx.font = '600 28px "Figtree", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Foto no disponible', photoX + photoWidth / 2, photoY + photoHeight / 2 + 130);
    ctx.textAlign = 'left';
  }

  ctx.restore();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  roundedRect(ctx, photoX, photoY, photoWidth, photoHeight, photoRadius);
  ctx.stroke();

  // Título.
  ctx.fillStyle = INK;
  ctx.font = '800 62px "Baloo 2", cursive';
  const titleLines = fitLines(ctx, publication.title, 952, 2);
  titleLines.forEach((line, index) => {
    ctx.fillText(line, 64, 850 + index * 70);
  });

  // Datos cortos.
  if (facts.length > 0) {
    drawFactChips(ctx, facts, 64, 968, 952);
  }

  // Ubicación.
  if (location) {
    drawPin(ctx, 78, 1068, 24, ORANGE_DARK);
    ctx.fillStyle = MUTED;
    ctx.font = '600 28px "Figtree", sans-serif';
    const locationLine = fitLines(ctx, location, 860, 1)[0] ?? '';
    ctx.fillText(locationLine, 112, 1082);
  }

  // Descripción breve.
  if (publication.description) {
    ctx.fillStyle = 'rgba(26, 13, 5, 0.72)';
    ctx.font = '400 26px "Figtree", sans-serif';
    const descriptionLines = fitLines(ctx, publication.description, 700, 2);
    descriptionLines.forEach((line, index) => {
      ctx.fillText(line, 64, 1136 + index * 34);
    });
  }

  // Separador de la zona inferior.
  ctx.strokeStyle = '#ffd9bb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 1198);
  ctx.lineTo(1016, 1198);
  ctx.stroke();

  // Llamada a la acción.
  ctx.fillStyle = INK;
  ctx.font = '800 34px "Baloo 2", cursive';
  ctx.fillText('Escanea el QR', 64, 1258);
  ctx.fillText('para ver el caso', 64, 1296);

  ctx.fillStyle = MUTED;
  ctx.font = '600 22px "Figtree", sans-serif';
  const displayUrl = posterUrl.replace(/^https?:\/\//, '');
  const urlLine = fitLines(ctx, displayUrl, 700, 1)[0] ?? '';
  ctx.fillText(urlLine, 64, 1342);

  ctx.fillStyle = 'rgba(26, 13, 5, 0.5)';
  ctx.font = '600 18px "Figtree", sans-serif';
  const headlineLine = fitLines(ctx, getPosterHeadline(publication.type), 700, 1)[0] ?? '';
  ctx.fillText(headlineLine, 64, 1380);

  // Tarjeta del QR.
  const qrCardX = 812;
  const qrCardY = 1210;
  const qrCardSize = 204;
  const qrSize = 172;

  ctx.save();
  ctx.shadowColor = 'rgba(26, 13, 5, 0.16)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 26);
  ctx.fill();
  ctx.restore();

  try {
    const qrCanvas = await createQrCanvas(posterUrl, qrSize);
    const qrX = qrCardX + (qrCardSize - qrSize) / 2;
    const qrY = qrCardY + (qrCardSize - qrSize) / 2;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  } catch {
    // Sin QR el cartel sigue siendo útil: al menos conserva la URL escrita.
    ctx.fillStyle = MUTED;
    ctx.font = '600 20px "Figtree", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Escanea en', qrCardX + qrCardSize / 2, qrCardY + 96);
    ctx.fillText('Patitas', qrCardX + qrCardSize / 2, qrCardY + 126);
    ctx.textAlign = 'left';
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });

  if (!blob) {
    throw new Error('No se pudo generar la imagen del cartel.');
  }

  return blob;
}
