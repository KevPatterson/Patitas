import type { PublicationFormValues } from '../validations/publication';

/**
 * Datos que la IA puede aportar al formulario.
 *
 * Es el subconjunto editable de `PublicationFormValues`: no incluye microchip
 * ni las coordenadas como texto porque esos campos no se revisan en la pantalla
 * de importación.
 */
export type ImportedData = {
  type?: PublicationFormValues['type'];
  title?: string;
  description?: string;
  species?: string;
  breed?: string;
  color?: string;
  size?: string;
  sex?: string;
  ageApprox?: string;
  characteristics?: string;
  collar?: boolean;
  plate?: boolean;
  reward?: string;
  contactMode?: PublicationFormValues['contactMode'];
  contactPhone?: string;
  contactWhatsapp?: string;
  contactEmail?: string;
  province?: string;
  municipality?: string;
  zone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationPrecision?: 'municipality' | 'province' | 'none';
  eventDate?: string;
  eventTimeApprox?: string;
  sourceUrl?: string;
  /**
   * Señal de la visión: la mascota aparece en la imagen.
   *
   * No es un campo del formulario. El importador la usa para adjuntar la foto
   * como imagen de la publicación cuando el usuario todavía no subió ninguna.
   */
  hasPet?: boolean;
  confidence?: number;
  ocrText?: string;
};

/**
 * Combina los datos revisados con lo que el usuario ya escribió.
 *
 * El tipo de aviso se aplica siempre porque define la intención del aviso; el
 * resto solo rellena campos vacíos. Así una importación nunca borra el trabajo
 * previo. `collar` y `plate` solo se activan: un `false` de la IA no debe
 * desmarcar algo que el usuario marcó a mano.
 */
export function mergeImportedData(
  current: PublicationFormValues,
  imported: ImportedData
): PublicationFormValues {
  const zone =
    imported.zone ??
    (!(current.zone ?? '').trim() && imported.address ? imported.address : undefined);

  // Solo se cambia el modo de contacto si el usuario no había elegido uno.
  const contactMode =
    current.contactMode === 'INTERNAL' && imported.contactMode
      ? imported.contactMode
      : undefined;

  const province =
    imported.province && !current.province ? imported.province : current.province;

  // El municipio solo se aplica si pertenece a la provincia efectiva. Si no,
  // el `<select>` quedaría con un valor fuera de la lista y las coordenadas
  // acabarían en otro lugar.
  const municipalityBelongs =
    !province || !imported.province || imported.province === province;
  const municipality =
    imported.municipality &&
    !(current.municipality ?? '').trim() &&
    municipalityBelongs
      ? imported.municipality
      : undefined;

  return {
    ...current,
    ...(imported.type && { type: imported.type }),
    ...(imported.title && !current.title.trim() && { title: imported.title }),
    ...(imported.description &&
      !current.description.trim() && { description: imported.description }),
    // Datos del animal
    ...(imported.species && !current.species && { species: imported.species }),
    ...(imported.breed && !(current.breed ?? '').trim() && { breed: imported.breed }),
    ...(imported.sex && !current.sex && { sex: imported.sex }),
    ...(imported.size && !current.size && { size: imported.size }),
    ...(imported.ageApprox && !current.ageApprox && { ageApprox: imported.ageApprox }),
    ...(imported.color && !current.color.trim() && { color: imported.color }),
    ...(imported.characteristics &&
      !(current.characteristics ?? '').trim() && {
        characteristics: imported.characteristics,
      }),
    ...(imported.collar && { collar: true }),
    ...(imported.plate && { plate: true }),
    // Ubicación y contacto
    ...(province && province !== current.province && { province }),
    ...(municipality && { municipality }),
    ...(zone && !(current.zone ?? '').trim() && { zone }),
    ...(imported.reward && !(current.reward ?? '').trim() && { reward: imported.reward }),
    ...(imported.eventDate && !current.eventDate && { eventDate: imported.eventDate }),
    ...(imported.eventTimeApprox &&
      !current.eventTimeApprox && { eventTimeApprox: imported.eventTimeApprox }),
    ...(contactMode && { contactMode }),
    ...(imported.contactPhone &&
      !(current.contactPhone ?? '').trim() && { contactPhone: imported.contactPhone }),
    ...(imported.contactWhatsapp &&
      !(current.contactWhatsapp ?? '').trim() && {
        contactWhatsapp: imported.contactWhatsapp,
      }),
    ...(imported.contactEmail &&
      !(current.contactEmail ?? '').trim() && { contactEmail: imported.contactEmail }),
  };
}
