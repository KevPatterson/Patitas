import { safeJsonLd } from './json-ld';
import { SITE_NAME, SITE_URL } from '../config/site';

type LostPetStructuredData = {
  name: string;
  description: string;
  image: string;
  species: string;
  location: {
    municipality: string;
    province: string;
  };
  datePosted: string;
  url: string;
};

/**
 * Datos estructurados de una publicación.
 *
 * Se usa `Article` porque es un tipo que los motores generativos entienden bien
 * (título, autor, fecha e imagen) y se describe la mascota en `about` con
 * `additionalType: Pet`. Así el contenido se puede citar sin inventar campos que
 * schema.org no define para animales perdidos.
 */
export function generateLostPetStructuredData(data: LostPetStructuredData): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${data.url}#article`,
    headline: data.name,
    description: data.description,
    image: data.image,
    datePublished: data.datePosted,
    inLanguage: 'es-CU',
    mainEntityOfPage: data.url,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    about: {
      '@type': 'Thing',
      additionalType: 'https://schema.org/Pet',
      name: data.species,
    },
    contentLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: data.location.municipality,
        addressRegion: data.location.province,
        addressCountry: 'CU',
      },
    },
  };

  return safeJsonLd(structuredData);
}

type FaqItem = {
  question: string;
  answer: string;
};

/**
 * Datos estructurados de preguntas frecuentes.
 *
 * Ayuda a que los asistentes encuentren respuestas literales y atribuibles, en
 * lugar de reconstruirlas a partir de fragmentos de la interfaz.
 */
export function generateFaqStructuredData(items: FaqItem[], pageUrl: string): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    url: pageUrl,
    inLanguage: 'es-CU',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return safeJsonLd(structuredData);
}

export function injectStructuredData(data: string, id: string): void {
  // Remover script previo con el mismo id
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }

  // Crear nuevo script
  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = data;
  document.head.appendChild(script);
}

export function removeStructuredData(id: string): void {
  const script = document.getElementById(id);
  if (script) {
    script.remove();
  }
}
