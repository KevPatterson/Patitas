export const TYPE_LABELS: Record<string, string> = {
  LOST: "Perdido",
  FOUND: "Encontrado",
  ABANDONED: "Abandonado",
  ADOPTION: "Adopción",
  SIGHTING: "Avistamiento",
};

export const TYPE_EMOJIS: Record<string, string> = {
  LOST: "😢",
  FOUND: "🎉",
  ABANDONED: "💔",
  ADOPTION: "🏠",
  SIGHTING: "👀",
};

export const SPECIES_LABELS: Record<string, string> = {
  dog: "Perro",
  cat: "Gato",
  bird: "Ave",
  rabbit: "Conejo",
  rodent: "Roedor",
  reptile: "Reptil",
  other: "Otro",
};

export const SEX_LABELS: Record<string, string> = {
  male: "Macho",
  female: "Hembra",
  unknown: "No se sabe",
};

export const AGE_LABELS: Record<string, string> = {
  puppy: "Cachorro",
  young: "Joven",
  adult: "Adulto",
  senior: "Anciano",
  unknown: "No se sabe",
};

export const SIZE_LABELS: Record<string, string> = {
  small: "Pequeño",
  medium: "Mediano",
  large: "Grande",
  unknown: "No se sabe",
};

export const REASON_LABELS: Record<string, string> = {
  FALSE_INFO: "Información falsa",
  SPAM: "Spam",
  SCAM: "Estafa",
  DUPLICATE: "Publicación duplicada",
  REUNITED: "La mascota ya fue recuperada",
  INAPPROPRIATE: "Contenido inapropiado",
  OTHER: "Otro",
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  RESOLVED: "Resuelta",
  EXPIRED: "Expirada",
  HIDDEN: "Oculta",
  DELETED: "Eliminada",
};

export const TYPE_COLORS: Record<string, string> = {
  LOST: "#FE6411",
  FOUND: "#2F9E63",
  ABANDONED: "#D9A521",
  ADOPTION: "#3B7DD8",
  SIGHTING: "#8B5CF6",
};

export const MAX_IMAGES = 8;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

// Compat alias lower-case (no enumerables para no romper conteos 5/7)
for (const [upper, lower] of [
  ["LOST", "lost"],
  ["FOUND", "found"],
  ["ABANDONED", "abandoned"],
  ["ADOPTION", "adoption"],
  ["SIGHTING", "sighting"],
] as const) {
  Object.defineProperty(TYPE_LABELS, lower, { value: TYPE_LABELS[upper], enumerable: false, writable: true, configurable: true });
  Object.defineProperty(TYPE_COLORS, lower, { value: TYPE_COLORS[upper], enumerable: false, writable: true, configurable: true });
}
for (const [upper, lower] of [
  ["ACTIVE", "active"],
  ["RESOLVED", "resolved"],
  ["EXPIRED", "expired"],
  ["HIDDEN", "hidden"],
  ["DELETED", "deleted"],
] as const) {
  Object.defineProperty(STATUS_LABELS, lower, { value: STATUS_LABELS[upper], enumerable: false, writable: true, configurable: true });
}
for (const [upper, lower] of [
  ["FALSE_INFO", "fake"],
  ["SPAM", "spam"],
  ["SCAM", "scam"],
  ["DUPLICATE", "duplicate"],
  ["REUNITED", "already_recovered"],
  ["INAPPROPRIATE", "inappropriate"],
  ["OTHER", "other"],
] as const) {
  Object.defineProperty(REASON_LABELS, lower, { value: REASON_LABELS[upper], enumerable: false, writable: true, configurable: true });
}
// Alias lower-case con mismo nombre (SPAM<->spam etc cuando coinciden case-insensitive)
for (const k of ["SPAM", "SCAM", "OTHER"] as const) {
  Object.defineProperty(REASON_LABELS, k.toLowerCase(), { value: REASON_LABELS[k], enumerable: false, writable: true, configurable: true });
}
