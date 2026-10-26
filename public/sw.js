// v2: invalida las cachés de la v1 para que los despliegues nuevos no sigan
// sirviendo bundles antiguos cuando la red falla (ERR_NAME_NOT_RESOLVED).
const CACHE_NAME = 'patitas-v2';
const RUNTIME_CACHE = 'patitas-runtime-v2';

// Recursos esenciales para cachear durante la instalación
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de cachés antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

// Estrategia de caché: Network First con fallback a caché
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo se cachean GET. Cachear la respuesta de un POST/PUT sería incorrecto y,
  // además, podría dejar datos de una sesión servidos a otra persona.
  if (request.method !== 'GET') {
    return;
  }

  // Solo cachear requests del mismo origen. Esto excluye Supabase (auth, REST y
  // Storage): sus respuestas van firmadas con el token del usuario y NUNCA deben
  // guardarse en la caché del navegador.
  if (url.origin !== location.origin) {
    return;
  }

  // No cachear llamadas a la API: son respuestas autenticadas y dinámicas.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Estrategia Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Solo cachear respuestas exitosas
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar servir desde caché
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no hay caché, retornar página offline básica
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Sin conexión', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});
