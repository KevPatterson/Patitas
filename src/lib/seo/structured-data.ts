import { safeJsonLd } from './json-ld';

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

export function generateLostPetStructuredData(data: LostPetStructuredData): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Thing',
    name: data.name,
    description: data.description,
    image: data.image,
    additionalType: 'Pet',
    location: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: data.location.municipality,
        addressRegion: data.location.province,
        addressCountry: 'CU',
      },
    },
    url: data.url,
    dateCreated: data.datePosted,
  };

  return safeJsonLd(structuredData);
}

type WebsiteStructuredData = {
  name: string;
  description: string;
  url: string;
};

export function generateWebsiteStructuredData(data: WebsiteStructuredData): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: data.name,
    description: data.description,
    url: data.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${data.url}/buscar?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
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
