// sw.js - Service Worker para funcionamiento offline CORREGIDO
const CACHE_NAME = 'pos-terminal-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/ventas.html',
  '/inventario.html',
  '/clientes.html',
  '/reportes.html',
  '/ventas-dia.html',
  '/cierre-caja.html',
  '/reporte-iva.html',
  '/configuracion.html',
  '/style.css',
  '/app.js',
  '/storage-manager.js',
  '/manifest.json',
  '/offline.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Instalación - cachear todos los archivos importantes
self.addEventListener('install', event => {
  console.log('Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cacheando archivos...');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('Error al cachear:', err))
  );
  self.skipWaiting();
});

// Activación - tomar control inmediatamente
self.addEventListener('activate', event => {
  console.log('Service Worker activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker listo para controlar la página');
      return self.clients.claim();
    })
  );
});

// Estrategia: Cache First con respaldo de red
self.addEventListener('fetch', event => {
  // Ignorar peticiones a APIs externas que no sean necesarias
  const url = new URL(event.request.url);
  
  // Para archivos estáticos de la app, usar cache first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            // Devolver desde cache
            return response;
          }
          // Si no está en cache, ir a la red
          return fetch(event.request)
            .then(networkResponse => {
              // Guardar en cache para próxima vez
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return networkResponse;
            })
            .catch(() => {
              // Si es una página HTML, mostrar offline.html
              if (event.request.destination === 'document') {
                return caches.match('/offline.html');
              }
              // Para otros recursos, devolver respuesta vacía
              return new Response('Recurso no disponible offline', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
  } else {
    // Para recursos externos (FontAwesome, etc.), intentar red primero, luego cache
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});

// Sincronización en segundo plano (opcional)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-ventas') {
    console.log('Sincronizando ventas pendientes...');
  }
});
